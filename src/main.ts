import './style.css';
import { renderDiagnostics } from './diagnostics';
import { registerSW } from './sw-register';

type Tab = 'scan' | 'collection' | 'wants' | 'more';
const view = document.getElementById('view')!;

function placeholder(title: string, text: string) {
  view.innerHTML = `<h1>${title}</h1><div class="card dim">${text}</div>`;
}

function show(tab: Tab) {
  document.querySelectorAll<HTMLButtonElement>('#tabs button').forEach((b) =>
    b.classList.toggle('active', b.dataset.tab === tab));
  try { localStorage.setItem('tab', tab); } catch { /* ignore */ }
  if (tab === 'scan') placeholder('Scan', 'Coming in the next build.');
  else if (tab === 'collection') placeholder('Collection', 'Coming in the next build.');
  else if (tab === 'wants') placeholder('Wants', 'Coming in the next build.');
  else renderDiagnostics(view);
}

document.getElementById('tabs')!.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-tab]');
  if (t) show(t.dataset.tab as Tab);
});

let start: Tab = 'more'; // M1: diagnostics is the landing screen
try { const s = localStorage.getItem('tab'); if (s === 'scan' || s === 'collection' || s === 'wants' || s === 'more') start = s; } catch { /* ignore */ }
show(start);
registerSW();
