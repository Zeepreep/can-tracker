import { describe, it, expect, beforeEach } from 'vitest';
import { makeBackup, parseBackup, planMerge, applyMerge, restoreSnapshot, backupDue, markBackedUp } from '../src/backup';
import { saveCan, allCans, db } from '../src/db';

beforeEach(async () => { const d = await db(); await d.clear('cans'); await d.clear('meta'); });

describe('backup', () => {
  it('round trips', async () => {
    await saveCan({ name: 'A', flavor: 'x', barcode: '90162602' });
    const text = JSON.stringify(await makeBackup());
    const p = parseBackup(text);
    expect(p.error).toBeUndefined();
    expect(p.cans).toHaveLength(1);
    expect(p.cans[0].barcode).toBe('90162602');
  });
  it('rejects non-JSON, wrong app, newer version', () => {
    expect(parseBackup('hello').error).toBeTruthy();
    expect(parseBackup('{"app":"other","cans":[]}').error).toBeTruthy();
    expect(parseBackup(JSON.stringify({ app: 'can-tracker', version: 99, cans: [] })).error).toMatch(/newer/);
  });
  it('skips malformed records and drops unsafe image urls', () => {
    const t = JSON.stringify({ app: 'can-tracker', version: 1, cans: [
      { id: 'a', name: 'ok', status: 'have', createdAt: 1, updatedAt: 1, imageUrl: 'javascript:alert(1)', extra: 'x' },
      { id: 'b', status: 'have' }, 5, null,
    ] });
    const p = parseBackup(t);
    expect(p.cans).toHaveLength(1); expect(p.skipped).toBe(3);
    expect(p.cans[0].imageUrl).toBeUndefined();
    expect((p.cans[0] as any).extra).toBeUndefined();
  });
  it('merge: newer wins, ties keep local, new added', async () => {
    const a = await saveCan({ name: 'Local A' });
    const plan = planMerge([a], [
      { ...a, name: 'Remote A', updatedAt: a.updatedAt + 10 },
      { id: 'n', name: 'New', status: 'have', createdAt: 1, updatedAt: 1 },
      { ...a, id: 'same-ts-other' },
    ]);
    expect(plan.update).toHaveLength(1); expect(plan.add).toHaveLength(2);
    const plan2 = planMerge([a], [{ ...a, name: 'Older', updatedAt: a.updatedAt }]);
    expect(plan2.same).toBe(1); expect(plan2.update).toHaveLength(0);
  });
  it('apply then restore snapshot returns to before', async () => {
    await saveCan({ name: 'Keep' });
    await applyMerge({ add: [{ id: 'z', name: 'Z', status: 'have', createdAt: 1, updatedAt: 1 }], update: [], same: 0 });
    expect(await allCans()).toHaveLength(2);
    expect(await restoreSnapshot()).toBe(1);
    expect((await allCans()).map((c) => c.name)).toEqual(['Keep']);
  });
  it('backup reminder logic', async () => {
    for (let i = 0; i < 5; i++) await saveCan({ name: 'c' + i });
    expect(await backupDue()).toBe(true);
    await markBackedUp();
    expect(await backupDue()).toBe(false);
    expect(await backupDue(Date.now() + 31 * 86400000)).toBe(true);
  });
});
