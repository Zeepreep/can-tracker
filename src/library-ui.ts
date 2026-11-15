import { searchLibrary } from './library';
import { t } from './i18n';
import { esc } from './ui';

/** Full-screen "look it up without scanning" sheet: type what is printed on the can, see language and possible countries. */
export function openLibrary() {
  const sheet = document.createElement('div'); sheet.className = 'sheet';
  sheet.innerHTML = `<div class="sheet-body">
    <h1>${t('Tagline library')}</h1>
    <input id="lib-q" type="search" placeholder="${t('Type what is printed on the can')}" autocapitalize="off" autocorrect="off" spellcheck="false">
    <div id="lib-list"></div>
    <div class="dim" style="font-size:13px;margin:12px 0">${t('Only wording I saw on the official Red Bull websites is listed. Cans from other countries may differ.')}</div>
    <button class="secondary" id="lib-close" style="width:100%">${t('Close')}</button>
  </div>`;
  document.body.appendChild(sheet);
  const q = sheet.querySelector<HTMLInputElement>('#lib-q')!;
  const list = sheet.querySelector<HTMLElement>('#lib-list')!;
  const draw = () => {
    const groups = searchLibrary(q.value, (s) => t(s));
    if (!groups.length) { list.innerHTML = `<div class="card dim">${t('No match. The text may be new, or use a different spelling.')}</div>`; return; }
    list.innerHTML = groups.map((g) => `<div class="card">
      <b>${esc(t(g.language))}</b>
      <div class="dim" style="font-size:14px">${g.countries.length ? esc(t('Possible markets: {countries}', { countries: g.countries.map((c) => t(c)).join(', ') })) : esc(t('This tagline does not identify a country.'))}</div>
      ${g.entries.map((e) => `<div style="margin-top:8px"><div class="quote">“${esc(e.display ?? titleCase(e.phrases[0]))}”</div>
        <div class="dim" style="font-size:12px">${esc(e.kind === 'descriptor' ? t('Body and mind line') : t('Wings slogan'))} · ${esc(t('Seen on: {sites}', { sites: (e.sources ?? []).map(shortSource).join(', ') }))}</div></div>`).join('')}
    </div>`).join('');
  };
  draw();
  q.addEventListener('input', draw);
  sheet.querySelector('#lib-close')!.addEventListener('click', () => sheet.remove());
}

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** "redbull.com/at-de (\"…\")" -> "redbull.com/at-de" */
const shortSource = (s: string) => s.replace(/\s*\(.*$/, '');
