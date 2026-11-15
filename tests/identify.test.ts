import { describe, it, expect } from 'vitest';
import { queryTokens, rankCans, guessName, tokenSim } from '../src/identify';
import { dominantColour } from '../src/colour';
import { synonyms } from '../src/glossary';
import type { Can } from '../src/types';

const mk = (id: string, name: string, extra: Partial<Can> = {}): Can => ({ id, status: 'have', name, createdAt: 1, updatedAt: 1, ...extra });
const cans = [
  mk('1', 'Red Bull Curuba Elderflower Summer Edition', { country: 'Poland' }),
  mk('2', 'Red Bull Winter Edition Iced Vita Berry'),
  mk('3', 'Red Bull Zomer Editie Watermeloen'),
  mk('4', 'Red Bull Sugarfree'),
];
const w = (...t: string[]) => t.map((text) => ({ text, confidence: 88 }));

describe('queryTokens', () => {
  it('corrects OCR against the actual can catalogue and drops unrelated fragments', () => {
    const greenCan = mk('green', 'Redbull Green Edition', { flavor: 'Caruba Elderflower' });
    const raw = [...w('GREEN', 'EDITION', 'CURUB4', 'ELDERFL0WER', 'LAY', 'ENERGY', 'DRIN', 'IR')];
    const corrected = queryTokens(raw, 25, [greenCan]);
    expect(corrected).toEqual(['green', 'edition', 'curuba', 'elderflower']);
    expect(rankCans(corrected, [greenCan])[0].can.id).toBe('green');
    expect(guessName(raw, [greenCan])).toBe('Red Bull Green Edition Curuba Elderflower');
  });
  it('drops noise, digits, low confidence', () => {
    const t = queryTokens([...w('RED', 'BULL', 'ENERGY', 'DRINK', '250ml', 'CURUBA'), { text: 'xqzv', confidence: 20 }]);
    expect(t).toEqual(['curuba']);
  });
});
describe('rankCans', () => {
  it('finds the Polish curuba can despite OCR typos', () => {
    const r = rankCans(queryTokens(w('RED', 'BULL', 'CURUBA', 'ELDERFL0WER', 'KWIAT', 'CZARNEGO', 'BZU')), cans);
    expect(r[0].can.id).toBe('1'); expect(r[0].strong).toBe(true);
  });
  it('matches across languages: Dutch word finds the English-named can', () => {
    const r = rankCans(queryTokens(w('WATERMELOEN')), cans); expect(r[0].can.id).toBe('3');
    expect(rankCans(queryTokens(w('ARBUZ')), cans)[0].can.id).toBe('3');
  });
  it('unknown can: nothing strong', () => {
    const r = rankCans(queryTokens(w('RED', 'BULL', 'DRAGONFRUIT', 'MANGO')), cans);
    expect(r.filter((x) => x.strong)).toHaveLength(0);
  });
  it('word printed on every can does not match everything', () => {
    expect(rankCans(queryTokens(w('RED', 'BULL', 'ENERGY')), cans)).toHaveLength(0);
  });
  it('no input / no cans', () => { expect(rankCans([], cans)).toEqual([]); expect(rankCans(['x'], [])).toEqual([]); });
});
describe('misc', () => {
  it('tokenSim tolerates one OCR slip in a 6+ letter word only', () => {
    expect(tokenSim('curuba', 'curuba')).toBe(1); expect(tokenSim('curubo', 'curuba')).toBeGreaterThan(0.5); expect(tokenSim('cat', 'cot')).toBe(0);
  });
  it('guessName uses confident distinctive words', () => {
    expect(guessName([...w('RED', 'BULL', 'CURUBA', 'ELDERFLOWER'), { text: 'junk', confidence: 30 }])).toBe('Red Bull Curuba Elderflower');
    expect(guessName([])).toBe('Red Bull');
  });
  it('polish glossary rows exist', () => { expect(synonyms('kwiat czarnego bzu')).toContain('elderflower'); expect(synonyms('bez')).toEqual([]); });
});
describe('dominantColour', () => {
  const solid = (r: number, g: number, b: number, n = 40) => {
    const data = new Uint8ClampedArray(n * n * 4); for (let i = 0; i < data.length; i += 4) { data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255; }
    return { data, width: n, height: n };
  };
  it('purple can', () => { const c = dominantColour(solid(120, 50, 160))!; expect(c).toBe('#7832a0'); });
  it('mostly blue with a white glare patch still blue', () => {
    const img = solid(30, 90, 200); for (let y = 10; y < 20; y++) for (let x = 10; x < 20; x++) { const i = (y * 40 + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; }
    expect(dominantColour(img)).toBe('#1e5ac8');
  });
  it('silver can returns a grey, black frame returns null', () => {
    expect(dominantColour(solid(190, 192, 195))).toBe('#bec0c3'); expect(dominantColour(solid(5, 5, 5))).toBeNull();
  });
});
