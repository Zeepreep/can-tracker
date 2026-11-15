import type { Can, Status } from './types';
import { allCans, saveCan, deleteCan, restoreCan, markHave, findByBarcode } from './db';
import { buildIndex, search } from './search';
import { lookup, cleanBarcode } from './off';
import { decodePhoto, startLive, type LiveScan } from './scanner';
import { scanFront } from './ocr';
import { queryTokens, rankCans, guessName, countryFromTaglines } from './identify';
import { recognizeTagline } from './country-recognition';
import { detectLanguage, COUNTRIES, type LangCode } from './lang';
import { t } from './i18n';

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function colorFor(c: Can): string {
  if (c.color) return c.color;
  let h = 0; for (const ch of c.name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `hsl(${h % 360} 45% 38%)`;
}
export function thumb(c: Can): string {
  const initials = esc(c.name.replace(/red bull/i, '').trim().slice(0, 2).toUpperCase() || 'RB');
  const card = `<div class="thumb" style="background:${colorFor(c)}">${initials}</div>`;
  return c.imageUrl
    ? `<div class="thumbwrap"><img class="thumb" src="${esc(c.imageUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.innerHTML=this.dataset.fb" data-fb="${esc(card)}"></div>`
    : `<div class="thumbwrap">${card}</div>`;
}

function toast(msg: string) {
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg;
  document.body.appendChild(el); setTimeout(() => el.remove(), 2600);
}

/* ---------- Can form (sheet) ---------- */
export function openForm(can: Partial<Can>, done: () => void) {
  const isEdit = !!can.id;
  const sheet = document.createElement('div'); sheet.className = 'sheet';
  const f = (k: keyof Can) => esc(String(can[k] ?? ''));
  sheet.innerHTML = `<div class="sheet-body">
    <h1>${isEdit ? t('Edit can') : t('Add can')}</h1>
    <label>${t('Name')}<input id="f-name" value="${f('name')}" placeholder="Red Bull Winter Edition Iced Vita Berry" autocapitalize="words"></label>
    <label>${t('Flavor')}<input id="f-flavor" value="${f('flavor')}" placeholder="${t('e.g. Kaktusfeige / cactus fruit')}"></label>
    <label>${t('Tagline on can')}<input id="f-tagline" value="${f('tagline')}"></label>
    <label>${t('Country / language')}<input id="f-country" value="${f('country')}" placeholder="${t('Germany')}"></label>
    <label>${t('Barcode')}<input id="f-barcode" value="${f('barcode')}" inputmode="numeric"></label>
    <label>${t('Notes')}<input id="f-notes" value="${f('notes')}"></label>
    <div class="seg"><button type="button" data-s="have" class="${(can.status ?? 'have') === 'have' ? 'on' : ''}">${t('Have it')}</button><button type="button" data-s="want" class="${can.status === 'want' ? 'on' : ''}">${t('Want it')}</button></div>
    <div id="f-err" class="fail"></div>
    <button class="primary" id="f-save" style="width:100%">${t('Save')}</button>
    <button class="secondary" id="f-cancel" style="width:100%;margin-top:8px">${t('Cancel')}</button>
    ${isEdit ? `<button class="secondary" id="f-del" style="width:100%;margin-top:8px;color:var(--bad)">${t('Delete')}</button>` : ''}
  </div>`;
  document.body.appendChild(sheet);
  let status: Status = can.status ?? 'have';
  const val = (id: string) => (sheet.querySelector<HTMLInputElement>('#' + id)!.value.trim());
  sheet.querySelectorAll<HTMLButtonElement>('.seg button').forEach((b) => b.addEventListener('click', () => {
    status = b.dataset.s as Status; sheet.querySelectorAll('.seg button').forEach((x) => x.classList.toggle('on', x === b));
  }));
  const close = () => sheet.remove();
  sheet.querySelector('#f-cancel')!.addEventListener('click', close);
  sheet.querySelector('#f-save')!.addEventListener('click', async () => {
    const err = sheet.querySelector<HTMLElement>('#f-err')!;
    const name = val('f-name');
    if (!name) { err.textContent = t('Please enter a name.'); return; }
    const bcRaw = val('f-barcode');
    const barcode = bcRaw ? cleanBarcode(bcRaw) : null;
    if (bcRaw && !barcode) { err.textContent = t('That barcode number does not look right. Check the digits or clear the field.'); return; }
    if (barcode) {
      const dup = await findByBarcode(barcode);
      if (dup && dup.id !== can.id && !confirm(t('"{name}" already has this barcode. Save anyway?', { name: dup.name }))) return;
    }
    try {
      await saveCan({ ...can, name, flavor: val('f-flavor') || undefined, tagline: val('f-tagline') || undefined, country: val('f-country') || undefined, barcode: barcode ?? undefined, notes: val('f-notes') || undefined, status });
    } catch { err.textContent = t('Could not save. Storage may be full or blocked.'); return; }
    close(); done();
  });
  sheet.querySelector('#f-del')?.addEventListener('click', async () => {
    if (!can.id || !confirm(t('Delete this can?'))) return;
    await deleteCan(can.id); close();
    const el = document.createElement('div'); el.className = 'toast';
    el.innerHTML = `${t('Deleted')} <button id="undo">${t('Undo')}</button>`; document.body.appendChild(el);
    el.querySelector('#undo')!.addEventListener('click', async () => { await restoreCan(can.id!); el.remove(); done(); });
    setTimeout(() => el.remove(), 6000); done();
  });
}

/* ---------- Collection / Wants list ---------- */
export async function renderList(root: HTMLElement, status: Status) {
  const title = status === 'have' ? t('Collection') : t('Wants');
  root.innerHTML = `<h1>${title} <span class="dim" id="count"></span></h1>
    <input id="q" type="search" placeholder="${t('Search flavor, tagline, country…')}" autocapitalize="off" autocorrect="off" spellcheck="false">
    <div id="list"></div>
    <button class="fab" id="add" aria-label="${t('Add can')}">+</button>`;
  const all = (await allCans()).filter((c) => c.status === status);
  const ms = buildIndex(all);
  const list = root.querySelector<HTMLElement>('#list')!;
  const q = root.querySelector<HTMLInputElement>('#q')!;
  const draw = () => {
    const ids = search(ms, q.value);
    const byId = new Map(all.map((c) => [c.id, c]));
    const shown = ids ? ids.map((i) => byId.get(i)!).filter(Boolean) : [...all].sort((a, b) => b.updatedAt - a.updatedAt);
    root.querySelector('#count')!.textContent = ids ? t('{a} of {b}', { a: shown.length, b: all.length }) : String(all.length);
    if (!shown.length) {
      list.innerHTML = `<div class="card dim">${all.length ? t('No cans match that search.') : status === 'have' ? t('No cans yet. Tap + or use Scan.') : t('Nothing on your wants list. Tap + to add a can you saw online.')}</div>`;
      return;
    }
    list.innerHTML = shown.map((c) => `<div class="can" data-id="${c.id}">${thumb(c)}<div class="meta"><div class="nm">${esc(c.name)}</div><div class="dim sub">${esc([c.flavor, c.country].filter(Boolean).join(' · '))}</div></div>${status === 'want' ? '<button class="found" data-found="' + c.id + '">' + t('Found it') + '</button>' : ''}</div>`).join('');
  };
  draw();
  q.addEventListener('input', draw);
  list.addEventListener('click', async (e) => {
    const tg = e.target as HTMLElement;
    const found = tg.closest<HTMLElement>('[data-found]');
    if (found) { await markHave(found.dataset.found!); toast(t('Moved to your collection')); renderList(root, status); return; }
    const row = tg.closest<HTMLElement>('.can');
    if (row) { const c = all.find((x) => x.id === row.dataset.id); if (c) openForm(c, () => renderList(root, status)); }
  });
  root.querySelector('#add')!.addEventListener('click', () => openForm({ status }, () => renderList(root, status)));
}

/* ---------- Scan ---------- */
let live: LiveScan | null = null;
export function stopScan() { live?.stop(); live = null; }

export function renderScan(root: HTMLElement) {
  stopScan();
  root.innerHTML = `<h1>${t('Scan')}</h1>
    <div id="cam" hidden><div class="camwrap"><video id="vid" playsinline muted></video><div class="guide"></div></div><button class="secondary" id="cam-stop" style="width:100%">${t('Stop camera')}</button></div>
    <div id="scan-actions">
      <button class="primary" id="cam-start" style="width:100%">${t('Scan with camera')}</button>
      <label class="btn secondary filebtn">${t('Take or pick a photo of the barcode')}<input type="file" id="photo" accept="image/*" capture="environment" hidden></label>
      <button class="secondary" id="front-btn" style="width:100%;margin:8px 0">${t("Can't scan it? Photograph the front instead")}</button>
      <input type="file" id="front" accept="image/*" capture="environment" hidden>
      <div class="typed"><input id="digits" inputmode="numeric" placeholder="${t('Or type the barcode digits')}"><button class="secondary" id="digits-go">${t('Look up')}</button></div>
    </div>
    <div id="msg" class="dim"></div><div id="result"></div>`;
  const msg = root.querySelector<HTMLElement>('#msg')!;
  const result = root.querySelector<HTMLElement>('#result')!;
  const cam = root.querySelector<HTMLElement>('#cam')!;
  const actions = root.querySelector<HTMLElement>('#scan-actions')!;

  let pendingBarcode: string | undefined;
  const tryFront = `<button class="secondary" data-act="front" style="width:100%;margin-top:8px">${t('Try the front of the can instead')}</button>`;
  const handle = async (code: string) => {
    pendingBarcode = undefined;
    stopScan(); cam.hidden = true; actions.hidden = false; msg.textContent = '';
    if (navigator.vibrate) navigator.vibrate(40);
    const have = await findByBarcode(code);
    if (have) {
      result.innerHTML = `<div class="card ${have.status === 'have' ? 'ok' : ''}"><div class="can" style="border:0">${thumb(have)}<div class="meta"><div class="nm">${esc(have.name)}</div><div class="dim sub">${have.status === 'have' ? t('You already have this one ✓') : t('On your wants list')}</div></div></div>${have.status === 'want' ? `<button class="primary" id="found" style="width:100%">${t('Found it! Add to collection')}</button>` : ''}</div>`;
      result.querySelector('#found')?.addEventListener('click', async () => { await markHave(have.id); renderScan(root); toast(t('Added to your collection')); });
      return;
    }
    pendingBarcode = code;
    result.innerHTML = `<div class="card dim">${t('New barcode. Looking it up…')}</div>`;
    const r = await lookup(code);
    const prefill: Partial<Can> = { barcode: code, status: 'have', name: r.ok ? [r.name].filter(Boolean).join('') : '', imageUrl: r.imageUrl };
    const note = r.ok ? t('Found on Open Food Facts. Check the name and fill in the flavor.') : r.reason === 'notfound' ? t('Not in Open Food Facts. Fill it in yourself.') : r.reason === 'ratelimit' ? t('Lookup is busy right now. Fill it in yourself.') : t('No internet lookup right now. Fill it in yourself.');
    result.innerHTML = `<div class="card">${r.imageUrl ? thumb(prefill as Can) : ''}<div class="dim">${note}</div><div class="dim">${esc(t('Barcode {code}', { code }))}</div><button class="primary" id="addnew" style="width:100%;margin-top:8px">${t('Add this can')}</button>${r.ok ? '' : tryFront}</div>`;
    result.querySelector('#addnew')!.addEventListener('click', () => openForm(prefill, () => renderScan(root)));
  };

  const fromDigits = async () => {
    const v = root.querySelector<HTMLInputElement>('#digits')!.value;
    const c = cleanBarcode(v);
    if (!c) { msg.innerHTML = `<span class="fail">${t('That number does not look right. Check each digit (8 or 13 digits).')}</span>`; return; }
    handle(c);
  };
  root.querySelector('#digits-go')!.addEventListener('click', fromDigits);
  root.querySelector('#digits')!.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') fromDigits(); });

  root.querySelector<HTMLInputElement>('#photo')!.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return;
    msg.textContent = t('Reading barcode…');
    try {
      const c = await decodePhoto(file);
      if (c) handle(c); else msg.innerHTML = `<span class="warn">${t('No barcode found in that photo. Try closer, flatter and with more light, or type the digits.')}</span>` + tryFront;
    } catch { msg.innerHTML = `<span class="fail">${t('Could not read that photo. Type the digits instead.')}</span>`; }
  });

  root.querySelector('#cam-start')!.addEventListener('click', async () => {
    result.innerHTML = ''; msg.textContent = t('Starting camera… hold the barcode inside the box.');
    cam.hidden = false; actions.hidden = true;
    live = await startLive(root.querySelector<HTMLVideoElement>('#vid')!, handle, (m) => { cam.hidden = true; actions.hidden = false; msg.innerHTML = `<span class="warn">${esc(m)}</span>` + tryFront; });
  });
  root.querySelector('#cam-stop')!.addEventListener('click', () => { stopScan(); cam.hidden = true; actions.hidden = false; msg.textContent = ''; });

  /* ----- front-of-can recognition: read text + colour, suggest which can it is ----- */
  root.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('[data-act=front]')) root.querySelector<HTMLInputElement>('#front')!.click(); });
  root.querySelector('#front-btn')!.addEventListener('click', () => root.querySelector<HTMLInputElement>('#front')!.click());
  root.querySelector<HTMLInputElement>('#front')!.addEventListener('change', async (e) => {
    const input = e.target as HTMLInputElement; const file = input.files?.[0]; if (!file) return;
    stopScan(); cam.hidden = true; actions.hidden = false; result.innerHTML = '';
    msg.textContent = t('Reading the can… the first time takes a little longer.');
    try {
      const scan = await scanFront(file, (st) => { msg.textContent = st === 'loading language traineddata' || st === 'loading tesseract core' ? t('Loading the text reader (first time only)…') : st === 'reading text' ? t('Reading the text…') : msg.textContent; });
      msg.textContent = '';
      const pool = (await allCans()).filter((c) => !c.deleted);
      const correctedTokens = queryTokens(scan.words, 25, pool);
      const cands = rankCans(correctedTokens, pool);
      const readText = correctedTokens.map((word) => word[0].toUpperCase() + word.slice(1)).join(' ');
      const read = `<div class="dim" style="font-size:13px;margin-top:6px;word-break:break-word">${readText ? esc(t('Recognized product text: ')) + esc(readText) : t('No reliable product words matched your collection. Try a closer, straighter photo of the can.')}</div>`;
      // Where is this can from? In order of trust: (1) a tagline he already saved with a country, (2) a complete known tagline, (3) a word-based language guess.
      const learned = countryFromTaglines(scan.words, pool);
      const tagline = learned ? null : recognizeTagline(scan.words);
      const lg = learned || tagline ? null : detectLanguage(scan.words);
      const langName: Record<LangCode, string> = { en: t('English'), nl: t('Dutch'), de: t('German'), pl: t('Polish'), fr: t('French'), es: t('Spanish'), it: t('Italian'), sv: t('Swedish'), pt: t('Portuguese'), cs: t('Czech') };
      const guessedCountry = learned?.country ?? (tagline ? (tagline.possibleCountries[0] ? t(tagline.possibleCountries[0]) : undefined) : lg && COUNTRIES[lg.lang].length ? t(COUNTRIES[lg.lang][0]) : undefined);
      const hintLines: string[] = learned
        ? [t('Tagline known from "{name}": {country}', { name: learned.from, country: learned.country })]
        : tagline
          ? [t('Tagline language: {language}', { language: t(tagline.language) }), tagline.possibleCountries.length ? t('Possible markets: {countries}', { countries: tagline.possibleCountries.map((c) => t(c)).join(', ') }) : t('This tagline does not identify a country.')]
          : lg
            ? [COUNTRIES[lg.lang].length ? t('Language read: {lang}. Possible country: {countries}', { lang: langName[lg.lang], countries: COUNTRIES[lg.lang].map((c) => t(c)).join(' / ') }) : t('Language read: {lang}. English says nothing about the country.', { lang: langName[lg.lang] })]
            : [];
      const countryHint = hintLines.length ? `<div class="dim" style="font-size:13px;margin-top:6px">🌍 ${hintLines.map(esc).join('<br>')}</div>` : '';
      const swatch = scan.colour ? `<span class="swatch" style="background:${scan.colour}"></span>` : '';
      const addNew = () => openForm({ status: 'have', name: guessName(scan.words, pool), color: scan.colour ?? undefined, country: guessedCountry, barcode: pendingBarcode }, () => renderScan(root));
      const head = cands.length ? (cands[0].strong ? t('Looks like this one:') : t('Could it be one of these?')) : t('Not in your list yet.');
      result.innerHTML = `<div class="card"><b>${head}</b>${swatch}${cands.map((c, i) => `<div class="can" data-i="${i}">${thumb(c.can)}<div class="meta"><div class="nm">${esc(c.can.name)}</div><div class="dim sub">${c.can.status === 'have' ? t('In your collection') : t('On your wants list')}</div></div><button class="found" data-pick="${i}">${t('Yes')}</button></div>`).join('')}${countryHint}${read}<button class="${cands.length ? 'secondary' : 'primary'}" id="none" style="width:100%;margin-top:8px">${cands.length ? t('None of these: add as a new can') : t('Add as a new can')}</button></div>`;
      result.querySelector('#none')!.addEventListener('click', addNew);
      result.querySelectorAll<HTMLElement>('[data-pick]').forEach((b) => b.addEventListener('click', async () => {
        const c = cands[Number(b.dataset.pick)].can;
        if (pendingBarcode && !c.barcode) await saveCan({ ...c, barcode: pendingBarcode }); // next time the barcode finds it
        if (c.status === 'want') { await markHave(c.id); toast(t('Moved to your collection')); }
        else toast(t('You already have this one ✓'));
        renderScan(root);
      }));
    } catch (err) {
      msg.innerHTML = `<span class="fail">${t('Could not read the can on this phone. You can still add it by hand.')}</span>`;
      result.innerHTML = `<div class="card"><button class="primary" id="manual" style="width:100%">${t('Add a can by hand')}</button></div>`;
      result.querySelector('#manual')!.addEventListener('click', () => openForm({ status: 'have', barcode: pendingBarcode }, () => renderScan(root)));
    }
    input.value = '';
  });
}
