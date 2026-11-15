import type { CanSpec } from './specs';

export type P = [number, number]; // [radius, y] in mm; y = 0 is the table

export interface CanProfile {
  base: P[];      // unprinted: dome, standing ring, heel
  body: P[];      // printed: straight wall
  top: P[];       // unprinted: shoulder, neck, double seam
  lid: P[];       // unprinted: countersink and lid panel
  bodyBottom: number; bodyTop: number; bodyHeight: number;
}

// Not in the manufacturer specs (typical shapes, purely visual): dome depth, heel size, shoulder length, lid recess.
const DOME = 9, HEEL_TOP = 6, LID_RECESS = 5.5;

/** Smooth S-curve between two points (cosine ease), n segments. */
function ease(r0: number, y0: number, r1: number, y1: number, n: number): P[] {
  const out: P[] = [];
  for (let i = 1; i <= n; i++) { const t = i / n; const s = (1 - Math.cos(Math.PI * t)) / 2; out.push([r0 + (r1 - r0) * s, y0 + (y1 - y0) * t]); }
  return out;
}

export function canProfile(s: CanSpec): CanProfile {
  const R = s.diameter / 2, standR = s.standDia / 2, neckR = s.neckPlugDia / 2;
  // The double seam never sticks out past the body (cans stack and slide through machines), whatever the pre-seaming flange measures.
  const flangeR = Math.min(s.flangeDia / 2, R);
  const H = s.height;
  const shoulderLen = Math.max(12, (R - neckR) * 2.6);          // taper from body to neck
  const bodyTop = H - s.neckHeight - shoulderLen;
  const bodyBottom = HEEL_TOP;

  const base: P[] = [
    [0, DOME], [standR * 0.45, DOME * 0.93], [standR * 0.8, DOME * 0.55], [standR - 1.0, 1.6],
    [standR - 0.35, 0.35], [standR, 0], [standR + 0.7, 0.25], [standR + 1.4, 0.9],
    ...ease(standR + 1.4, 0.9, R, bodyBottom, 8),
  ];
  const body: P[] = [[R, bodyBottom], [R, bodyTop]];
  const top: P[] = [
    [R, bodyTop],
    ...ease(R, bodyTop, neckR, bodyTop + shoulderLen, 14),
    [neckR, H - 2.4],
    [neckR + 1.4, H - 2.2], [flangeR - 0.2, H - 1.6], [flangeR, H - 0.9], [flangeR - 0.5, H], [flangeR - 1.4, H],
  ];
  const lid: P[] = [
    [flangeR - 1.4, H], [flangeR - 2.6, H - 0.9], [flangeR - 3.6, H - LID_RECESS + 0.6],
    [flangeR - 4.4, H - LID_RECESS], [0, H - LID_RECESS + 0.35],
  ];
  return { base, body, top, lid, bodyBottom, bodyTop, bodyHeight: bodyTop - bodyBottom };
}

/** Width : height of the printed wall, i.e. the aspect of the label texture. */
export function labelAspect(s: CanSpec): number {
  const p = canProfile(s);
  return (Math.PI * s.diameter) / p.bodyHeight;
}
