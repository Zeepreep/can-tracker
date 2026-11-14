import { describe, it, expect, beforeEach } from 'vitest';
import { mergeAll, syncNow, type SyncConfig } from '../src/sync';
import { saveCan, allCans, db } from '../src/db';
import type { Can } from '../src/types';

const cfg: SyncConfig = { token: 't', owner: 'o', repo: 'r', path: 'collection.json' };
const mk = (id: string, name: string, updatedAt: number, extra: Partial<Can> = {}): Can => ({ id, name, status: 'have', createdAt: 1, updatedAt, ...extra });
beforeEach(async () => { const d = await db(); await d.clear('cans'); await d.clear('meta'); });

function fakeGitHub(initial?: Can[]) {
  let file: { sha: string; content: string } | null = initial ? enc(initial, 's1') : null;
  let n = 1; const log: string[] = []; let conflictOnce = false;
  function enc(cans: Can[], sha: string) { return { sha, content: btoa(unescape(encodeURIComponent(JSON.stringify({ app: 'can-tracker', version: 1, exportedAt: 1, cans })))) }; }
  const f = (async (url: string, init?: RequestInit) => {
    const m = init?.method ?? 'GET'; log.push(m + ' ' + url.replace('https://api.github.com', ''));
    if (m === 'GET' && url.endsWith('/contents/collection.json')) return file ? new Response(JSON.stringify({ ...file, encoding: 'base64' })) : new Response('{}', { status: 404 });
    if (m === 'GET') return new Response('{}', { status: 200 });
    const b = JSON.parse(init!.body as string);
    if (conflictOnce) { conflictOnce = false; file = enc([mk('other', 'Other', 99)], 's' + ++n); return new Response('{}', { status: 409 }); }
    if (file && b.sha !== file.sha) return new Response('{}', { status: 409 });
    file = { sha: 's' + ++n, content: b.content }; return new Response('{}', { status: 200 });
  }) as unknown as typeof fetch;
  return { f, log, read: () => JSON.parse(decodeURIComponent(escape(atob(file!.content)))).cans as Can[], conflictNext: () => { conflictOnce = true; } };
}

describe('mergeAll', () => {
  it('newer wins both directions, tombstone propagates', () => {
    const r = mergeAll([mk('a', 'L', 5), mk('b', 'Lb', 1)], [mk('a', 'R', 3), mk('b', 'Rb', 9, { deleted: true }), mk('c', 'Rc', 1)]);
    expect(r.merged.find((c) => c.id === 'a')!.name).toBe('L');
    expect(r.merged.find((c) => c.id === 'b')!.deleted).toBe(true);
    expect(r.merged).toHaveLength(3); expect(r.remoteDiffers).toBe(true);
  });
  it('identical = nothing to push', () => { expect(mergeAll([mk('a', 'x', 1)], [mk('a', 'x', 1)]).remoteDiffers).toBe(false); });
});
describe('syncNow', () => {
  it('first sync creates the file', async () => {
    await saveCan({ name: 'Mine' }); const g = fakeGitHub();
    const r = await syncNow(cfg, g.f);
    expect(r.ok && r.pushed).toBe(true); expect(g.read().map((c) => c.name)).toEqual(['Mine']);
  });
  it('pulls remote cans (including umlauts) into local', async () => {
    const g = fakeGitHub([mk('x', 'Flügel Süß', 5)]);
    const r = await syncNow(cfg, g.f);
    expect(r.ok && r.pulled).toBe(1); expect((await allCans())[0].name).toBe('Flügel Süß');
  });
  it('second sync with no changes does not write', async () => {
    await saveCan({ name: 'A' }); const g = fakeGitHub();
    await syncNow(cfg, g.f); g.log.length = 0;
    await syncNow(cfg, g.f);
    expect(g.log.some((l) => l.startsWith('PUT'))).toBe(false);
  });
  it('409 conflict: refetches, merges the other device\'s change, then saves', async () => {
    await saveCan({ name: 'A' }); const g = fakeGitHub([mk('seed', 'Seed', 1)]);
    g.conflictNext();
    const r = await syncNow(cfg, g.f);
    expect(r.ok).toBe(true);
    const names = g.read().map((c) => c.name).sort();
    expect(names).toEqual(['A', 'Other', 'Seed']); // union: nothing lost
  });
  it('auth failure is reported and local data untouched', async () => {
    await saveCan({ name: 'A' });
    const r = await syncNow(cfg, (async () => new Response('{}', { status: 401 })) as unknown as typeof fetch);
    expect(!r.ok && r.reason).toBe('auth'); expect(await allCans()).toHaveLength(1);
  });
  it('offline is reported calmly', async () => {
    const r = await syncNow(cfg, (async () => { throw new Error('x'); }) as unknown as typeof fetch);
    expect(!r.ok && r.reason).toBe('network');
  });
  it('corrupt remote is never overwritten', async () => {
    const f = (async () => new Response(JSON.stringify({ sha: 's', encoding: 'base64', content: btoa('garbage') }))) as unknown as typeof fetch;
    const r = await syncNow(cfg, f); expect(!r.ok && r.reason).toBe('badremote');
  });
});
