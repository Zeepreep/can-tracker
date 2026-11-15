import { describe, it, expect } from 'vitest';
import { detectLanguage, COUNTRIES } from '../src/lang';
import { countryFromTaglines } from '../src/identify';
import { norm } from '../src/glossary';
import type { Can } from '../src/types';

const w = (...t: string[]) => t.map((text) => ({ text, confidence: 85 }));
const mk = (name: string, extra: Partial<Can> = {}): Can => ({ id: name, name, status: 'have', createdAt: 1, updatedAt: 1, ...extra });

describe('detectLanguage', () => {
  it('German tagline', () => { expect(detectLanguage(w('Red', 'Bull', 'verleiht', 'Flügel'))?.lang).toBe('de'); });
  it('Dutch tagline', () => { expect(detectLanguage(w('Red', 'Bull', 'geeft', 'je', 'vleugels'))?.lang).toBe('nl'); });
  it('Polish tagline, even with the l-stroke read as plain l', () => {
    expect(detectLanguage(w('RED', 'BULL', 'DODAJE', 'SKRZYDEŁ'))?.lang).toBe('pl');
    expect(detectLanguage(w('DODAJE', 'SKRZYDEL'))?.lang).toBe('pl');
  });
  it('French, Spanish, Italian wings lines', () => {
    expect(detectLanguage(w('Red', 'Bull', 'donne', 'des', 'ailes'))?.lang).toBe('fr');
    expect(detectLanguage(w('Red', 'Bull', 'te', 'da', 'alas'))?.lang).toBe('es');
    expect(detectLanguage(w('Red', 'Bull', 'ti', 'mette', 'le', 'ali'))?.lang).toBe('it');
  });
  it('English "revitalizes your energy" is English', () => { expect(detectLanguage(w('Revitalizes', 'your', 'energy'))?.lang).toBe('en'); });
  it('only words on every can: no guess', () => { expect(detectLanguage(w('RED', 'BULL', 'ENERGY', 'DRINK', '250', 'ml'))).toBeNull(); });
  it('ignores low-confidence junk', () => { expect(detectLanguage([{ text: 'verleiht', confidence: 10 }, { text: 'Flügel', confidence: 12 }])).toBeNull(); });
  it('English gives no country; German lists DE first', () => { expect(COUNTRIES.en).toEqual([]); expect(COUNTRIES.de[0]).toBe('Germany'); });
});
describe('countryFromTaglines (learned from collection)', () => {
  const cans = [mk('A', { tagline: 'Revitalizes your energy', country: 'Poland' }), mk('B', { tagline: 'Gives you wings', country: 'Netherlands' }), mk('C', { tagline: 'Short' , country: 'X' })];
  it('finds the country of a tagline seen before, even with an OCR slip', () => {
    expect(countryFromTaglines(w('Revitalizes', 'your', 'enerqy'), cans)).toEqual({ country: 'Poland', from: 'A' });
  });
  it('needs most of the tagline', () => { expect(countryFromTaglines(w('your'), cans)).toBeNull(); });
  it('no match, no suggestion', () => { expect(countryFromTaglines(w('Dodaje', 'skrzydel'), cans)).toBeNull(); });
});
describe('norm', () => { it('maps ł so Polish words are not split', () => { expect(norm('skrzydeł')).toBe('skrzydel'); }); });

