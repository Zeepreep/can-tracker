// Front-of-can text reading. Tesseract.js runs in a worker, fully self-hosted (see scripts/copy-ocr.mjs), English + Czech models: Czech packaging uses diacritics that the English model often misreads.
import { dominantColour } from './colour';

export interface OcrWord { text: string; confidence: number; }
export interface FrontScan { words: OcrWord[]; colour: string | null; }

type Worker = import('tesseract.js').Worker;
let workerP: Promise<Worker> | null = null;
const abs = (p: string) => new URL(p, document.baseURI).href;

async function worker(onStatus?: (s: string) => void): Promise<Worker> {
  workerP ??= (async () => {
    const { createWorker } = await import('tesseract.js');
    const w = await createWorker('eng+ces', 1, {
      workerPath: abs('./ocr/worker.min.js'),
      corePath: abs('./ocr/core/tesseract-core-simd-lstm.wasm.js'),
      langPath: abs('./ocr/lang'),
      gzip: true,
      workerBlobURL: false,
      logger: (m: { status: string; progress: number }) => onStatus?.(m.status),
    });
    await w.setParameters({ tessedit_pageseg_mode: '11' as any, preserve_interword_spaces: '1' });
    return w;
  })();
  try { return await workerP; } catch (e) { workerP = null; throw e; }
}

/** Downscale and return grayscale-contrast canvases: normal and inverted (light text on dark cans). */
function prepare(bmp: ImageBitmap): { canvases: HTMLCanvasElement[]; pixels: ImageData } {
  const MAX = 1400;
  const s = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * s), h = Math.round(bmp.height * s);
  const base = document.createElement('canvas'); base.width = w; base.height = h;
  const bctx = base.getContext('2d', { willReadFrequently: true })!; bctx.drawImage(bmp, 0, 0, w, h);
  const pixels = bctx.getImageData(0, 0, w, h);
  const mk = (invert: boolean) => {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d')!; const out = ctx.createImageData(w, h);
    let lo = 255, hi = 0; const g = new Uint8Array(w * h);
    for (let i = 0, j = 0; i < pixels.data.length; i += 4, j++) {
      const v = Math.round(0.299 * pixels.data[i] + 0.587 * pixels.data[i + 1] + 0.114 * pixels.data[i + 2]);
      g[j] = v; if (v < lo) lo = v; if (v > hi) hi = v;
    }
    const span = Math.max(1, hi - lo);
    for (let j = 0, i = 0; j < g.length; j++, i += 4) {
      let v = ((g[j] - lo) / span) * 255; if (invert) v = 255 - v;
      out.data[i] = out.data[i + 1] = out.data[i + 2] = v; out.data[i + 3] = 255;
    }
    ctx.putImageData(out, 0, 0); return cv;
  };
  return { canvases: [mk(false), mk(true)], pixels };
}

export async function scanFront(file: Blob, onStatus?: (s: string) => void): Promise<FrontScan> {
  const bmp = await createImageBitmap(file);
  const { canvases, pixels } = prepare(bmp);
  const colour = dominantColour(pixels);
  onStatus?.('loading text reader');
  const w = await worker(onStatus);
  const seen = new Map<string, OcrWord>();
  for (const cv of canvases) {
    onStatus?.('reading text');
    const r = await w.recognize(cv, {}, { blocks: true });
    for (const b of r.data.blocks ?? []) for (const p of b.paragraphs) for (const l of p.lines) for (const wd of l.words) {
      const t = wd.text.trim(); if (!t) continue;
      const k = t.toLowerCase(); const prev = seen.get(k);
      if (!prev || wd.confidence > prev.confidence) seen.set(k, { text: t, confidence: wd.confidence });
    }
  }
  return { words: [...seen.values()], colour };
}
