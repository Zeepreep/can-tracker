export function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  const bar = document.getElementById('update-bar')!;
  const btn = document.getElementById('update-btn')!;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    const ready = (w: ServiceWorker) => {
      bar.hidden = false;
      btn.onclick = () => w.postMessage('skipWaiting');
    };
    if (reg.waiting && navigator.serviceWorker.controller) ready(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw?.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) ready(nw);
      });
    });
    // Check for updates whenever the app comes to the foreground.
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  }).catch(() => { /* app still works online without SW */ });
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return; reloaded = true; location.reload();
  });
}
