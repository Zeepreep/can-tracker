import { makeBackup, parseBackup, planMerge, applyMerge, markBackedUp, lastBackup, restoreSnapshot, snapshotInfo } from './backup';
import { allCans } from './db';
import { renderDiagnostics, esc } from './diagnostics';
import { getConfig, setConfig, syncNow, lastSync } from './sync';
import { openLibrary } from './library-ui';
import { t, getLang, setLang, fmtDate, fmtDateTime, cansLabel } from './i18n';
import { APP_VERSION } from './version';
import { checkForUpdates } from './sw-register';

export async function renderMore(root: HTMLElement) {
  const n = (await allCans()).length;
  const lb = await lastBackup();
  const snap = await snapshotInfo();
  const sc = await getConfig(); const ls = await lastSync();
  root.innerHTML = `<h1>${t('More')}</h1>
    <h2>${t('App update')}</h2>
    <div class="card update-card">
      <div class="version-line"><strong>${t('Version {version}', { version: APP_VERSION })}</strong><span class="dim">${t('Can Tracker')}</span></div>
      <button class="secondary" id="check-updates" style="width:100%;margin-top:10px">${t('Check for updates')}</button>
      <div id="update-status" class="dim update-status" aria-live="polite">${t('Check whether a newer version is available.')}</div>
    </div>
    <h2>${t('Language')}</h2>
    <div class="seg"><button type="button" data-lang="en" class="${getLang() === 'en' ? 'on' : ''}">English</button><button type="button" data-lang="nl" class="${getLang() === 'nl' ? 'on' : ''}">Nederlands</button></div>
    <h2>${t('Tagline library')}</h2>
    <div class="card"><div class="dim" style="font-size:14px">${t('Look up which language and country a text on a can belongs to, without scanning.')}</div>
      <button class="secondary" id="open-lib" style="width:100%;margin-top:10px">${t('Open library')}</button></div>
    <h2>${t('Backup')}</h2>
    <div class="card"><div>${t('{count} stored on this phone.', { count: cansLabel(n) })}</div>
      <div class="dim" style="font-size:14px">${lb ? t('Last backup: {date}', { date: fmtDate(lb) }) : t('No backup made yet.')}</div>
      <button class="primary" id="exp" style="width:100%;margin-top:10px">${t('Save backup file')}</button>
      <label class="btn secondary filebtn">${t('Restore from backup file')}<input id="imp" type="file" accept=".json,application/json" hidden></label>
      <div id="imp-out"></div>
      ${snap ? `<button class="secondary" id="undo-imp" style="width:100%">${t('Undo last restore ({count} from {date})', { count: cansLabel(snap.count), date: fmtDateTime(snap.at) })}</button>` : ''}
    </div>
    <h2>${t('Sync (optional)')}</h2>
    <div class="card">
      <div class="dim" style="font-size:14px">${sc ? esc(t('Connected to {repo}', { repo: sc.owner + '/' + sc.repo })) + (ls ? esc(t('. Last sync {date}', { date: fmtDateTime(ls) })) : '.') : t('Keeps a copy of the collection in your private GitHub data repo.')}</div>
      <label>${t('GitHub user')}<input id="s-owner" value="${esc(sc?.owner ?? 'Zeepreep')}" autocapitalize="off" autocorrect="off"></label>
      <label>${t('Data repo')}<input id="s-repo" value="${esc(sc?.repo ?? 'can-tracker-data')}" autocapitalize="off" autocorrect="off"></label>
      <label>${t('Access token')}<input id="s-token" type="password" value="${esc(sc?.token ?? '')}" autocapitalize="off" autocorrect="off" placeholder="github_pat_…"></label>
      <button class="primary" id="s-go" style="width:100%">${sc ? t('Save and sync now') : t('Connect and sync')}</button>
      ${sc ? `<button class="secondary" id="s-off" style="width:100%;margin-top:8px">${t('Disconnect')}</button>` : ''}
      <div id="s-out" style="margin-top:8px"></div>
    </div>
    <div id="diag-root"></div>`;
  root.querySelector('#exp')!.addEventListener('click', async () => {
    const b = await makeBackup();
    const name = `can-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([JSON.stringify(b, null, 1)], name, { type: 'application/json' });
    try {
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: name }); await markBackedUp(); renderMore(root); return; }
    } catch (e) { if ((e as DOMException)?.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    await markBackedUp(); renderMore(root);
  });
  const updateButton = root.querySelector<HTMLButtonElement>('#check-updates')!;
  const updateStatus = root.querySelector<HTMLElement>('#update-status')!;
  updateButton.addEventListener('click', async () => {
    updateButton.disabled = true;
    updateStatus.textContent = t('Checking for updates…');
    try {
      const result = await checkForUpdates();
      if (result === 'ready') updateStatus.textContent = t('Update ready. Tap Reload at the top of the screen.');
      else if (result === 'downloading') updateStatus.textContent = t('A new version was found and is downloading. The update button will appear when it is ready.');
      else if (result === 'current') updateStatus.textContent = t('You are using the latest version.');
      else if (result === 'unsupported') updateStatus.textContent = t('Automatic updates are not supported by this browser.');
      else updateStatus.textContent = t('Could not check for updates. Check your internet connection and try again.');
    } catch {
      updateStatus.textContent = t('Could not check for updates. Check your internet connection and try again.');
    } finally {
      updateButton.disabled = false;
    }
  });
  const out = root.querySelector<HTMLElement>('#imp-out')!;
  root.querySelector<HTMLInputElement>('#imp')!.addEventListener('change', async (e) => {
    const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return;
    const p = parseBackup(await f.text());
    if (p.error) { out.innerHTML = `<div class="fail">${esc(p.error)}</div>`; return; }
    const plan = planMerge(await allCans(true), p.cans);
    out.innerHTML = `<div class="card"><b>${t('Preview')}</b><div>${t('{a} new, {b} updated, {c} unchanged', { a: plan.add.length, b: plan.update.length, c: plan.same })}${p.skipped ? t(', {n} unreadable skipped', { n: p.skipped }) : ''}.</div><div class="dim" style="font-size:14px">${t('Nothing is deleted. You can undo afterwards.')}</div><button class="primary" id="go" style="width:100%;margin-top:8px">${t('Apply')}</button></div>`;
    out.querySelector('#go')!.addEventListener('click', async () => { await applyMerge(plan); renderMore(root); });
  });
  root.querySelector('#undo-imp')?.addEventListener('click', async () => {
    if (confirm(t('Go back to how your collection was before the last restore?'))) { await restoreSnapshot(); renderMore(root); }
  });
  const sout = root.querySelector<HTMLElement>('#s-out')!;
  root.querySelector('#s-go')!.addEventListener('click', async () => {
    const v = (id: string) => root.querySelector<HTMLInputElement>('#' + id)!.value.trim();
    const cfg = { owner: v('s-owner'), repo: v('s-repo'), token: v('s-token'), path: 'collection.json' };
    sout.innerHTML = `<span class="dim">${t('Syncing…')}</span>`;
    const r = await syncNow(cfg);
    if (r.ok) { await setConfig(cfg); renderMore(root); }
    else sout.innerHTML = `<span class="fail">${esc(r.message)}</span>`;
  });
  root.querySelector('#s-off')?.addEventListener('click', async () => { await setConfig(null); renderMore(root); });
  root.querySelector('#open-lib')!.addEventListener('click', openLibrary);
  root.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang as 'en' | 'nl')));
  renderDiagnostics(root.querySelector<HTMLElement>('#diag-root')!, true);
}
