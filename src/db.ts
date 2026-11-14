import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Can } from './types';

interface Schema extends DBSchema {
  cans: { key: string; value: Can; indexes: { barcode: string } };
  meta: { key: string; value: unknown };
}

let dbp: Promise<IDBPDatabase<Schema>> | null = null;
export function db() {
  dbp ??= openDB<Schema>('can-tracker', 1, {
    upgrade(d) {
      d.createObjectStore('cans', { keyPath: 'id' }).createIndex('barcode', 'barcode');
      d.createObjectStore('meta');
    },
  });
  return dbp;
}
export function resetDbForTests() { dbp = null; }

export const notifyChanged = () => { try { window.dispatchEvent(new Event('cans-changed')); } catch { /* no window */ } };

export const newId = () =>
  (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));

export async function allCans(includeDeleted = false): Promise<Can[]> {
  const all = await (await db()).getAll('cans');
  return includeDeleted ? all : all.filter((c) => !c.deleted);
}

export async function getCan(id: string) { return (await db()).get('cans', id); }

export async function findByBarcode(code: string): Promise<Can | undefined> {
  const hits = await (await db()).getAllFromIndex('cans', 'barcode', code);
  return hits.find((c) => !c.deleted);
}

export async function saveCan(input: Partial<Can> & Pick<Can, 'name'>): Promise<Can> {
  const now = Date.now();
  const existing = input.id ? await getCan(input.id) : undefined;
  const can: Can = {
    status: 'have',
    ...existing,
    ...input,
    id: input.id ?? newId(),
    name: input.name.trim(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  if (!can.name) throw new Error('Name is required');
  await (await db()).put('cans', can);
  notifyChanged();
  return can;
}

/** Soft delete: keep a tombstone so sync/restore can see it. */
export async function deleteCan(id: string) {
  const c = await getCan(id);
  if (!c) return;
  await (await db()).put('cans', { ...c, deleted: true, updatedAt: Date.now() });
  notifyChanged();
}
export async function restoreCan(id: string) {
  const c = await getCan(id);
  if (c) await (await db()).put('cans', { ...c, deleted: false, updatedAt: Date.now() });
  notifyChanged();
}

/** Mark a wanted can as found (the "found it" flow). */
export async function markHave(id: string) {
  const c = await getCan(id);
  if (!c) return;
  const n = { ...c, status: 'have' as const, updatedAt: Date.now() };
  await (await db()).put('cans', n);
  notifyChanged();
  return n;
}
