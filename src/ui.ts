import type { Can, Status } from './types';
import { allCans, saveCan, deleteCan, restoreCan, markHave, findByBarcode } from './db';
import { buildIndex, search } from './search';
import { lookup, cleanBarcode } from './off';
import { decodePhoto, startLive, type LiveScan } from './scanner';

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
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
}

/* ---------- Can form (sheet) ---------- */
export function openForm(can: Partial<Can>, done: () => void) {
  const isEdit = !!can.id;
  const sheet = document.createElement('div'); sheet.className = 'sheet';
  const f = (k: keyof Can) => esc(String(can[k] ?? ''));
  sheet.innerHTML = `<div class="sheet-body">
    <h1>${isEdit ? 'Edit can' : 'Add can'}</h1>
    <label>Name<input id="f-name" value="${f('name')}" placeholder="Red Bull Winter Edition Iced Vita Berry" autocapitalize="words"></label>
    <label>Flavor<input id="f-flavor" value="${f('flavor')}" placeholder="e.g. Kaktusfeige / cactus fruit"></label>
    <label>Tagline on can<input id="f-tagline" value="${f('tagline')}"></label>
    <label>Country / language<input id="f-country" value="${f('country')}" placeholder="Germany"></label>
    <label>Barcode<input id="f-barcode" value="${f('barcode')}" inputmode="numeric"></label>
    <label>Notes<input id="f-notes" value="${f('notes')}"></label>
    <div class="seg"><button type="button" data-s="have" class="${(can.status ?? 'have') === 'have' ? 'on' : ''}">Have it</button><button type="button" data-s="want" class="${can.status === 'want' ? 'on' : ''}">Want it</button></div>
    <div id="f-err" class="fail"></div>
    <button class="primary" id="f-save" style="width:100%">Save</button>
    <button class="secondary" id="f-cancel" style="width:100%;margin-top:8px">Cancel</button>
    ${isEdit ? '<button class="secondary" id="f-del" style="width:100%;margin-top:8px;color:var(--bad)">Delete</button>' : ''}
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
    if (!name) { err.textContent = 'Please enter a name.'; return; }
    const bcRaw = val('f-barcode');
    const barcode = bcRaw ? cleanBarcode(bcRaw) : null;
    if (bcRaw && !barcode) { err.textContent = 'That barcode number does not look right. Check the digits or clear the field.'; return; }
    if (barcode) {
      const dup = await findByBarcode(barcode);
      if (dup && dup.id !== can.id && !confirm(`"${dup.name}" already has this barcode. Save anyway?`)) return;
    }
    try {
      await saveCan({ ...can, name, flavor: val('f-flavor') || undefined, tagline: val('f-tagline') || undefined, country: val('f-country') || undefined, barcode: barcode ?? undefined, notes: val('f-notes') || undefined, status });
    } catch { err.textContent = 'Could not save. Storage may be full or blocked.'; return; }
    close(); done();
  });
  sheet.querySelector('#f-del')?.addEventListener('click', async () => {
    if (!can.id || !confirm('Delete this can?')) return;
    await deleteCan(can.id); close();
    const t = document.createElement('div'); t.className = 'toast';
    t.innerHTML = 'Deleted <button id="undo">Undo</button>'; document.body.appendChild(t);
    t.querySelector('#undo')!.addEventListener('click', async () => { await restoreCan(can.id!); t.remove(); done(); });
    setTimeout(() => t.remove(), 6000); done();
  });
}

/* ---------- Collection / Wants list ---------- */
export async function renderList(root: HTMLElement, status: Status) {
  const title = status === 'have' ? 'Collection' : 'Wants';
  root.innerHTML = `<h1>${title} <span class="dim" id="count"></span></h1>
    <input id="q" type="search" placeholder="Search flavor, tagline, country…" autocapitalize="off" autocorrect="off" spellcheck="false">
    <div id="list"></div>
    <button class="fab" id="add" aria-label="Add can">+</button>`;
  const all = (await allCans()).filter((c) => c.status === status);
  const ms = buildIndex(all);
  const list = root.querySelector<HTMLElement>('#list')!;
  const q = root.querySelector<HTMLInputElement>('#q')!;
  const draw = () => {
    const ids = search(ms, q.value);
    const byId = new Map(all.map((c) => [c.id, c]));
    const shown = ids ? ids.map((i) => byId.get(i)!).filter(Boolean) : [...all].sort((a, b) => b.updatedAt - a.updatedAt);
    root.querySelector('#count')!.textContent = ids ? `${shown.length} of ${all.length}` : String(all.length);
    if (!shown.length) {
      list.innerHTML = `<div class="card dim">${all.length ? 'No cans match that search.' : status === 'have' ? 'No cans yet. Tap + or use Scan.' : 'Nothing on your wants list. Tap + to add a can you saw online.'}</div>`;
      return;
    }
    list.innerHTML = shown.map((c) => `<div class="can" data-id="${c.id}">${thumb(c)}<div class="meta"><div class="nm">${esc(c.name)}</div><div class="dim sub">${esc([c.flavor, c.country].filter(Boolean).join(' · '))}</div></div>${status === 'want' ? '<button class="found" data-found="' + c.id + '">Found it</button>' : ''}</div>`).join('');
  };
  draw();
  q.addEventListener('input', draw);
  list.addEventListener('click', async (e) => {
    const t = e.target as HTMLElement;
    const found = t.closest<HTMLElement>('[data-found]');
    if (found) { await markHave(found.dataset.found!); toast('Moved to your collection'); renderList(root, status); return; }
    const row = t.closest<HTMLElement>('.can');
    if (row) { const c = all.find((x) => x.id === row.dataset.id); if (c) openForm(c, () => renderList(root, status)); }
  });
  root.querySelector('#add')!.addEventListener('click', () => openForm({ status }, () => renderList(root, status)));
}

/* ---------- Scan ---------- */
let live: LiveScan | null = null;
export function stopScan() { live?.stop(); live = null; }

export function renderScan(root: HTMLElement) {
  stopScan();
  root.innerHTML = `<h1>Scan</h1>
    <div id="cam" hidden><div class="camwrap"><video id="vid" playsinline muted></video><div class="guide"></div></div><button class="secondary" id="cam-stop" style="width:100%">Stop camera</button></div>
    <div id="scan-actions">
      <button class="primary" id="cam-start" style="width:100%">Scan with camera</button>
      <label class="btn secondary filebtn">Take or pick a photo of the barcode<input type="file" id="photo" accept="image/*" capture="environment" hidden></label>
      <div class="typed"><input id="digits" inputmode="numeric" placeholder="Or type the barcode digits"><button class="secondary" id="digits-go">Look up</button></div>
    </div>
    <div id="msg" class="dim"></div><div id="result"></div>`;
  const msg = root.querySelector<HTMLElement>('#msg')!;
  const result = root.querySelector<HTMLElement>('#result')!;
  const cam = root.querySelector<HTMLElement>('#cam')!;
  const actions = root.querySelector<HTMLElement>('#scan-actions')!;

  const handle = async (code: string) => {
    stopScan(); cam.hidden = true; actions.hidden = false; msg.textContent = '';
    if (navigator.vibrate) navigator.vibrate(40);
    const have = await findByBarcode(code);
    if (have) {
      result.innerHTML = `<div class="card ${have.status === 'have' ? 'ok' : ''}"><div class="can" style="border:0">${thumb(have)}<div class="meta"><div class="nm">${esc(have.name)}</div><div class="dim sub">${have.status === 'have' ? 'You already have this one ✓' : 'On your wants list'}</div></div></div>${have.status === 'want' ? '<button class="primary" id="found" style="width:100%">Found it! Add to collection</button>' : ''}</div>`;
      result.querySelector('#found')?.addEventListener('click', async () => { await markHave(have.id); renderScan(root); toast('Added to your collection'); });
      return;
    }
    result.innerHTML = '<div class="card dim">New barcode. Looking it up…</div>';
    const r = await lookup(code);
    const prefill: Partial<Can> = { barcode: code, status: 'have', name: r.ok ? [r.name].filter(Boolean).join('') : '', imageUrl: r.imageUrl };
    const note = r.ok ? 'Found on Open Food Facts. Check the name and fill in the flavor.' : r.reason === 'notfound' ? 'Not in Open Food Facts. Fill it in yourself.' : r.reason === 'ratelimit' ? 'Lookup is busy right now. Fill it in yourself.' : 'No internet lookup right now. Fill it in yourself.';
    result.innerHTML = `<div class="card">${r.imageUrl ? thumb(prefill as Can) : ''}<div class="dim">${note}</div><div class="dim">Barcode ${esc(code)}</div><button class="primary" id="addnew" style="width:100%;margin-top:8px">Add this can</button></div>`;
    result.querySelector('#addnew')!.addEventListener('click', () => openForm(prefill, () => renderScan(root)));
  };

  const fromDigits = async () => {
    const v = root.querySelector<HTMLInputElement>('#digits')!.value;
    const c = cleanBarcode(v);
    if (!c) { msg.innerHTML = '<span class="fail">That number does not look right. Check each digit (8 or 13 digits).</span>'; return; }
    handle(c);
  };
  root.querySelector('#digits-go')!.addEventListener('click', fromDigits);
  root.querySelector('#digits')!.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') fromDigits(); });

  root.querySelector<HTMLInputElement>('#photo')!.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return;
    msg.textContent = 'Reading barcode…';
    try {
      const c = await decodePhoto(file);
      if (c) handle(c); else msg.innerHTML = '<span class="warn">No barcode found in that photo. Try closer, flatter and with more light, or type the digits.</span>';
    } catch { msg.innerHTML = '<span class="fail">Could not read that photo. Type the digits instead.</span>'; }
  });

  root.querySelector('#cam-start')!.addEventListener('click', async () => {
    result.innerHTML = ''; msg.textContent = 'Starting camera… hold the barcode inside the box.';
    cam.hidden = false; actions.hidden = true;
    live = await startLive(root.querySelector<HTMLVideoElement>('#vid')!, handle, (m) => { cam.hidden = true; actions.hidden = false; msg.innerHTML = `<span class="warn">${esc(m)}</span>`; });
  });
  root.querySelector('#cam-stop')!.addEventListener('click', () => { stopScan(); cam.hidden = true; actions.hidden = false; msg.textContent = ''; });
}
