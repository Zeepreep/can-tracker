import { describe, it, expect } from 'vitest';
import { buildIndex, search } from '../src/search';
import type { Can } from '../src/types';
import { norm, synonyms } from '../src/glossary';

const mk = (id: string, name: string, extra: Partial<Can> = {}): Can => ({ id, status: 'have', name, createdAt: 1, updatedAt: 1, ...extra });
const cans = [
  mk('1', 'Red Bull Winter Edition Iced Vita Berry', { country: 'Germany' }),
  mk('2', 'Red Bull Zomer Editie Watermeloen', { country: 'Netherlands' }),
  mk('3', 'Red Bull Sommer Edition Kaktusfeige', { country: 'Germany', tagline: 'Verleiht Flügel' }),
  mk('4', 'Red Bull Sugarfree'),
];
const ms = buildIndex(cans);

describe('glossary', () => {
  it('normalizes ß and umlauts', () => { expect(norm('Weiß Größe Flügel')).toBe('weiss grosse flugel'); });
  it('finds synonyms across languages', () => { expect(synonyms('watermeloen')).toContain('watermelon'); });
});
describe('search', () => {
  it('english query finds Dutch can', () => { expect(search(ms, 'watermelon')).toEqual(['2']); });
  it('dutch query finds German can', () => { expect(search(ms, 'kaktus')).toContain('3'); expect(search(ms, 'cactus')).toContain('3'); });
  it('german season word finds Dutch season', () => { expect(search(ms, 'sommer')).toEqual(expect.arrayContaining(['2', '3'])); });
  it('tagline translation: wings finds Flügel', () => { expect(search(ms, 'wings')).toContain('3'); });
  it('multi-word AND', () => { expect(search(ms, 'winter berry')).toEqual(['1']); });
  it('typo tolerance', () => { expect(search(ms, 'watermelom')).toContain('2'); });
  it('empty query = no filter', () => { expect(search(ms, '  ')).toBeNull(); });
  it('zuckerfrei finds sugarfree', () => { expect(search(ms, 'zuckerfrei')).toContain('4'); });
});
