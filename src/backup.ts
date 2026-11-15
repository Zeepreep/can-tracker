import type { Can } from './types';
import { allCans, db, notifyChanged } from './db';
import { t } from './i18n';

export const FORMAT = 'can-tracker';
export const VERSION = 1;

export interface Backup { app: typeof FORMAT; version: number; exportedAt: number; cans: Can[]; }

export async function makeBackup(): Promise<Backup> {
  return { app: FORMAT, version: VERSION, exportedAt: Date.now(), cans: await allCans(true) };
}

function validCan(x: any): x is Can {
  return x && typeof x === 'object' && typeof x.id === 'string' && x.id.length > 0 && typeof x.name === 'string'
    && (x.status === 'have' || x.status === 'want') && Number.isFinite(x.updatedAt) && Number.isFinite(x.createdAt);
}

const STR = ['flavor', 'tagline', 'country', 'barcode', 'imageUrl', 'color', 'notes'] as const;

/** Parse + validate import text. Never throws; returns errors for the UI. Unknown fields are dropped. */
export function parseBackup(text: string): { cans: Can[]; skipped: number; error?: string } {
  let j: any;
  try { j = JSON.parse(text); } catch { return { cans: [], skipped: 0, error: t('That file is not a valid backup (could not read it).') }; }
  if (!j || j.app !== FORMAT || !Array.isArray(j.cans)) return { cans: [], skipped: 0, error: t('That file is not a Can Tracker backup.') };
  if (typeof j.version !== 'number' || j.version > VERSION) return { cans: [], skipped: 0, error: t('This backup is from a newer version of the app. Update the app first.') };
  const cans: Can[] = []; let skipped = 0;
  for (const x of j.cans) {
    if (!validCan(x)) { skipped++; continue; }
    const c: Can = { id: x.id, status: x.status, name: x.name.slice(0, 300), createdAt: x.createdAt, updatedAt: x.updatedAt };
    for (const k of STR) if (typeof x[k] === 'string' && x[k]) (c as any)[k] = x[k].slice(0, 1000);
    if (x.deleted === true) c.deleted = true;
    if (c.imageUrl && !/^https:\/\//.test(c.imageUrl)) delete c.imageUrl;
    cans.push(c);
  }
  return { cans, skipped };
}

export interface Plan { add: Can[]; update: Can[]; same: number; }

/** Per-record merge: newer updatedAt wins; ties keep local. */
export function planMerge(local: Can[], incoming: Can[]): Plan {
  const byId = new Map(local.map((c) => [c.id, c]));
  const plan: Plan = { add: [], update: [], same: 0 };
  for (const c of incoming) {
    const l = byId.get(c.id);
    if (!l) plan.add.push(c);
    else if (c.updatedAt > l.updatedAt) plan.update.push(c);
    else plan.same++;
  }
  return plan;
}

/** Take a safety snapshot of everything, then apply the plan in one transaction. */
export async function applyMerge(plan: Plan) {
  const d = await db();
  const snapshot = await d.getAll('cans');
  await d.put('meta', { at: Date.now(), cans: snapshot }, 'snapshot');
  const tx = d.transaction('cans', 'readwrite');
  for (const c of [...plan.add, ...plan.update]) tx.store.put(c);
  await tx.done;
  notifyChanged();
}

export async function restoreSnapshot(): Promise<number> {
  const d = await db();
  const s = (await d.get('meta', 'snapshot')) as { at: number; cans: Can[] } | undefined;
  if (!s) return 0;
  const tx = d.transaction('cans', 'readwrite');
  await tx.store.clear();
  for (const c of s.cans) tx.store.put(c);
  await tx.done;
  notifyChanged();
  return s.cans.length;
}
export async function snapshotInfo(): Promise<{ at: number; count: number } | null> {
  const s = (await (await db()).get('meta', 'snapshot')) as { at: number; cans: Can[] } | undefined;
  return s ? { at: s.at, count: s.cans.length } : null;
}

export async function markBackedUp() { await (await db()).put('meta', Date.now(), 'lastBackup'); }
export async function lastBackup(): Promise<number | null> { return ((await (await db()).get('meta', 'lastBackup')) as number | undefined) ?? null; }

/** Show a reminder when there is data and no backup in 30 days. */
export async function backupDue(now = Date.now()): Promise<boolean> {
  const n = (await allCans()).length;
  if (n < 5) return false;
  const lb = await lastBackup();
  return lb === null || now - lb > 30 * 86400000;
}
