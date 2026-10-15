// The Street Rep leaderboard: one shared board for every player, with no sign-up.
//
//   GET  /api/lb?board=week|all|fighter[&fighter=dayo][&id=<player>]   top 50, your place, most picked
//   POST /api/lb { op: 'register', name }                  claim a fight name; returns { id, key }
//   POST /api/lb { op: 'rename', id, key, name }
//   POST /api/lb { op: 'start', id, key, fighter, opp, level, mode, chapter }   a fight began; returns a token
//   POST /api/lb { op: 'result', id, key, token, out, method, round }           that fight ended
//   POST /api/lb { op: 'me', id, key }                     your record and Story save (Player Code on a new device)
//   POST /api/lb { op: 'story', id, key, code }            keep a copy of the Story save code
//   POST /api/lb { op: 'remove', name }  + Authorization: Bearer $LB_ADMIN_TOKEN   take a cheat off the boards
//
// The game never says how much rep a fight is worth: it reports what happened and the server works the rep
// out. Every result needs a fresh token from 'start', each token pays once, and a fight has to have taken
// as long as it claims. That keeps the board honest enough for a free game, though a client can still lie
// about winning; 'remove' is there for the ones who do.
import crypto from 'node:crypto';
import { readRaw, send } from './_vatar.js';
import { pipe, cmd } from './_store.js';

const FIGHTERS = ['dayo', 'bisi', 'chief', 'emeka', 'femi', 'kola'];
const OPPONENTS = [...FIGHTERS, 'tunde'];
const LEVELS = ['easy', 'normal', 'hard'];
const STORY_LEVEL = { 1: 'easy', 2: 'normal', 3: 'normal', 4: 'normal', 5: 'normal', 6: 'hard' };
const STORY_RULES = { 1: { rounds: 1, roundSeconds: 90 } };
const QUICK_RULES = { rounds: 3, roundSeconds: 60 };
const WIN = { easy: 10, normal: 20, hard: 35 };
const TOP = 50;
const TOKEN_TTL = 1800; // a fight has 30 minutes to finish

const NAME = /^[A-Za-z0-9_]{3,16}$/;
const RESERVED = ['admin', 'moderator', 'gbasgbos', 'lagoslife', 'vatar', 'claude'];
const BLOCKED = ['fuck', 'fuk', 'shit', 'cunt', 'nigg', 'nigga', 'fag', 'bitch', 'whore', 'slut', 'rape', 'nazi', 'hitler', 'dick', 'pussy', 'cock', 'porn', 'penis', 'vagina', 'ashawo', 'olosho', 'pedo'];

// ---------- helpers ----------
const fail = (status, code) => Object.assign(new Error(code), { status, code });
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const rand = (n) => crypto.randomBytes(n).toString('base64url');

// a name nobody should see on a public board (leetspeak and underscores don't hide it)
function nameProblem(name) {
  if (typeof name !== 'string' || !NAME.test(name)) return 'bad_name';
  const flat = name.toLowerCase().replace(/_/g, '')
    .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't');
  if (BLOCKED.some((w) => flat.includes(w))) return 'rude_name';
  if (RESERVED.some((w) => flat.includes(w))) return 'taken';
  return null;
}

// weeks run Monday to Sunday, Lagos time (UTC+1 all year)
function week(now = Date.now()) {
  const d = new Date(now + 3600e3);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  const thu = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 3));
  const n = 1 + Math.floor((thu - Date.UTC(thu.getUTCFullYear(), 0, 1)) / 864e5 / 7);
  const monday = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day) - 3600e3;
  return { key: `${thu.getUTCFullYear()}-W${String(n).padStart(2, '0')}`, resetsIn: Math.round((monday + 7 * 864e5 - now) / 1000) };
}

// count calls in a window; throws once there are too many
async function limit(name, max, seconds) {
  const k = `rl:${name}:${Math.floor(Date.now() / 1000 / seconds)}`;
  const [n] = await pipe([['INCR', k], ['EXPIRE', k, seconds]]);
  if (n > max) throw fail(429, 'rate_limited');
}

