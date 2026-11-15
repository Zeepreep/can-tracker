import { norm } from './glossary';
import type { OcrWord } from './ocr';
import reference from './data/country-recognition.json';

export interface ReferenceEntry { id: string; display?: string; kind?: 'wings' | 'descriptor'; language: string; phrases: string[]; possibleCountries: string[]; sources?: string[]; }
interface ReferenceData { schemaVersion: number; entries: ReferenceEntry[]; }
export interface TaglineRecognition { language: string; matchedPhrases: string[]; possibleCountries: string[]; }
const data = reference as ReferenceData;

/** Match complete known taglines using only reasonably confident OCR words. */
export function recognizeTagline(words: OcrWord[], minConfidence = 45): TaglineRecognition | null {
  const text = norm(words.filter((word) => word.confidence >= minConfidence).map((word) => word.text).join(' '));
  if (!text) return null;
  const padded = ' ' + text + ' ';
  const matches = data.entries.flatMap((entry) => {
    const phrases = entry.phrases.filter((phrase) => {
      const normalized = norm(phrase);
      return normalized.length > 0 && padded.includes(' ' + normalized + ' ');
    });
    return phrases.length ? [{ entry, phrases }] : [];
  });
  if (!matches.length) return null;
  const languages = [...new Set(matches.map(({ entry }) => entry.language))];
  if (languages.length !== 1) return null;
  return {
    language: languages[0],
    matchedPhrases: [...new Set(matches.flatMap(({ phrases }) => phrases))],
    possibleCountries: [...new Set(matches.flatMap(({ entry }) => entry.possibleCountries))],
  };
}

/** All known taglines, for the library screen. */
export const libraryEntries = (): ReferenceEntry[] => data.entries;
