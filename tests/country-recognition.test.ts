import { describe, expect, it } from 'vitest';
import { recognizeTagline } from '../src/country-recognition';
const words = (...text: string[]) => text.map((value) => ({ text: value, confidence: 90 }));
describe('recognizeTagline', () => {
  it('recognizes the historic English revitalizes body and mind tagline', () => {
    expect(recognizeTagline(words('Red', 'Bull', 'Revitalizes', 'Body', 'and', 'Mind'))).toMatchObject({ language: 'English', matchedPhrases: ['revitalizes body and mind'], possibleCountries: [] });
  });
  it('normalizes accents and does not pretend German identifies one country', () => {
    expect(recognizeTagline(words('Verleiht', 'Flügel'))).toMatchObject({ language: 'German', possibleCountries: ['Germany', 'Austria', 'Switzerland'] });
  });
  it('recognizes Dutch and returns multiple possible markets', () => {
    expect(recognizeTagline(words('Geeft', 'je', 'vleugels'))).toMatchObject({ language: 'Dutch', possibleCountries: ['Netherlands', 'Belgium'] });
  });
  it('ignores low-confidence OCR words', () => {
    expect(recognizeTagline([{text:'revitalizes',confidence:90},{text:'body',confidence:90},{text:'and',confidence:90},{text:'mind',confidence:20}])).toBeNull();
  });
  it('does not match partial or unrelated phrases', () => {
    expect(recognizeTagline(words('revitalizes', 'energy'))).toBeNull();
    expect(recognizeTagline(words('gives', 'you'))).toBeNull();
  });
  it('returns null for empty OCR', () => { expect(recognizeTagline([])).toBeNull(); });
});