const ip = (req) => sha(String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim()).slice(0, 16);

const hash = (arr) => {
  const o = {};
  for (let i = 0; i < arr.length; i += 2) o[arr[i]] = arr[i + 1];
  return o;
};

async function player(id, key) {
  if (typeof id !== 'string' || !/^[\w-]{6,24}$/.test(id) || typeof key !== 'string' || key.length > 64) throw fail(401, 'bad_key');
  const p = hash(await cmd('HGETALL', `p:${id}`));
  const want = Buffer.from(p.kh || '0'.repeat(64), 'hex');
  const got = Buffer.from(sha(key), 'hex');
  if (!p.kh || !crypto.timingSafeEqual(want, got)) throw fail(401, 'bad_key');
  return p;
}

const num = (v) => Number(v) || 0;
const card = (p) => ({ name: p.name, main: p.main || null, w: num(p.w), l: num(p.l), d: num(p.d), ko: num(p.ko), streak: num(p.streak), best: num(p.best), rep: num(p.rep) });

// where a player stands on a board: rank (1-based) and rep there
async function standing(id, wk) {
  const [wr, ws, ar, as] = await pipe([['ZREVRANK', `lb:w:${wk}`, id], ['ZSCORE', `lb:w:${wk}`, id], ['ZREVRANK', 'lb:all', id], ['ZSCORE', 'lb:all', id]]);
  return {
    week: wr === null ? null : { rank: wr + 1, rep: num(ws) },
    all: ar === null ? null : { rank: ar + 1, rep: num(as) },
  };
}

// ---------- the board ----------
async function board(q) {
  const wk = week();
  const which = ['week', 'all', 'fighter'].includes(q.board) ? q.board : 'week';
  const fighter = FIGHTERS.includes(q.fighter) ? q.fighter : 'dayo';
  const zkey = which === 'week' ? `lb:w:${wk.key}` : which === 'all' ? 'lb:all' : `lb:f:${fighter}`;
  const me = typeof q.id === 'string' && /^[\w-]{6,24}$/.test(q.id) ? q.id : null;
  const [ids, total, picks, rank, score] = await pipe([
    ['ZREVRANGE', zkey, 0, TOP - 1, 'WITHSCORES'],
    ['ZCARD', zkey],
    ['HGETALL', `picks:${wk.key}`],
    ['ZREVRANK', zkey, me ?? '-'],
    ['ZSCORE', zkey, me ?? '-'],
  ]);
  const rows = [];
  for (let i = 0; i < ids.length; i += 2) rows.push({ id: ids[i], rep: num(ids[i + 1]) });
  const want = [...rows.map((r) => r.id), ...(me ? [me] : [])];
  const info = await pipe(want.map((id) => ['HMGET', `p:${id}`, 'name', 'main', 'w', 'l', 'ko', 'streak']));
  const row = (id, rep, rank, [name, main, w, l, ko, streak]) =>
    ({ rank, name, main: which === 'fighter' ? fighter : main || null, w: num(w), l: num(l), ko: num(ko), streak: num(streak), rep, me: id === me });
  const top = rows.map((r, i) => row(r.id, r.rep, i + 1, info[i])).filter((r) => r.name);
  const pickCounts = hash(picks);
  return {
    board: which, fighter: which === 'fighter' ? fighter : null, week: wk.key, resetsIn: wk.resetsIn, total, top,
    me: me && rank !== null ? row(me, num(score), rank + 1, info[info.length - 1]) : null,
    picks: Object.fromEntries(FIGHTERS.map((f) => [f, num(pickCounts[f])])),
  };
}

// ---------- actions ----------
async function register(body, req) {
  const name = body.name;
  const bad = nameProblem(name);
  if (bad) throw fail(400, bad);
  await limit(`reg:${ip(req)}`, 8, 3600);
  const id = rand(9);
  const key = rand(24);
  const ok = await cmd('SET', `name:${name.toLowerCase()}`, id, 'NX');
  if (!ok) throw fail(409, 'taken');
  await cmd('HSET', `p:${id}`, 'name', name, 'kh', sha(key), 'created', Date.now(), 'rep', 0, 'w', 0, 'l', 0, 'd', 0, 'ko', 0, 'streak', 0, 'best', 0);
  return { id, key, name, ...card({ name }) };
}

