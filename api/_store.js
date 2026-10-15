// A tiny Redis client for the leaderboard, over Upstash's REST API (no extra packages).
// Vercel sets these when an Upstash Redis store is connected to the project (Storage tab):
//   KV_REST_API_URL / KV_REST_API_TOKEN   (or UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN)
// Off Vercel with neither set (local tests), it falls back to an in-memory store that forgets on restart.

const REST_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

// run several commands in one round trip; resolves to their results in order
export async function pipe(cmds) {
  if (!cmds.length) return [];
  if (!REST_URL || !TOKEN) {
    if (process.env.VERCEL) throw Object.assign(new Error('no store'), { status: 503, code: 'no_store' });
    return cmds.map((c) => memory(c));
  }
  const r = await fetch(`${REST_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds.map((c) => c.map(String))),
  });
  if (!r.ok) throw Object.assign(new Error(`store ${r.status}`), { status: 502, code: 'store' });
  const out = await r.json();
  return out.map((x) => {
    if (x.error) throw Object.assign(new Error(x.error), { status: 502, code: 'store' });
    return x.result;
  });
}

export const cmd = async (...c) => (await pipe([c]))[0];

// ---------- in-memory stand-in (local tests only) ----------
const mem = new Map(); // key -> { v, exp }
const live = (k) => {
  const e = mem.get(k);
  if (e && e.exp && e.exp < Date.now()) mem.delete(k);
  return mem.get(k)?.v;
};
const put = (k, v) => mem.set(k, { v, exp: mem.get(k)?.exp });
const zsorted = (z) => [...z.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));

function memory([name, ...a]) {
  const op = name.toUpperCase();
  const [k] = a;
  switch (op) {
    case 'GET': return live(k) ?? null;
    case 'SET': {
      const nx = a.some((x) => String(x).toUpperCase() === 'NX');
      if (nx && live(k) !== undefined) return null;
      const ex = a.findIndex((x) => String(x).toUpperCase() === 'EX');
      mem.set(k, { v: String(a[1]), exp: ex > 0 ? Date.now() + a[ex + 1] * 1000 : 0 });
      return 'OK';
    }
    case 'GETDEL': { const v = live(k) ?? null; mem.delete(k); return v; }
    case 'DEL': return a.reduce((n, x) => n + (mem.delete(x) ? 1 : 0), 0);
    case 'INCR': { const v = Number(live(k) ?? 0) + 1; put(k, String(v)); return v; }
    case 'EXPIRE': { const e = mem.get(k); if (e) e.exp = Date.now() + a[1] * 1000; return e ? 1 : 0; }
    case 'HSET': {
      const h = live(k) ?? new Map();
      for (let i = 1; i < a.length; i += 2) h.set(String(a[i]), String(a[i + 1]));
      put(k, h);
      return 1;
    }
    case 'HGETALL': { const h = live(k); return h ? [...h.entries()].flat() : []; }
    case 'HMGET': { const h = live(k); return a.slice(1).map((f) => h?.get(f) ?? null); }
    case 'HINCRBY': {
      const h = live(k) ?? new Map();
      const v = Number(h.get(a[1]) ?? 0) + Number(a[2]);
      h.set(a[1], String(v));
      put(k, h);
      return v;
    }
    case 'ZINCRBY': {
      const z = live(k) ?? new Map();
      const v = (z.get(a[2]) ?? 0) + Number(a[1]);
      z.set(a[2], v);
      put(k, z);
      return String(v);
    }
    case 'ZREM': { const z = live(k); return z?.delete(a[1]) ? 1 : 0; }
    case 'ZSCORE': { const v = live(k)?.get(a[1]); return v === undefined ? null : String(v); }
    case 'ZCARD': return live(k)?.size ?? 0;
    case 'ZREVRANK': {
      const z = live(k);
      if (!z?.has(a[1])) return null;
      return zsorted(z).findIndex(([m]) => m === a[1]);
    }
    case 'ZREVRANGE': {
      const z = live(k);
      if (!z) return [];
      const rows = zsorted(z).slice(Number(a[1]), Number(a[2]) + 1);
      return a[3] ? rows.flatMap(([m, s]) => [m, String(s)]) : rows.map(([m]) => m);
    }
    default: throw new Error(`memory store: ${op} not supported`);
  }
}
