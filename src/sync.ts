import type { Can } from './types';
import { db, allCans } from './db';
import { parseBackup, FORMAT, VERSION } from './backup';
import { t } from './i18n';

export interface SyncConfig { token: string; owner: string; repo: string; path: string; }
export type SyncResult =
  | { ok: true; pulled: number; pushed: boolean; at: number }
  | { ok: false; reason: 'auth' | 'notfound' | 'network' | 'conflict' | 'badremote' | 'toolarge' | 'config'; message: string };

const API = 'https://api.github.com';

export async function getConfig(): Promise<SyncConfig | null> {
  return ((await (await db()).get('meta', 'sync')) as SyncConfig | undefined) ?? null;
}
export async function setConfig(c: SyncConfig | null) {
  const d = await db();
  if (c) await d.put('meta', c, 'sync'); else await d.delete('meta', 'sync');
}

/** Union by id; newer updatedAt wins; ties prefer local. Tombstones are ordinary records. */
export function mergeAll(local: Can[], remote: Can[]): { merged: Can[]; localChanged: Can[]; remoteDiffers: boolean } {
  const L = new Map(local.map((c) => [c.id, c]));
  const R = new Map(remote.map((c) => [c.id, c]));
  const merged: Can[] = []; const localChanged: Can[] = []; let remoteDiffers = false;
  for (const id of new Set([...L.keys(), ...R.keys()])) {
    const l = L.get(id), r = R.get(id);
    if (l && r) {
      if (r.updatedAt > l.updatedAt) { merged.push(r); localChanged.push(r); }
      else { merged.push(l); if (l.updatedAt > r.updatedAt) remoteDiffers = true; }
    } else if (l) { merged.push(l); remoteDiffers = true; }
    else { merged.push(r!); localChanged.push(r!); }
  }
  return { merged, localChanged, remoteDiffers };
}

const b64enc = (s: string) => { const b = new TextEncoder().encode(s); let bin = ''; b.forEach((x) => (bin += String.fromCharCode(x))); return btoa(bin); };
const b64dec = (s: string) => { const bin = atob(s.replace(/\s/g, '')); return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))); };

function headers(c: SyncConfig) {
  return { Authorization: `Bearer ${c.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
}

export async function syncNow(cfg?: SyncConfig | null, f: typeof fetch = fetch): Promise<SyncResult> {
  const c = cfg ?? (await getConfig());
  if (!c || !c.token || !c.owner || !c.repo) return { ok: false, reason: 'config', message: t('Sync is not set up.') };
  const url = `${API}/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/contents/${c.path.split('/').map(encodeURIComponent).join('/')}`;
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const g = await f(url, { headers: headers(c), cache: 'no-store' });
      let remote: Can[] = []; let sha: string | undefined;
      if (g.status === 401 || g.status === 403) return { ok: false, reason: 'auth', message: t('GitHub rejected the token. It may have expired or lacks access to the data repo.') };
      if (g.status === 404) {
        // path missing is fine (first sync); a missing repo is not. Distinguish by checking the repo.
        const rr = await f(`${API}/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}`, { headers: headers(c) });
        if (rr.status === 404) return { ok: false, reason: 'notfound', message: t('Data repo not found. Check owner/name and token access.') };
        if (rr.status === 401 || rr.status === 403) return { ok: false, reason: 'auth', message: t('GitHub rejected the token.') };
      } else if (g.ok) {
        const j = await g.json();
        sha = j.sha;
        if (j.encoding !== 'base64' || typeof j.content !== 'string') return { ok: false, reason: 'toolarge', message: t('The data file is too large for sync.') };
        const p = parseBackup(b64dec(j.content));
        if (p.error) return { ok: false, reason: 'badremote', message: t('The file in the data repo is not valid. Nothing was changed.') };
        remote = p.cans;
      } else return { ok: false, reason: 'network', message: t('GitHub answered {s}.', { s: g.status }) };

      const local = await allCans(true);
      const { merged, localChanged, remoteDiffers } = mergeAll(local, remote);
      if (localChanged.length) {
        const d = await db(); const tx = d.transaction('cans', 'readwrite');
        for (const x of localChanged) tx.store.put(x);
        await tx.done;
      }
      let pushed = false;
      if (remoteDiffers || sha === undefined) {
        const body = { app: FORMAT, version: VERSION, exportedAt: Date.now(), cans: merged.sort((a, b) => a.id.localeCompare(b.id)) };
        const put = await f(url, {
          method: 'PUT', headers: { ...headers(c), 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Update collection', content: b64enc(JSON.stringify(body, null, 1)), ...(sha ? { sha } : {}) }),
        });
        if (put.status === 409 || put.status === 422) continue; // someone else wrote first: refetch and merge again
        if (put.status === 401 || put.status === 403) return { ok: false, reason: 'auth', message: t('Token can read but not write. It needs "Contents: Read and write".') };
        if (!put.ok) return { ok: false, reason: 'network', message: t('GitHub answered {s} on save.', { s: put.status }) };
        pushed = true;
      }
      const at = Date.now();
      await (await db()).put('meta', at, 'lastSync');
      return { ok: true, pulled: localChanged.length, pushed, at };
    }
    return { ok: false, reason: 'conflict', message: t('Could not save after several tries. Try again in a moment.') };
  } catch {
    return { ok: false, reason: 'network', message: t('No connection to GitHub. Your data is safe on this phone.') };
  }
}
export async function lastSync(): Promise<number | null> { return ((await (await db()).get('meta', 'lastSync')) as number | undefined) ?? null; }
