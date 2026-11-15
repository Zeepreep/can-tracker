// Offline language guess for the text read from a can, mapped to likely countries.
// It's a suggestion only: language is not country (German = DE/AT/CH, Dutch = NL/BE) and English says nothing about the country.
import { norm } from './glossary';
import type { OcrWord } from './ocr';

export type LangCode = 'en' | 'nl' | 'de' | 'pl' | 'fr' | 'es' | 'it';

// strong = the tagline ("gives you wings"/"vitalizes body and mind") or words only this language uses (3 points); common = function words (1 point).
// Words on every can regardless of country (red, bull, energy, drink, taurine) are deliberately absent. Lists are accent-free (see norm()).
const L: Record<LangCode, { strong: string[]; common: string[] }> = {
  en: { strong: ['wings', 'vitalizes', 'revitalizes', 'vitalises', 'revitalises'], common: ['the', 'and', 'your', 'with', 'body', 'mind', 'gives', 'for', 'from', 'this', 'caffeine', 'serving', 'contains'] },
  nl: { strong: ['vleugels', 'geeft'], common: ['het', 'een', 'van', 'voor', 'met', 'je', 'jouw', 'lichaam', 'geest', 'bevat', 'cafeine', 'drank', 'niet', 'ook', 'deze'] },
  de: { strong: ['verleiht', 'flugel', 'fluegel', 'getrank', 'getraenk', 'enthalt', 'enthaelt', 'koffein'], common: ['der', 'die', 'das', 'und', 'mit', 'fur', 'fuer', 'korper', 'geist', 'ist', 'nicht', 'ein', 'eine', 'auf', 'ihre', 'deine'] },
  pl: { strong: ['dodaje', 'skrzydel', 'skrzyde', 'skrzydla', 'napoj', 'zawiera', 'kofeina', 'tauryna', 'energetyczny'], common: ['dla', 'nie', 'jest', 'oraz', 'ciala', 'ducha', 'jak', 'przez', 'swoje'] },
  fr: { strong: ['ailes', 'donne', 'boisson', 'energisante', 'contient', 'caffeine'], common: ['les', 'des', 'une', 'avec', 'pour', 'votre', 'corps', 'esprit', 'est', 'dans'] },
  es: { strong: ['alas', 'bebida', 'energetica', 'contiene', 'cafeina'], common: ['los', 'las', 'una', 'con', 'para', 'cuerpo', 'mente', 'te', 'da', 'tu', 'es'] },
  it: { strong: ['ali', 'mette', 'bevanda', 'contiene', 'caffeina'], common: ['gli', 'una', 'con', 'per', 'corpo', 'mente', 'ti', 'il', 'della', 'tuo'] },
};
// accented letters hint at a language even when the reader mangles the word around them (weak: 1 point each, max 2)
const HINTS: [RegExp, LangCode][] = [[/[łąężźśćń]/i, 'pl'], [/[äöüß]/i, 'de'], [/[éèêçàù]/i, 'fr'], [/[ñ¿¡]/i, 'es']];

export interface LangGuess { lang: LangCode; score: number; evidence: string[]; }

export function detectLanguage(words: OcrWord[], minConf = 40): LangGuess | null {
  const ws = words.filter((w) => w.confidence >= minConf);
  const toks = new Set(ws.flatMap((w) => norm(w.text).split(' ')).filter((t) => t.length >= 2));
  const raw = ws.map((w) => w.text).join(' ');
  const scores: { lang: LangCode; score: number; evidence: string[] }[] = [];
  for (const lang of Object.keys(L) as LangCode[]) {
    let score = 0; const ev: string[] = [];
    for (const t of toks) {
      if (L[lang].strong.includes(t)) { score += 3; ev.push(t); } else if (L[lang].common.includes(t)) { score += 1; ev.push(t); }
    }
    for (const [re, l] of HINTS) if (l === lang && re.test(raw)) score += 1;
    scores.push({ lang, score, evidence: ev });
  }
  scores.sort((a, b) => b.score - a.score);
  const [a, b] = scores;
  if (a.score < 3 || a.score < (b?.score ?? 0) * 1.5) return null; // too little or too ambiguous: say nothing
  return a;
}

/** Likely countries for a language, most likely first. English gives none (used in too many places). */
export const COUNTRIES: Record<LangCode, string[]> = {
  en: [], nl: ['Netherlands', 'Belgium'], de: ['Germany', 'Austria', 'Switzerland'],
  pl: ['Poland'], fr: ['France', 'Belgium', 'Switzerland'], es: ['Spain'], it: ['Italy'],
};
