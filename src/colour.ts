// Dominant colour of a can photo: look at the centre, weight by saturation, ignore near-white/near-black
// (glare, shadow, backgrounds), and average the pixels in the winning hue bucket.
export interface Pixels { data: Uint8ClampedArray | number[]; width: number; height: number; }

export function dominantColour(img: Pixels): string | null {
  const { data, width, height } = img;
  const x0 = Math.floor(width * 0.2), x1 = Math.ceil(width * 0.8), y0 = Math.floor(height * 0.15), y1 = Math.ceil(height * 0.85);
  const BUCKETS = 24;
  const w = new Array(BUCKETS).fill(0), sr = new Array(BUCKETS).fill(0), sg = new Array(BUCKETS).fill(0), sb = new Array(BUCKETS).fill(0);
  let greyW = 0, gr = 0, gg = 0, gb = 0;
  const step = Math.max(1, Math.floor(Math.min(width, height) / 160));
  for (let y = y0; y < y1; y += step) for (let x = x0; x < x1; x += step) {
    const i = (y * width + x) * 4;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const v = max / 255, s = max === 0 ? 0 : (max - min) / max;
    if (v < 0.12) continue; // shadow
    if (s < 0.22) { // grey / silver / white: tracked separately
      if (v < 0.97) { greyW++; gr += r; gg += g; gb += b; }
      continue;
    }
    let h: number;
    const d = max - min;
    if (max === r) h = ((g - b) / d + 6) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    const k = Math.min(BUCKETS - 1, Math.floor((h / 6) * BUCKETS));
    const wt = s * v;
    w[k] += wt; sr[k] += r * wt; sg[k] += g * wt; sb[k] += b * wt;
  }
  let best = 0; for (let k = 1; k < BUCKETS; k++) if (w[k] > w[best]) best = k;
  // a silver/grey can has little saturated area; fall back to the grey average then
  if (w[best] < 3 && greyW < 20) return null;
  if (w[best] < greyW * 0.15 && greyW > 20) return hex(gr / greyW, gg / greyW, gb / greyW);
  return hex(sr[best] / w[best], sg[best] / w[best], sb[best] / w[best]);
}

const hex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

export function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** 0 (identical) .. ~441 (opposite) */
export function colourDistance(a: string, b: string): number {
  const [r1, g1, b1] = hexToRgb(a), [r2, g2, b2] = hexToRgb(b);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
}
