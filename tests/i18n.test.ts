import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { NL, t, setLang, getLang } from '../src/i18n';

describe('i18n', () => {
  it('every t("...") key used in the source has a Dutch translation', () => {
    const missing: string[] = [];
    for (const f of readdirSync('src').filter((x) => x.endsWith('.ts') && x !== 'i18n.ts')) {
      const src = readFileSync('src/' + f, 'utf8');
      for (const m of src.matchAll(/\bt\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g)) {
        const key = (m[1] ?? m[2]).replace(/\\"/g, '"').replace(/\\'/g, "'");
        if (!(key in NL)) missing.push(f + ': ' + key);
      }
    }
    expect(missing).toEqual([]);
  });
  it('placeholders match between English key and Dutch text', () => {
    for (const [k, v] of Object.entries(NL)) {
      const a = [...k.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      const b = [...v.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      expect(b, k).toEqual(a);
    }
  });
  it('switches language and interpolates', () => {
    setLang('nl'); expect(getLang()).toBe('nl');
    expect(t('{a} of {b}', { a: 2, b: 5 })).toBe('2 van 5');
    expect(t('some unknown string')).toBe('some unknown string');
    setLang('en'); expect(t('{a} of {b}', { a: 2, b: 5 })).toBe('2 of 5');
  });
});