async function rename(body) {
  const p = await player(body.id, body.key);
  const name = body.name;
  const bad = nameProblem(name);
  if (bad) throw fail(400, bad);
  if (name === p.name) return { name };
  await limit(`ren:${body.id}`, 5, 86400);
  const lower = name.toLowerCase();
  if (lower !== p.name.toLowerCase()) {
    const ok = await cmd('SET', `name:${lower}`, body.id, 'NX');
    if (!ok) throw fail(409, 'taken');
    await cmd('DEL', `name:${p.name.toLowerCase()}`);
  }
  await cmd('HSET', `p:${body.id}`, 'name', name);
  return { name };
}

async function start(body) {
  const p = await player(body.id, body.key);
  if (p.banned) throw fail(403, 'removed');
  await limit(`start:${body.id}`, 120, 3600);
  const mode = body.mode === 'story' ? 'story' : 'quick';
  const chapter = mode === 'story' ? Number(body.chapter) : 0;
  if (mode === 'story' && !STORY_LEVEL[chapter]) throw fail(400, 'bad_request');
  const level = mode === 'story' ? STORY_LEVEL[chapter] : body.level;
  if (!FIGHTERS.includes(body.fighter) || !OPPONENTS.includes(body.opp) || !LEVELS.includes(level)) throw fail(400, 'bad_request');
  const token = rand(18);
  const cmds = [
    ['SET', `t:${token}`, JSON.stringify({ id: body.id, fighter: body.fighter, opp: body.opp, level, mode, chapter, t0: Date.now() }), 'EX', TOKEN_TTL],
    ['HSET', `p:${body.id}`, 'open', token],
  ];
  // the last fight never reported back (quit, closed the tab): it ends the win streak
  if (p.open && (await cmd('GET', `t:${p.open}`))) cmds.push(['DEL', `t:${p.open}`], ['HSET', `p:${body.id}`, 'streak', 0]);
  await pipe(cmds);
  return { token };
}

async function result(body) {
  const p = await player(body.id, body.key);
  if (p.banned) throw fail(403, 'removed');
  await limit(`res:${body.id}`, 60, 3600);
  if (typeof body.token !== 'string' || body.token.length > 40) throw fail(400, 'bad_request');
  const raw = await cmd('GETDEL', `t:${body.token}`);
  if (!raw) throw fail(409, 'stale');
  const t = JSON.parse(raw);
  if (t.id !== body.id) throw fail(409, 'stale');
  const out = ['win', 'loss', 'draw'].includes(body.out) ? body.out : null;
  const method = ['KO', 'TKO', 'DECISION'].includes(body.method) ? body.method : null;
  const rules = t.mode === 'story' ? STORY_RULES[t.chapter] ?? QUICK_RULES : QUICK_RULES;
  const round = Math.round(Number(body.round));
  if (!out || !method || !(round >= 1 && round <= rules.rounds) || (out === 'draw' && method !== 'DECISION')) throw fail(400, 'bad_request');
  // the fight must have lasted as long as it says: a stoppage takes a few seconds into its round,
  // a decision goes the distance
  const secs = (Date.now() - t.t0) / 1000;
  const least = method === 'DECISION' ? rules.rounds * rules.roundSeconds * 0.95 : (round - 1) * rules.roundSeconds * 0.95 + 8;
  if (secs < least) throw fail(409, 'too_fast');

  const wk = week();
  const streak = out === 'win' ? num(p.streak) + 1 : 0;
  const base = WIN[t.level];
  const gained = out === 'win'
    ? base + (method === 'DECISION' ? 0 : Math.round(base / 2)) + Math.min(25, 5 * (streak - 1))
    : out === 'draw' ? 5 : 2;
  const fights = num(p[`f:${t.fighter}`]) + 1;
  const main = !p.main || p.main === t.fighter || fights > num(p[`f:${p.main}`]) ? t.fighter : p.main;
  const fields = {
    streak, best: Math.max(num(p.best), streak), rep: num(p.rep) + gained, main, [`f:${t.fighter}`]: fights,
    w: num(p.w) + (out === 'win'), l: num(p.l) + (out === 'loss'), d: num(p.d) + (out === 'draw'),
    ko: num(p.ko) + (out === 'win' && method !== 'DECISION'), last: Date.now(),
  };
  const cmds = [
    ['HSET', `p:${body.id}`, ...Object.entries(fields).flat()],
    ['ZINCRBY', 'lb:all', gained, body.id],
    ['ZINCRBY', `lb:w:${wk.key}`, gained, body.id],
    ['EXPIRE', `lb:w:${wk.key}`, 60 * 86400],
    ['ZINCRBY', `lb:f:${t.fighter}`, gained, body.id],
    ['HINCRBY', `picks:${wk.key}`, t.fighter, 1],
    ['EXPIRE', `picks:${wk.key}`, 60 * 86400],
  ];
  if (p.open === body.token) cmds.push(['HSET', `p:${body.id}`, 'open', '']);
  await pipe(cmds);
  return { gained, ...card({ ...p, ...fields }), ...(await standing(body.id, wk.key)) };
}

