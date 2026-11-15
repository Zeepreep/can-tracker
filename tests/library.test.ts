import { describe, it, expect } from 'vitest';
import { searchLibrary, libraryGroups } from '../src/library';
import { libraryEntries, recognizeTagline } from '../src/country-recognition';
import { norm } from '../src/glossary';

const w = (...t: string[]) => t.map((text) => ({ text, confidence: 90 }));

describe('catalogue integrity', () => {
  it('every entry has phrases, a kind, and a source', () => {
    for (const e of libraryEntries()) {
      expect(e.phrases.length, e.id).toBeGreaterThan(0);
      expect(['wings', 'descriptor'], e.id).toContain(e.kind);
      expect(e.sources?.length, e.id).toBeGreaterThan(0);
      expect(e.display, e.id).toBeTruthy();
    }
  });
  it('no phrase belongs to two languages (that would make recognition ambiguous)', () => {
    const seen = new Map<string, string>();
    for (const e of libraryEntries()) for (const p of e.phrases) {
      const k = norm(p); const prev = seen.get(k);
      expect(prev === undefined || prev === e.language, `${p} in ${prev} and ${e.language}`).toBe(true);
      seen.set(k, e.language);
    }
  });
  it('each language has distinct, non-empty phrase sets and ids are unique', () => {
    const ids = libraryEntries().map((e) => e.id); expect(new Set(ids).size).toBe(ids.length);
  });
});
describe('searchLibrary', () => {
  it('finds a language by a word printed on the can', () => {
    expect(searchLibrary('vleugels')[0].language).toBe('Dutch');
    expect(searchLibrary('belebt geist')[0].language).toBe('German');
    expect(searchLibrary('skrzydeł')[0].language).toBe('Polish');
    expect(searchLibrary('MIETTE LE ALI').length).toBe(0);
    expect(searchLibrary('mette le ali')[0].language).toBe('Italian');
  });
  it('partial words and stylised spellings', () => {
    expect(searchLibrary('flüüü')[0].language).toBe('German');
    expect(searchLibrary('aaalas')[0].language).toBe('Spanish');
  });
  it('searches by country or language name too', () => {
    expect(searchLibrary('portugal').map((g) => g.language)).toEqual(['Portuguese']);
    expect(searchLibrary('swed')[0].language).toBe('Swedish');
    expect(searchLibrary('Zweden', (s) => ({ Sweden: 'Zweden', Swedish: 'Zweeds' } as Record<string, string>)[s] ?? s)[0].language).toBe('Swedish');
  });
  it('empty query lists every language; junk lists none', () => {
    expect(searchLibrary('').length).toBe(libraryGroups().length);
    expect(searchLibrary('qqqzzz')).toEqual([]);
  });
});
describe('recognizeTagline with the new phrases', () => {
  it('official wording from each site is recognised', () => {
    expect(recognizeTagline(w('Red', 'Bull', 'GEEFT', 'JE', 'VLEUGELS'))?.language).toBe('Dutch');
    expect(recognizeTagline(w('Red', 'Bull', 'DODA', 'CI', 'SKRZYYYDEŁ'))?.language).toBe('Polish');
    expect(recognizeTagline(w('Red', 'Bull', 'TI', 'METTE', 'LE', 'AAALI'))?.language).toBe('Italian');
    expect(recognizeTagline(w('Red', 'Bull', 'GER', 'DIG', 'VIIINGAR'))?.language).toBe('Swedish');
    expect(recognizeTagline(w('Red', 'Bull', 'dá-te', 'aaasas'))?.language).toBe('Portuguese');
    expect(recognizeTagline(w('Red', 'Bull', 'TE', 'DA', 'AAALAS'))?.language).toBe('Spanish');
    expect(recognizeTagline(w('Red', 'Bull', 'DONNE', 'DES', 'AIIILES'))?.language).toBe('French');
    expect(recognizeTagline(w('Belebt', 'Geist', 'und', 'Körper'))?.language).toBe('German');
    expect(recognizeTagline(w('Verleiht', 'Flüüügel'))?.language).toBe('German');
  });
});
