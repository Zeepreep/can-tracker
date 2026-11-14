// Open Food Facts lookup. Always optional: every failure resolves to {ok:false} and the app falls back to manual entry.
export interface OffResult { ok: boolean; reason?: 'notfound' | 'network' | 'ratelimit' | 'badcode'; name?: string; brand?: string; imageUrl?: string; }

export function cleanBarcode(raw: string): string | null {
  const d = raw.replace(/\D/g, '');
  return [8, 12, 13].includes(d.length) && checkDigitOk(d) ? d : null;
}

export function checkDigitOk(d: string): boolean {
  const n = d.split('').map(Number);
  const check = n.pop()!;
  let sum = 0;
  // weights alternate 3,1 starting from the digit next to the check digit
  for (let i = n.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += n[i] * w;
  return (10 - (sum % 10)) % 10 === check;
}

export async function lookup(code: string, fetchImpl: typeof fetch = fetch): Promise<OffResult> {
  const c = cleanBarcode(code);
  if (!c) return { ok: false, reason: 'badcode' };
  const url = `https://world.openfoodfacts.org/api/v2/product/${c}.json?fields=code,product_name,brands,image_front_small_url&app_name=can-tracker&app_version=0.1`;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    const r = await fetchImpl(url, { signal: ctl.signal });
    clearTimeout(t);
    if (r.status === 429) return { ok: false, reason: 'ratelimit' };
    if (r.status === 404) return { ok: false, reason: 'notfound' };
    if (!r.ok) return { ok: false, reason: 'network' };
    const j = await r.json();
    if (j.status !== 1 || !j.product) return { ok: false, reason: 'notfound' };
    const https = (u?: string) => (u ? u.replace(/^http:/, 'https:') : undefined);
    return { ok: true, name: j.product.product_name || undefined, brand: j.product.brands || undefined, imageUrl: https(j.product.image_front_small_url) };
  } catch {
    return { ok: false, reason: 'network' };
  }
}