async function me(body) {
  const p = await player(body.id, body.key);
  return { id: body.id, ...card(p), story: p.story || null, ...(await standing(body.id, week().key)) };
}

async function story(body) {
  await player(body.id, body.key);
  const code = body.code;
  if (typeof code !== 'string' || !code.startsWith('GBS1-') || code.length > 4096) throw fail(400, 'bad_request');
  await limit(`story:${body.id}`, 60, 3600);
  await cmd('HSET', `p:${body.id}`, 'story', code);
  return { ok: true };
}

async function remove(body, req) {
  const admin = process.env.LB_ADMIN_TOKEN;
  const auth = String(req.headers.authorization || '');
  if (!admin || auth.length !== admin.length + 7 || !crypto.timingSafeEqual(Buffer.from(auth), Buffer.from(`Bearer ${admin}`))) throw fail(403, 'forbidden');
  const id = typeof body.name === 'string' ? await cmd('GET', `name:${body.name.toLowerCase()}`) : null;
  if (!id) throw fail(404, 'not_found');
  const wk = week().key;
  await pipe([
    ['HSET', `p:${id}`, 'banned', 1],
    ['ZREM', 'lb:all', id],
    ['ZREM', `lb:w:${wk}`, id],
    ...FIGHTERS.map((f) => ['ZREM', `lb:f:${f}`, id]),
  ]);
  return { removed: body.name };
}

const OPS = { register, rename, start, result, me, story, remove };

// the itch.io build runs on itch's own domain and calls this one
function cors(req, res) {
  const o = req.headers.origin;
  if (typeof o === 'string' && /^https:\/\/([a-z0-9-]+\.)*(itch\.zone|itch\.io|hwcdn\.net)$/.test(o)) {
    res.setHeader('Access-Control-Allow-Origin', o);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  res.setHeader('Vary', 'Origin');
}

export default async function handler(req, res) {
  cors(req, res);
  try {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      return res.end();
    }
    if (req.method === 'GET') {
      const q = Object.fromEntries(new URL(req.url, 'http://x').searchParams);
      await limit(`get:${ip(req)}`, 90, 60);
      return send(res, 200, await board(q));
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'method' });
    let body;
    try {
      body = JSON.parse((await readRaw(req)).toString('utf8') || '{}');
    } catch {
      return send(res, 400, { error: 'bad_request' });
    }
    const op = OPS[body?.op];
    if (!op) return send(res, 400, { error: 'bad_request' });
    return send(res, 200, await op(body, req));
  } catch (e) {
    if (!e.status) console.error('lb', e);
    return send(res, e.status || 500, { error: e.code || 'error' });
  }
}
