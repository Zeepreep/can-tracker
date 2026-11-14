// Small bundled EN/NL/DE glossary. Each row is one concept; every term in a row is treated
// as a synonym at search time (query and can text are both expanded). Terms are lowercase, diacritic-free.
export const GLOSSARY: string[][] = [
  // colours
  ['red', 'rood', 'rot'], ['blue', 'blauw', 'blau'], ['yellow', 'geel', 'gelb'], ['green', 'groen', 'gruen', 'grun'],
  ['purple', 'paars', 'lila', 'violett', 'violet'], ['pink', 'roze', 'rosa'], ['orange', 'oranje'], ['white', 'wit', 'weiss'],
  ['black', 'zwart', 'schwarz'], ['silver', 'zilver', 'silber'], ['gold', 'goud'], ['sugarfree', 'sugar free', 'suikervrij', 'zuckerfrei', 'zero', 'light'],
  // fruits and flavours
  ['apple', 'appel', 'apfel'], ['pear', 'peer', 'birne'], ['cherry', 'kers', 'kirsche'], ['strawberry', 'aardbei', 'erdbeere'],
  ['raspberry', 'framboos', 'himbeere'], ['blueberry', 'bosbes', 'blaubeere'], ['blackcurrant', 'zwarte bes', 'cassis', 'schwarze johannisbeere'],
  ['redcurrant', 'rode bes', 'johannisbeere'], ['berry', 'berries', 'bes', 'bessen', 'beere', 'beeren'], ['peach', 'perzik', 'pfirsich'],
  ['apricot', 'abrikoos', 'aprikose'], ['plum', 'pruim', 'pflaume'], ['fig', 'vijg', 'feige'], ['lemon', 'citroen', 'zitrone'],
  ['lime', 'limoen', 'limette'], ['grapefruit', 'pompelmoes'], ['watermelon', 'watermeloen', 'wassermelone'], ['melon', 'meloen'],
  ['pineapple', 'ananas'], ['coconut', 'kokos', 'kokosnoot', 'kokosnuss'], ['mango'], ['kiwi'], ['cranberry', 'veenbes', 'preiselbeere'],
  ['pomegranate', 'granaatappel', 'granatapfel'], ['grape', 'druif', 'traube'], ['banana', 'banaan', 'banane'], ['vanilla', 'vanille'],
  ['cactus', 'cactusvijg', 'kaktus', 'kaktusfeige'], ['dragon fruit', 'dragonfruit', 'drakenvrucht', 'drachenfrucht', 'pitaya'], ['passion fruit', 'passievrucht', 'maracuja', 'passionsfrucht'],
  ['tropical', 'tropisch', 'tropen'], ['juneberry', 'juneberries', 'krent', 'felsenbirne'], ['iced', 'ijs', 'eis'], ['vita'], ['curuba'], ['lychee', 'lichi', 'litschi'],
  ['peach nectarine', 'nectarine', 'nektarine'], ['spiced', 'gekruid', 'gewuerzt'], ['cinnamon', 'kaneel', 'zimt'], ['gingerbread', 'peperkoek', 'lebkuchen'],
  ['forest', 'bos', 'wald'], ['fruit', 'vrucht', 'frucht'], ['winter'], ['summer', 'zomer', 'sommer'], ['spring', 'lente', 'voorjaar', 'fruehling', 'fruhling'],
  ['autumn', 'fall', 'herfst', 'herbst'], ['edition', 'editie', 'ausgabe'], ['limited', 'beperkt', 'limitiert', 'begrenzt'],
  // tagline words
  ['wings', 'vleugels', 'fluegel', 'flugel'], ['gives you wings', 'geeft je vleugels', 'verleiht fluegel', 'verleiht flugel'],
  ['energy', 'energie'], ['drink', 'drank', 'getraenk', 'getrank'], ['can', 'blik', 'dose'], ['new', 'nieuw', 'neu'], ['taste', 'smaak', 'geschmack'],
];

export function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/œ/g, 'oe')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const index = new Map<string, Set<number>>();
GLOSSARY.forEach((row, i) => row.forEach((t) => {
  const k = norm(t);
  (index.get(k) ?? index.set(k, new Set()).get(k)!).add(i);
}));

/** Terms equivalent to `word` (including itself). Multi-word phrases are looked up as a whole too. */
export function synonyms(word: string): string[] {
  const rows = index.get(norm(word));
  if (!rows) return [];
  const out = new Set<string>();
  rows.forEach((i) => GLOSSARY[i].forEach((t) => out.add(norm(t))));
  return [...out];
}

/** Expand free text into itself + synonyms of every word and adjacent word pair. */
export function expand(text: string): string {
  const words = norm(text).split(' ').filter(Boolean);
  const extra = new Set<string>();
  for (let i = 0; i < words.length; i++) {
    synonyms(words[i]).forEach((s) => extra.add(s));
    if (i + 1 < words.length) synonyms(words[i] + ' ' + words[i + 1]).forEach((s) => extra.add(s));
  }
  return words.join(' ') + ' ' + [...extra].join(' ');
}
