let registration: ServiceWorkerRegistration | null = null;

function showUpdateReady(worker: ServiceWorker) {
  const bar = document.getElementById('update-bar');
  const btn = document.getElementById('update-btn');
  if (!bar || !btn) return;
  bar.hidden = false;
  btn.onclick = () => worker.postMessage('skipWaiting');
}

export async function checkForUpdates(): Promise<'ready' | 'downloading' | 'current' | 'unsupported' | 'error'> {
  if (!('serviceWorker' in navigator)) return 'unsupported';
  try {
    const reg = registration ?? await navigator.serviceWorker.getRegistration('./') ?? await navigator.serviceWorker.register('./sw.js');
    registration = reg;
    if (reg.waiting && navigator.serviceWorker.controller) {
      showUpdateReady(reg.waiting);
      return 'ready';
    }
    let found = false;
    reg.addEventListener('updatefound', () => { found = true; }, { once: true });
    await reg.update();
    if (reg.waiting && navigator.serviceWorker.controller) {
      showUpdateReady(reg.waiting);
      return 'ready';
    }
    if (reg.installing || found) return 'downloading';
    return 'current';
  } catch {
    return 'error';
  }
}

export function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    registration = reg;
    if (reg.waiting && navigator.serviceWorker.controller) showUpdateReady(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw?.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) showUpdateReady(nw);
      });
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) reg.update().catch(() => {});
    });
  }).catch(() => { /* app still works online without SW */ });
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    location.reload();
  });
}
