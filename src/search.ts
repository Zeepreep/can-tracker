import MiniSearch from 'minisearch';
import type { Can } from './types';
import { expand, norm, synonyms } from './glossary';

const FIELDS = ['name', 'flavor', 'tagline', 'country', 'notes', 'barcode'] as const;

export function buildIndex(cans: Can[]) {
  const ms = new MiniSearch<{ id: string; text: string }>({
    fields: ['text'],
    storeFields: [],
    tokenize: (s) => s.split(/\s+/).filter(Boolean),
    processTerm: (t) => norm(t) || null,
    searchOptions: { prefix: true, fuzzy: (t) => (t.length > 4 ? 0.2 : false), combineWith: 'AND' },
  });
  ms.addAll(cans.map((c) => ({ id: c.id, text: expand(FIELDS.map((f) => c[f] ?? '').join(' ')) })));
  return ms;
}

/**
 * Every query word must match (directly or via glossary synonym, with prefix/typo tolerance).
 * Returns ids ranked by relevance; empty query returns null (= no filtering).
 */
export function search(ms: MiniSearch, query: string): string[] | null {
  const words = norm(query).split(' ').filter(Boolean);
  if (!words.length) return null;
  const perWord = words.map((w) => {
    const alts = [w, ...synonyms(w)];
    const ids = new Map<string, number>();
    for (const a of alts) {
      for (const r of ms.search(a, { combineWith: 'AND' })) ids.set(String(r.id), Math.max(ids.get(String(r.id)) ?? 0, r.score));
    }
    return ids;
  });
  const first = perWord[0];
  const out: [string, number][] = [];
  for (const [id, s] of first) {
    if (perWord.every((m) => m.has(id))) out.push([id, perWord.reduce((a, m) => a + (m.get(id) ?? 0), 0)]);
  }
  return out.sort((a, b) => b[1] - a[1]).map(([id]) => id);
}
