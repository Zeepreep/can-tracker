import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { readdirSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

// After build: write a service worker whose cache name is a hash of all built files,
// so every deploy invalidates the old cache and the app shows an "update ready" bar.
function swPlugin(): Plugin {
  let outDir = 'docs';
  return {
    name: 'can-tracker-sw',
    apply: 'build',
    configResolved(c) { outDir = c.build.outDir; },
    closeBundle() {
      const files = walk(outDir).filter((f) => !f.endsWith('sw.js') && !f.endsWith('.nojekyll'));
      const rel = files.map((f) => './' + relative(outDir, f).split('\\').join('/')).filter((f) => !f.startsWith('./ocr/'));
      const h = createHash('sha1');
      for (const f of files.sort()) h.update(f).update(readFileSync(f));
      const version = h.digest('hex').slice(0, 10);
      const tpl = readFileSync('scripts/sw-template.js', 'utf8')
        .replace('__VERSION__', version)
        .replace('__FILES__', JSON.stringify(['./', ...rel]));
      writeFileSync(join(outDir, 'sw.js'), tpl);
      writeFileSync(join(outDir, '.nojekyll'), '');
      writeFileSync(join(outDir, 'version.txt'), version + '\n');
    },
  };
}

export default defineConfig({
  base: './',
  build: { outDir: 'docs', emptyOutDir: true, target: 'es2020' },
  plugins: [swPlugin()],
  define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString()) },
  test: { environment: 'happy-dom', setupFiles: ['./tests/setup.ts'] },
});
