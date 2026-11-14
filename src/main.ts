import './style.css';
import { renderMore } from './more';
import { backupDue } from './backup';
import { registerSW } from './sw-register';
import { renderList, renderScan, stopScan } from './ui';

type Tab = 'scan' | 'collection' | 'wants' | 'more';
const view = document.getElementById('view')!;


function show(tab: Tab) {
  document.querySelectorAll<HTMLButtonElement>('#tabs button').forEach((b) =>
    b.classList.toggle('active', b.dataset.tab === tab));
  try { localStorage.setItem('tab', tab); } catch { /* ignore */ }
  stopScan();
  if (tab === 'scan') renderScan(view);
  else if (tab === 'collection') renderList(view, 'have');
  else if (tab === 'wants') renderList(view, 'want');
  else renderMore(view);
}

document.getElementById('tabs')!.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-tab]');
  if (t) show(t.dataset.tab as Tab);
});

let start: Tab = 'collection';
try { const s = localStorage.getItem('tab'); if (s === 'scan' || s === 'collection' || s === 'wants' || s === 'more') start = s; } catch { /* ignore */ }
show(start);
registerSW();
// Ask the browser to keep our data; harmless if refused.
try { navigator.storage?.persist?.(); } catch { /* ignore */ }
backupDue().then((due) => { if (due) document.getElementById('tabs')!.querySelector('[data-tab=more]')!.classList.add('badge'); }).catch(() => {});
