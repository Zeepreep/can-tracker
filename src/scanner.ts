import { cleanBarcode } from './off';
import { t } from './i18n';

type Reader = typeof import('zxing-wasm/reader');
let readerP: Promise<Reader> | null = null;

async function reader(): Promise<Reader> {
  readerP ??= (async () => {
    const mod = await import('zxing-wasm/reader');
    const wasmUrl = new URL('./zxing_reader.wasm', document.baseURI).href;
    await mod.prepareZXingModule({ overrides: { locateFile: (p: string, prefix: string) => (p.endsWith('.wasm') ? wasmUrl : prefix + p) }, fireImmediately: true } as any);
    return mod;
  })();
  try { return await readerP; } catch (e) { readerP = null; throw e; }
}

const OPTS = { formats: ['EAN-13', 'EAN-8', 'UPC-A', 'UPC-E'] as any, tryHarder: true, maxNumberOfSymbols: 1 };

/** Decode a barcode from an ImageData / Blob. Returns a validated digit string or null. */
export async function decode(src: ImageData | Blob): Promise<string | null> {
  const { readBarcodes } = await reader();
  const results = await readBarcodes(src as any, OPTS);
  for (const r of results) {
    const c = cleanBarcode(r.text);
    if (c) return c;
  }
  return null;
}

/** Decode from a photo the user took/picked (works even when live camera is broken). */
export async function decodePhoto(file: File): Promise<string | null> {
  try {
    const bmp = await createImageBitmap(file);
    const scales = [1, 0.5];
    for (const s of scales) {
      const w = Math.round(bmp.width * s), h = Math.round(bmp.height * s);
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d')!; ctx.drawImage(bmp, 0, 0, w, h);
      const code = await decode(ctx.getImageData(0, 0, w, h));
      if (code) return code;
    }
    return null;
  } catch {
    return decode(file);
  }
}

export interface LiveScan { stop(): void; }

/** Live camera scan; onCode fires once per confirmed code (2 consistent reads). */
export async function startLive(video: HTMLVideoElement, onCode: (c: string) => void, onError: (m: string) => void): Promise<LiveScan> {
  let stopped = false;
  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
  } catch (e) {
    const name = (e as DOMException)?.name;
    onError(name === 'NotAllowedError' ? t('Camera permission was denied. You can type the number or take a photo instead.') : t('Camera not available. You can type the number or take a photo instead.'));
    return { stop() {} };
  }
  video.srcObject = stream;
  video.setAttribute('playsinline', 'true');
  video.muted = true;
  try { await video.play(); } catch { onError(t('Camera could not start. Use photo or type the number.')); }
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  let last = '', count = 0;
  const loop = async () => {
    if (stopped) return;
    if (video.videoWidth) {
      // centre crop of the frame: where the on-screen guide sits
      const cw = Math.round(video.videoWidth * 0.8), ch = Math.round(video.videoHeight * 0.4);
      cv.width = cw; cv.height = ch;
      ctx.drawImage(video, (video.videoWidth - cw) / 2, (video.videoHeight - ch) / 2, cw, ch, 0, 0, cw, ch);
      try {
        const code = await decode(ctx.getImageData(0, 0, cw, ch));
        if (code) { count = code === last ? count + 1 : 1; last = code; if (count >= 2 && !stopped) { stopped = true; onCode(code); return; } }
        else { count = 0; last = ''; }
      } catch { /* decoder hiccup: keep going */ }
    }
    setTimeout(loop, 120);
  };
  loop();
  return { stop() { stopped = true; stream?.getTracks().forEach((t) => t.stop()); video.srcObject = null; } };
}
