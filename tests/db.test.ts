import { describe, it, expect, beforeEach } from 'vitest';
import { allCans, saveCan, deleteCan, restoreCan, findByBarcode, markHave, resetDbForTests, db } from '../src/db';

beforeEach(async () => { await (await db()).clear('cans'); });

describe('db', () => {
  it('saves and lists', async () => {
    await saveCan({ name: 'A' });
    expect((await allCans()).map((c) => c.name)).toEqual(['A']);
  });
  it('rejects empty name', async () => { await expect(saveCan({ name: '  ' })).rejects.toThrow(); });
  it('finds by barcode', async () => {
    await saveCan({ name: 'A', barcode: '90162602' });
    expect((await findByBarcode('90162602'))?.name).toBe('A');
    expect(await findByBarcode('1')).toBeUndefined();
  });
  it('soft delete hides, restore brings back', async () => {
    const c = await saveCan({ name: 'A', barcode: '90162602' });
    await deleteCan(c.id);
    expect(await allCans()).toHaveLength(0);
    expect(await findByBarcode('90162602')).toBeUndefined();
    expect(await allCans(true)).toHaveLength(1);
    await restoreCan(c.id);
    expect(await allCans()).toHaveLength(1);
  });
  it('markHave flips want to have and bumps updatedAt', async () => {
    const c = await saveCan({ name: 'W', status: 'want' });
    await new Promise((r) => setTimeout(r, 5));
    const n = await markHave(c.id);
    expect(n?.status).toBe('have');
    expect(n!.updatedAt).toBeGreaterThan(c.updatedAt);
  });
  it('update keeps createdAt', async () => {
    const c = await saveCan({ name: 'A' });
    const u = await saveCan({ id: c.id, name: 'B' });
    expect(u.createdAt).toBe(c.createdAt);
    expect(await allCans()).toHaveLength(1);
  });
});
void resetDbForTests;
