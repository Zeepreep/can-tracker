import { makeBackup, parseBackup, planMerge, applyMerge, markBackedUp, lastBackup, restoreSnapshot, snapshotInfo } from './backup';
import { allCans } from './db';
import { renderDiagnostics, esc } from './diagnostics';
import { getConfig, setConfig, syncNow, lastSync } from './sync';

export async function renderMore(root: HTMLElement) {
  const n = (await allCans()).length;
  const lb = await lastBackup();
  const snap = await snapshotInfo();
  const sc = await getConfig(); const ls = await lastSync();
  root.innerHTML = `<h1>More</h1>
    <h2>Backup</h2>
    <div class="card"><div>${n} cans stored on this phone.</div>
      <div class="dim" style="font-size:14px">${lb ? 'Last backup: ' + new Date(lb).toLocaleDateString() : 'No backup made yet.'}</div>
      <button class="primary" id="exp" style="width:100%;margin-top:10px">Save backup file</button>
      <label class="btn secondary filebtn">Restore from backup file<input id="imp" type="file" accept=".json,application/json" hidden></label>
      <div id="imp-out"></div>
      ${snap ? `<button class="secondary" id="undo-imp" style="width:100%">Undo last restore (${snap.count} cans from ${new Date(snap.at).toLocaleString()})</button>` : ''}
    </div>
    <h2>Sync (optional)</h2>
    <div class="card">
      <div class="dim" style="font-size:14px">${sc ? 'Connected to ' + esc(sc.owner + '/' + sc.repo) + (ls ? '. Last sync ' + new Date(ls).toLocaleString() : '.') : 'Keeps a copy of the collection in your private GitHub data repo.'}</div>
      <label>GitHub user<input id="s-owner" value="${esc(sc?.owner ?? 'Zeepreep')}" autocapitalize="off" autocorrect="off"></label>
      <label>Data repo<input id="s-repo" value="${esc(sc?.repo ?? 'can-tracker-data')}" autocapitalize="off" autocorrect="off"></label>
      <label>Access token<input id="s-token" type="password" value="${esc(sc?.token ?? '')}" autocapitalize="off" autocorrect="off" placeholder="github_pat_…"></label>
      <button class="primary" id="s-go" style="width:100%">${sc ? 'Save and sync now' : 'Connect and sync'}</button>
      ${sc ? '<button class="secondary" id="s-off" style="width:100%;margin-top:8px">Disconnect</button>' : ''}
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
  const out = root.querySelector<HTMLElement>('#imp-out')!;
  root.querySelector<HTMLInputElement>('#imp')!.addEventListener('change', async (e) => {
    const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return;
    const p = parseBackup(await f.text());
    if (p.error) { out.innerHTML = `<div class="fail">${esc(p.error)}</div>`; return; }
    const plan = planMerge(await allCans(true), p.cans);
    out.innerHTML = `<div class="card"><b>Preview</b><div>${plan.add.length} new, ${plan.update.length} updated, ${plan.same} unchanged${p.skipped ? `, ${p.skipped} unreadable skipped` : ''}.</div><div class="dim" style="font-size:14px">Nothing is deleted. You can undo afterwards.</div><button class="primary" id="go" style="width:100%;margin-top:8px">Apply</button></div>`;
    out.querySelector('#go')!.addEventListener('click', async () => { await applyMerge(plan); renderMore(root); });
  });
  root.querySelector('#undo-imp')?.addEventListener('click', async () => {
    if (confirm('Go back to how your collection was before the last restore?')) { await restoreSnapshot(); renderMore(root); }
  });
  const sout = root.querySelector<HTMLElement>('#s-out')!;
  root.querySelector('#s-go')!.addEventListener('click', async () => {
    const v = (id: string) => root.querySelector<HTMLInputElement>('#' + id)!.value.trim();
    const cfg = { owner: v('s-owner'), repo: v('s-repo'), token: v('s-token'), path: 'collection.json' };
    sout.innerHTML = '<span class="dim">Syncing…</span>';
    const r = await syncNow(cfg);
    if (r.ok) { await setConfig(cfg); renderMore(root); }
    else sout.innerHTML = `<span class="fail">${esc(r.message)}</span>`;
  });
  root.querySelector('#s-off')?.addEventListener('click', async () => { await setConfig(null); renderMore(root); });
  renderDiagnostics(root.querySelector<HTMLElement>('#diag-root')!, true);
}
