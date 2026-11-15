import { describe, it, expect } from 'vitest';
import { SPECS, SIZE_IDS, specFor, DEFAULT_SIZE } from '../src/can3d/specs';
import { canProfile, labelAspect } from '../src/can3d/profile';
import { readableTextOn, contrastRatio, shade, defaultColour, fitText, stripBrand, hexToRgb } from '../src/can3d/label';
import { taglinesForCountry, knownCountries } from '../src/library';

describe('specs', () => {
  it('verified sizes match the manufacturer numbers', () => {
    expect(SPECS.slim250).toMatchObject({ diameter: 53.4, height: 134.0, neckPlugDia: 50.0, standDia: 46.1, approx: false });
    expect(SPECS.sleek330).toMatchObject({ diameter: 58.1, height: 145.4, standDia: 46.0, approx: false });
    expect(SPECS.std500).toMatchObject({ diameter: 66.3, height: 168.0, neckPlugDia: 52.4, approx: false });
  });
  it('estimated sizes are flagged', () => { expect(SPECS.sleek355.approx && SPECS.sleek473.approx).toBe(true); });
  it('body circumference agrees with the print-area circumference of Ball\'s guide within 1.5%', () => {
    const ball: Record<string, number> = { slim250: 167, sleek330: 182, sleek355: 182, sleek473: 198, std500: 208 };
    for (const id of SIZE_IDS) expect(Math.abs((Math.PI * SPECS[id].diameter) / ball[id] - 1), id).toBeLessThan(0.015);
  });
  it('unknown or missing size falls back to the default', () => { expect(specFor(undefined).id).toBe(DEFAULT_SIZE); expect(specFor('nope').id).toBe(DEFAULT_SIZE); });
});
describe('profile', () => {
  for (const id of SIZE_IDS) it(`${id}: sane geometry`, () => {
    const s = SPECS[id], p = canProfile(s);
    const all = [...p.base, ...p.body, ...p.top, ...p.lid];
    expect(all.every(([r, y]) => Number.isFinite(r) && Number.isFinite(y) && r >= 0 && y >= 0)).toBe(true);
    expect(Math.max(...all.map(([r]) => r))).toBeCloseTo(s.diameter / 2, 5);       // widest point is the body
    expect(Math.max(...all.map(([, y]) => y))).toBeCloseTo(s.height, 5);             // overall height
    expect(p.bodyTop).toBeGreaterThan(p.bodyBottom); expect(p.bodyHeight).toBeGreaterThan(s.height * 0.5);
    expect(p.body.every(([r]) => r === s.diameter / 2)).toBe(true);
    // the can must be able to stand: lowest point is the standing ring
    const ring = p.base.find(([, y]) => y === 0)!; expect(ring[0]).toBeCloseTo(s.standDia / 2, 5);
    // seam ring radius: flange diameter, but never wider than the body
    expect(Math.max(...p.top.map(([r, y]) => (y > s.height - 3 ? r : 0)))).toBeCloseTo(Math.min(s.flangeDia, s.diameter) / 2, 5);
  });
  it('label aspect = circumference / printed height', () => { const s = SPECS.slim250, p = canProfile(s); expect(labelAspect(s)).toBeCloseTo(Math.PI * 53.4 / p.bodyHeight, 6); });
});
describe('label helpers', () => {
  it('text colour always reads on any background (>= 4.5:1)', () => {
    for (let i = 0; i < 400; i++) { const bg = '#' + Math.floor((i * 2654435761) % 0xffffff).toString(16).padStart(6, '0'); expect(contrastRatio(readableTextOn(bg), bg), bg).toBeGreaterThanOrEqual(4.5); }
  });
  it('shade moves toward white/black', () => { expect(shade('#808080', 1)).toBe('#ffffff'); expect(shade('#808080', -1)).toBe('#000000'); });
  it('default colour is stable, valid and differs per name', () => {
    expect(defaultColour('A')).toBe(defaultColour('A')); expect(defaultColour('A')).toMatch(/^#[0-9a-f]{6}$/); expect(defaultColour('A')).not.toBe(defaultColour('B'));
  });
  it('hexToRgb tolerates junk', () => { expect(hexToRgb('#ff0000')).toEqual([255, 0, 0]); expect(hexToRgb('nope')).toHaveLength(3); });
  it('stripBrand removes only a leading brand', () => {
    expect(stripBrand('Red Bull Winter Edition')).toBe('Winter Edition'); expect(stripBrand('redbull: Zomer')).toBe('Zomer'); expect(stripBrand('Winter Red Bull')).toBe('Winter Red Bull');
  });
  it('fitText wraps and shrinks to fit the box', () => {
    const measure = (s: string, px: number) => s.length * px * 0.6;
    const r = fitText(measure, 'Winter Edition Iced Vita Berry', 600, 300, 100, 20);
    expect(r.lines.every((l) => measure(l, r.px) <= 600)).toBe(true); expect(r.lines.length * r.px * 1.12).toBeLessThanOrEqual(300); expect(r.lines.join(' ')).toBe('Winter Edition Iced Vita Berry');
    expect(fitText(measure, '', 600, 300, 100, 20).lines).toEqual([]);
  });
});
describe('tagline suggestions per country', () => {
  it('German-speaking markets get the German wording, in English or Dutch country names', () => {
    expect(taglinesForCountry('Germany')).toContain('Red Bull verleiht Flüüügel');
    expect(taglinesForCountry('duitsland', (s) => ({ Germany: 'Duitsland' } as Record<string, string>)[s] ?? s)).toContain('Belebt Geist und Körper');
  });
  it('unknown country gives nothing; known list contains Poland', () => { expect(taglinesForCountry('Atlantis')).toEqual([]); expect(taglinesForCountry('')).toEqual([]); expect(knownCountries()).toContain('Poland'); });
});
