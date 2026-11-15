// Original, generic can artwork drawn from the data the app already holds: colour, flavour/name, tagline, country, size.
// It deliberately carries no brand marks: a can is told apart by those four things, which is what the collection is organised around.
import { specFor, type CanSpec } from './specs';
import { labelAspect } from './profile';

export interface LabelData { color?: string; name: string; flavor?: string; tagline?: string; country?: string; size?: string; }

/* ---------- pure helpers (unit tested) ---------- */
export function hexToRgb(h: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(h.trim()); const n = m ? parseInt(m[1], 16) : 0x556070;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export function shade(hex: string, amount: number): string { // -1 (black) .. +1 (white)
  const [r, g, b] = hexToRgb(hex); const t = amount < 0 ? 0 : 255; const a = Math.abs(amount);
  return toHex(r + (t - r) * a, g + (t - g) * a, b + (t - b) * a);
}
export function luminance(hex: string): number {
  const f = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  const [r, g, b] = hexToRgb(hex); return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b); const [hi, lo] = la > lb ? [la, lb] : [lb, la]; return (hi + 0.05) / (lo + 0.05);
}
/** White or black, whichever reads better (always >= 4.5:1: the worst case is mid-grey at about 4.58). */
export function readableTextOn(bg: string): string { return contrastRatio('#ffffff', bg) >= contrastRatio('#000000', bg) ? '#ffffff' : '#000000'; }

/** Stable colour for a can that has none chosen (matches the list thumbnails). */
export function defaultColour(name: string): string {
  let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = h % 360, s = 0.45, l = 0.38;
  const k = (n: number) => (n + hue / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return toHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

export const stripBrand = (name: string) => name.replace(/^\s*red\s*bull\b[\s:\-–]*/i, '').trim();

/** Wrap words into lines and shrink the font until the block fits. */
export function fitText(measure: (s: string, px: number) => number, text: string, maxW: number, maxH: number, maxPx: number, minPx: number, lineGap = 1.12) {
  const words = text.split(/\s+/).filter(Boolean);
  for (let px = maxPx; px >= minPx; px -= 2) {
    const lines: string[] = []; let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (measure(t, px) <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    if (lines.every((l) => measure(l, px) <= maxW) && lines.length * px * lineGap <= maxH) return { px, lines };
  }
  return { px: minPx, lines: words.length ? [words.join(' ')] : [] };
}

/* ---------- drawing ---------- */
export const LABEL_W = 2048;
export const labelSize = (spec: CanSpec) => ({ w: LABEL_W, h: Math.round(LABEL_W / labelAspect(spec)) });

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export function drawLabel(cv: HTMLCanvasElement, d: LabelData) {
  const spec = specFor(d.size);
  const { w: W, h: H } = labelSize(spec);
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d')!;
  const base = /^#[0-9a-f]{6}$/i.test(d.color ?? '') ? d.color! : defaultColour(d.name || 'can');
  const dark = shade(base, -0.38), light = shade(base, 0.22);
  const FRONT = W / 2, FW = W * 0.34;
  const measure = (s: string, px: number, weight = 700, style = '') => { ctx.font = `${style} ${weight} ${px}px ${FONT}`; return ctx.measureText(s).width; };

  // background
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, shade(base, 0.12)); g.addColorStop(0.5, base); g.addColorStop(1, shade(base, -0.18));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // diagonal stripes
  ctx.save(); ctx.strokeStyle = shade(base, 0.1); ctx.globalAlpha = 0.35; ctx.lineWidth = H * 0.03;
  for (let x = -H; x < W + H; x += H * 0.16) { ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x + H * 0.5, 0); ctx.stroke(); }
  ctx.restore();
  // top and bottom bands
  const band = H * 0.085;
  ctx.fillStyle = dark; ctx.fillRect(0, 0, W, band); ctx.fillRect(0, H - band, W, band);
  ctx.fillStyle = light; ctx.fillRect(0, band, W, H * 0.008); ctx.fillRect(0, H - band - H * 0.008, W, H * 0.008);

  const bandText = readableTextOn(dark);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = bandText;
  const volume = `${spec.volumeMl} ml`;
  for (let k = 0; k < 3; k++) { // 3 evenly spaced copies (front + two sides); none sits on the seam
    const cx = (FRONT + k * (W / 3)) % W;
    ctx.font = `700 ${band * 0.42}px ${FONT}`; ctx.fillText('E N E R G Y   D R I N K', cx, band / 2);
    ctx.font = `600 ${band * 0.42}px ${FONT}`; ctx.fillText(volume, cx, H - band / 2);
  }

  // front block
  const text = readableTextOn(base);
  const title = (d.flavor?.trim() || stripBrand(d.name)) || '';
  const subtitle = d.flavor?.trim() ? stripBrand(d.name) : '';
  let y = H * 0.17;
  if (subtitle) {
    const f = fitText((s, px) => measure(s, px, 600), subtitle.toUpperCase(), FW, H * 0.12, H * 0.05, H * 0.028);
    ctx.fillStyle = text; ctx.globalAlpha = 0.85; ctx.font = `600 ${f.px}px ${FONT}`;
    f.lines.forEach((l, i) => ctx.fillText(l, FRONT, y + i * f.px * 1.12)); ctx.globalAlpha = 1; y += f.lines.length * f.px * 1.12 + H * 0.03;
  }
  const t = fitText((s, px) => measure(s, px, 800), title.toUpperCase(), FW, H * 0.27, H * 0.13, H * 0.04, 1.05);
  ctx.fillStyle = text; ctx.font = `800 ${t.px}px ${FONT}`;
  t.lines.forEach((l, i) => ctx.fillText(l, FRONT, y + t.px * 0.55 + i * t.px * 1.05));
  y += t.lines.length * t.px * 1.05 + H * 0.05;
  if (d.tagline?.trim()) {
    const pillTop = H - band - H * 0.06 - H * 0.038 * 1.9 - H * 0.02; // keep clear of the country pill
    const room = Math.max(H * 0.06, pillTop - y);
    const f = fitText((s, px) => measure(s, px, 500, 'italic'), d.tagline.trim(), FW, room, H * 0.052, H * 0.022, 1.18);
    ctx.fillStyle = text; ctx.font = `italic 500 ${f.px}px ${FONT}`;
    f.lines.forEach((l, i) => ctx.fillText(l, FRONT, y + f.px * 0.6 + i * f.px * 1.18));
  }
  // country pill
  if (d.country?.trim()) {
    const c = d.country.trim().toUpperCase(); const px = H * 0.038; ctx.font = `700 ${px}px ${FONT}`;
    const tw = Math.min(FW, ctx.measureText(c).width), pw = tw + px * 1.6, ph = px * 1.9, py = H - band - H * 0.06 - ph;
    ctx.fillStyle = dark; ctx.beginPath(); ctx.roundRect(FRONT - pw / 2, py, pw, ph, ph / 2); ctx.fill();
    ctx.fillStyle = readableTextOn(dark); ctx.fillText(c, FRONT, py + ph / 2 + px * 0.04, FW);
  }
  // back: small repeat of the title so the can is readable from behind too (wraps over the seam)
  const bt = fitText((s, px) => measure(s, px, 700), title.toUpperCase(), W * 0.16, H * 0.2, H * 0.05, H * 0.025);
  ctx.fillStyle = text; ctx.globalAlpha = 0.8; ctx.font = `700 ${bt.px}px ${FONT}`;
  for (const cx of [0, W]) bt.lines.forEach((l, i) => ctx.fillText(l, cx, H * 0.46 + i * bt.px * 1.2));
  ctx.globalAlpha = 1;
  return cv;
}
