import { norm } from './glossary';
import { libraryEntries, type ReferenceEntry } from './country-recognition';

export interface LibraryGroup { language: string; entries: ReferenceEntry[]; countries: string[]; }

/** Entries grouped by language, in catalogue order. */
export function libraryGroups(): LibraryGroup[] {
  const map = new Map<string, LibraryGroup>();
  for (const e of libraryEntries()) {
    const g = map.get(e.language) ?? { language: e.language, entries: [], countries: [] };
    g.entries.push(e);
    for (const c of e.possibleCountries) if (!g.countries.includes(c)) g.countries.push(c);
    map.set(e.language, g);
  }
  return [...map.values()];
}

/**
 * Look up by what is printed on the can (a few words are enough, accents and typos in capitals don't matter),
 * or by a language/country name. Empty query returns everything.
 */
export function searchLibrary(query: string, names: (s: string) => string = (s) => s): LibraryGroup[] {
  const q = norm(query);
  if (!q) return libraryGroups();
  const words = q.split(' ').filter((w) => w.length >= 2);
  const out: LibraryGroup[] = [];
  for (const g of libraryGroups()) {
    const langHit = [g.language, names(g.language)].some((n) => norm(n).startsWith(q));
    const countryHit = g.countries.some((c) => [c, names(c)].some((n) => norm(n).startsWith(q)));
    const entries = g.entries.filter((e) => langHit || countryHit || e.phrases.some((p) => {
      const np = norm(p);
      return np.includes(q) || words.every((w) => np.split(' ').some((pw) => pw.startsWith(w)));
    }));
    if (entries.length) out.push({ ...g, entries });
  }
  return out;
}

/** Known tagline wordings for a country (matched by English or translated name), for suggestions in the can form. */
export function taglinesForCountry(country: string, names: (s: string) => string = (s) => s): string[] {
  const q = norm(country);
  if (!q) return [];
  const out: string[] = [];
  for (const e of libraryEntries()) {
    if (e.possibleCountries.some((c) => [c, names(c)].some((n) => norm(n) === q)) && e.display && !out.includes(e.display)) out.push(e.display);
  }
  return out;
}

/** Country names the library knows (for the country suggestions list). */
export function knownCountries(): string[] {
  return [...new Set(libraryEntries().flatMap((e) => e.possibleCountries))];
}
