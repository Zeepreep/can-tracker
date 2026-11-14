import { makeBackup, parseBackup, planMerge, applyMerge, markBackedUp, lastBackup, restoreSnapshot, snapshotInfo } from './backup';
import { allCans } from './db';
import { renderDiagnostics, esc } from './diagnostics';

export async function renderMore(root: HTMLElement) {
  const n = (await allCans()).length;
  const lb = await lastBackup();
  const snap = await snapshotInfo();
  root.innerHTML = `<h1>More</h1>
    <h2>Backup</h2>
    <div class="card"><div>${n} cans stored on this phone.</div>
      <div class="dim" style="font-size:14px">${lb ? 'Last backup: ' + new Date(lb).toLocaleDateString() : 'No backup made yet.'}</div>
      <button class="primary" id="exp" style="width:100%;margin-top:10px">Save backup file</button>
      <label class="btn secondary filebtn">Restore from backup file<input id="imp" type="file" accept=".json,application/json" hidden></label>
      <div id="imp-out"></div>
      ${snap ? `<button class="secondary" id="undo-imp" style="width:100%">Undo last restore (${snap.count} cans from ${new Date(snap.at).toLocaleString()})</button>` : ''}
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
  renderDiagnostics(root.querySelector<HTMLElement>('#diag-root')!, true);
}
