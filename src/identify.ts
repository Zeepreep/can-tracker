import type { Can } from './types';
import { norm, expand, synonyms } from './glossary';
import type { OcrWord } from './ocr';

/** Words printed on (nearly) every can: they say nothing about which one it is. */
const NOISE = new Set(['red', 'bull', 'energy', 'drink', 'wings', 'vleugels', 'fluegel', 'flugel', 'gives', 'you', 'geeft', 'verleiht', 'ml', 'cl', 'the', 'and',
  'het', 'een', 'mit', 'und', 'der', 'die', 'das', 'ein', 'nieuw', 'new', 'neu', 'taurine', 'caffeine', 'cafeine', 'koffein', 'bevat', 'contains', 'enthalt', 'enthaelt', 'dla', 'dzieci',
  'kofeina', 'tauryna', 'napoj', 'energetyczny', 'napoj', 'with', 'met', 'for', 'can', 'blik', 'dose', 'puszka', 'kcal', 'per', 'min', 'max', 'recycle', 'pant', 'statiegeld', 'einweg', 'pfand']);

export const tokens = (s: string) => norm(s).split(' ').filter((t) => t.length >= 3 && !/^\d+$/.test(t));

/** Distinctive query tokens from OCR. When a collection is supplied, OCR is corrected
 * against words that actually occur on those cans; unrelated OCR fragments are discarded. */
export function queryTokens(words: OcrWord[], minConf = 45, catalogue: Can[] = []): string[] {
  const vocabulary = new Set<string>();
  for (const can of catalogue) {
    const source = [can.name, can.flavor, can.tagline].filter(Boolean).join(' ');
    for (const token of tokens(expand(source))) {
      if (/^[a-z]+$/.test(token) && !NOISE.has(token)) vocabulary.add(token);
    }
  }
  const known = [...vocabulary];
  const out: string[] = [];
  for (const word of words) {
    if (word.confidence < minConf) continue;
    for (const raw of tokens(word.text)) {
      if (!/^[a-z]+$/.test(raw) || NOISE.has(raw)) continue;
      let corrected = raw;
      if (catalogue.length) {
        let best = 0;
        for (const candidate of known) {
          const score = tokenSim(raw, candidate);
          if (score > best) { best = score; corrected = candidate; }
        }
        // Only accept exact or one/two-character OCR corrections; never guess from a weak fragment.
        if (best < 0.75) continue;
      }
      if (!out.includes(corrected)) out.push(corrected);
    }
  }
  return out;
}

function lev(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** 0..1: how well an OCR token matches a can token (OCR confuses letters, so allow small edits). */
export function tokenSim(q: string, t: string): number {
  if (q === t) return 1;
  const L = Math.min(q.length, t.length);
  if (L >= 4 && (q.startsWith(t) || t.startsWith(q)) && Math.abs(q.length - t.length) <= 3) return 0.6;
  const allowed = L >= 8 ? 2 : L >= 5 ? 1 : 0;
  if (allowed && lev(q, t, allowed) <= allowed) return 0.75;
  return 0;
}

export interface Candidate { can: Can; score: number; matched: string[]; coverage: number; strong: boolean; }

export function rankCans(qTokens: string[], cans: Can[]): Candidate[] {
  if (!qTokens.length || !cans.length) return [];
  const canToks = cans.map((c) => new Set(tokens(expand([c.name, c.flavor, c.tagline].filter(Boolean).join(' '))).filter((t) => !NOISE.has(t))));
  const qAlts = qTokens.map((q) => [q, ...synonyms(q)]);
  // match matrix + document frequency per query token
  const sim = qAlts.map((alts) => canToks.map((set) => {
    let best = 0; for (const a of alts) for (const t of set) { const s = tokenSim(a, t); if (s > best) best = s; if (best === 1) break; } return best;
  }));
  const N = cans.length;
  const weight = sim.map((row) => { const df = row.filter((s) => s >= 0.6).length; return df === 0 ? 0 : Math.max(0.05, Math.log((N + 1) / (df + 0.5))); });
  const res: Candidate[] = [];
  cans.forEach((can, ci) => {
    let score = 0; const matched: string[] = [];
    qTokens.forEach((q, qi) => { const s = sim[qi][ci]; if (s >= 0.6 && weight[qi] > 0) { score += s * weight[qi]; matched.push(q); } });
    if (score <= 0) return;
    // coverage: share of this can's own (original-language) distinctive words that the photo explains
    const own = tokens([can.name, can.flavor, can.tagline].filter(Boolean).join(' ')).filter((t) => !NOISE.has(t));
    const explained = own.filter((t) => qAlts.some((alts) => [t, ...synonyms(t)].some((ct) => alts.some((a) => tokenSim(a, ct) >= 0.6)))).length;
    res.push({ can, score, matched, coverage: own.length ? explained / own.length : 0, strong: false });
  });
  res.sort((a, b) => b.score * (0.5 + b.coverage) - a.score * (0.5 + a.coverage));
  // "strong" = clearly the one: a rare word matched and no runner-up is close
  if (res.length && res[0].score >= 1 && (res.length === 1 || res[0].score >= 1.5 * res[1].score)) res[0].strong = true;
  return res.slice(0, 3);
}

/** Starting point for the "new can" form: only words that were read confidently. */
export function guessName(words: OcrWord[], catalogue: Can[] = []): string {
  const keep = catalogue.length ? queryTokens(words, 25, catalogue) : words.filter((w) => w.confidence >= 60).flatMap((w) => tokens(w.text)).filter((t) => /^[a-z]+$/.test(t) && !NOISE.has(t));
  const uniq = [...new Set(keep)].slice(0, 5);
  const title = uniq.map((t) => t[0].toUpperCase() + t.slice(1)).join(' ');
  return title ? `Red Bull ${title}` : 'Red Bull';
}
