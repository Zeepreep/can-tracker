// Copies the self-hosted OCR assets from node_modules into public/ocr (run by `npm run build`).
import { mkdirSync, copyFileSync, existsSync } from 'node:fs';
const jobs = [
  ['node_modules/tesseract.js/dist/worker.min.js', 'public/ocr/worker.min.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'public/ocr/core/tesseract-core-simd-lstm.wasm.js'],
  ['node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', 'public/ocr/lang/eng.traineddata.gz'],
  ['node_modules/@tesseract.js-data/ces/4.0.0_best_int/ces.traineddata.gz', 'public/ocr/lang/ces.traineddata.gz'],
];
mkdirSync('public/ocr/core', { recursive: true });
mkdirSync('public/ocr/lang', { recursive: true });
for (const [from, to] of jobs) {
  if (!existsSync(from)) throw new Error('missing ' + from);
  copyFileSync(from, to);
}
