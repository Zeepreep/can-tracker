declare const __BUILD_TIME__: string;

type Result = { name: string; status: 'pass' | 'fail' | 'warn'; detail: string };

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout ' + ms + 'ms')), ms))]);

export async function runChecks(): Promise<Result[]> {
  const out: Result[] = [];
  const add = (name: string, status: Result['status'], detail: string) => out.push({ name, status, detail });
  const run = async (name: string, fn: () => Promise<[Result['status'], string]>) => {
    try { const [s, d] = await fn(); add(name, s, d); } catch (e) { add(name, 'fail', String((e as Error)?.message ?? e)); }
  };

  add('Build', 'pass', __BUILD_TIME__);
  add('User agent', 'pass', navigator.userAgent);
  const standalone = (navigator as any).standalone === true || matchMedia('(display-mode: standalone)').matches;
  add('Installed to Home Screen', standalone ? 'pass' : 'warn', standalone ? 'yes (standalone)' : 'no, running in Safari tab');

  await run('IndexedDB', async () => {
    const name = 'diag-' + Date.now();
    await withTimeout(new Promise<void>((res, rej) => {
      const r = indexedDB.open(name, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('s');
      r.onsuccess = () => {
        const tx = r.result.transaction('s', 'readwrite');
        tx.objectStore('s').put('ok', 'k');
        tx.oncomplete = () => { r.result.close(); indexedDB.deleteDatabase(name); res(); };
        tx.onerror = () => rej(tx.error);
      };
      r.onerror = () => rej(r.error);
    }), 4000);
    return ['pass', 'read/write works'];
  });

  await run('Persistent storage', async () => {
    if (!navigator.storage?.persist) return ['warn', 'API not available'];
    const was = await navigator.storage.persisted();
    const now = was || (await navigator.storage.persist());
    const est = navigator.storage.estimate ? await navigator.storage.estimate() : {};
    const mb = ((est.usage ?? 0) / 1048576).toFixed(1) + ' / ' + ((est.quota ?? 0) / 1048576).toFixed(0) + ' MB';
    return [now ? 'pass' : 'warn', (now ? 'persisted' : 'not granted (export backups matter)') + ', ' + mb];
  });

  await run('Service worker', async () => {
    if (!('serviceWorker' in navigator)) return ['fail', 'not supported'];
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return ['warn', 'not registered yet (reload once)'];
    const cacheKeys = (await caches.keys()).filter((k) => k.startsWith('can-tracker-'));
    return [navigator.serviceWorker.controller ? 'pass' : 'warn', 'active=' + !!reg.active + ', controlling=' + !!navigator.serviceWorker.controller + ', cache=' + (cacheKeys[0] ?? 'none')];
  });

  await run('Camera API', async () => {
    if (!navigator.mediaDevices?.getUserMedia) return ['fail', 'getUserMedia not available'];
    return ['pass', 'available (permission is asked on first scan)'];
  });

  await run('Barcode engine (zxing wasm)', async () => {
    const { prepareZXingModule } = await import('zxing-wasm/reader');
    const wasmUrl = new URL('./zxing_reader.wasm', document.baseURI).href;
    const t = performance.now();
    await withTimeout(Promise.resolve(prepareZXingModule({ overrides: { locateFile: (p: string, prefix: string) => (p.endsWith('.wasm') ? wasmUrl : prefix + p) }, fireImmediately: true } as any) as unknown), 15000);
    return ['pass', 'loaded in ' + Math.round(performance.now() - t) + ' ms'];
  });

  await run('Open Food Facts reachable from browser', async () => {
    const url = 'https://world.openfoodfacts.org/api/v2/product/90162602.json?fields=code,product_name,brands,image_front_small_url&app_name=can-tracker&app_version=0.1';
    const r = await withTimeout(fetch(url), 10000);
    const j = await r.json();
    return [r.ok ? 'pass' : 'warn', 'HTTP ' + r.status + ', status=' + j.status + ', name=' + (j.product?.product_name ?? '-')];
  });

  await run('GitHub API reachable from browser', async () => {
    const r = await withTimeout(fetch('https://api.github.com/zen'), 10000);
    return [r.ok ? 'pass' : 'warn', 'HTTP ' + r.status];
  });

  return out;
}

export function renderDiagnostics(root: HTMLElement) {
  root.innerHTML = `<h1>More</h1><h2>Self-check</h2>
    <div class="card" id="diag"><span class="dim">Running…</span></div>
    <button class="primary" id="diag-rerun">Run again</button>
    <button class="secondary" id="diag-copy">Copy report</button>
    <h2>Report</h2><textarea id="diag-text" readonly></textarea>`;
  const box = root.querySelector<HTMLElement>('#diag')!;
  const text = root.querySelector<HTMLTextAreaElement>('#diag-text')!;
  const go = async () => {
    box.innerHTML = '<span class="dim">Running…</span>';
    const res = await runChecks();
    box.innerHTML = res.map((r) => `<div class="row"><span>${esc(r.name)}</span><span class="${r.status}">${r.status.toUpperCase()}</span></div><div class="dim" style="font-size:13px;word-break:break-all">${esc(r.detail)}</div>`).join('');
    text.value = res.map((r) => `[${r.status}] ${r.name}: ${r.detail}`).join('\n');
  };
  root.querySelector('#diag-rerun')!.addEventListener('click', go);
  root.querySelector('#diag-copy')!.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(text.value); } catch { text.select(); document.execCommand('copy'); }
  });
  go();
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
