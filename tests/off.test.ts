import { describe, it, expect } from 'vitest';
import { cleanBarcode, checkDigitOk, lookup } from '../src/off';

const res = (status: number, body: unknown = {}) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe('barcode validation', () => {
  it('accepts valid EAN-13 / EAN-8 / UPC-A', () => {
    expect(cleanBarcode('9002490100070')).toBe('9002490100070');
    expect(cleanBarcode('90162602')).toBe('90162602');
    expect(cleanBarcode('036000291452')).toBe('036000291452');
  });
  it('rejects bad check digit, wrong length, junk', () => {
    expect(cleanBarcode('9002490100071')).toBeNull();
    expect(cleanBarcode('1234')).toBeNull();
    expect(cleanBarcode('abc')).toBeNull();
  });
  it('strips spaces', () => { expect(cleanBarcode('9002 4901 00070')).toBe('9002490100070'); });
  it('checkDigitOk', () => { expect(checkDigitOk('90162602')).toBe(true); });
});
describe('lookup', () => {
  it('found', async () => {
    const r = await lookup('90162602', res(200, { status: 1, product: { product_name: 'Red Bull', brands: 'Red Bull', image_front_small_url: 'http://x/y.jpg' } }));
    expect(r).toEqual({ ok: true, name: 'Red Bull', brand: 'Red Bull', imageUrl: 'https://x/y.jpg' });
  });
  it('not found', async () => { expect((await lookup('90162602', res(200, { status: 0 }))).reason).toBe('notfound'); });
  it('rate limited', async () => { expect((await lookup('90162602', res(429))).reason).toBe('ratelimit'); });
  it('network error', async () => { expect((await lookup('90162602', (async () => { throw new Error('x'); }) as unknown as typeof fetch)).reason).toBe('network'); });
  it('bad code never hits network', async () => { expect((await lookup('123', res(200))).reason).toBe('badcode'); });
});
