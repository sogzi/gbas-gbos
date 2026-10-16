// Story progress, saved on this device only (no sign-up or server yet).
// One small JSON record in the save store (src/store.js: localStorage, or CrazyGames' Data module there).
// A save code (copy/paste text) moves it between devices.
// When Lagos Life links, this record is uploaded once and the server takes over; rewards that matter
// (₦, real Street Rep) will only ever come from the server, never from this file.

import { CHAPTERS } from './chapters.js';
import { store } from '../store.js';

const KEY = 'gbasgbos.story.v1';
const VERSION = 1;
const PREFIX = 'GBS1-';

const fresh = () => ({ v: VERSION, cleared: {}, seen: {}, updated: 0 });

let memoryOnly = false; // private mode or blocked storage: progress lasts for this visit only

function read() {
  try {
    const raw = store.getItem(KEY);
    if (!raw) return fresh();
    return migrate(JSON.parse(raw));
  } catch {
    memoryOnly = true;
    return fresh();
  }
}

// older saves get upgraded here when the format changes
function migrate(s) {
  if (!s || typeof s !== 'object') return fresh();
  return { ...fresh(), ...s, v: VERSION };
}

let state = read();

function write() {
  state.updated = Date.now();
  try {
    store.setItem(KEY, JSON.stringify(state));
    memoryOnly = false;
  } catch {
    memoryOnly = true;
  }
}

// ask the browser not to evict our storage (Safari otherwise may after 7 days without a visit)
export async function askToPersist() {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

export const isMemoryOnly = () => memoryOnly;

// installed to the Home Screen (iOS) or as an app: storage sticks
export const isInstalled = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

export const save = {
  get: () => state,

  cleared: (n) => state.cleared[n] ?? null,

  // the next chapter to play: the first one not won yet
  next() {
    const c = CHAPTERS.find((ch) => !state.cleared[ch.n]?.won);
    return c ? c.n : null;
  },

  unlocked: (n) => n === 1 || !!state.cleared[n - 1]?.won,

  // Street Rep is worked out from what's been cleared, so replays never pay out twice
  rep() {
    let r = 0;
    for (const ch of CHAPTERS) {
      const c = state.cleared[ch.n];
      if (c?.won) r += ch.rep;
      if (c?.bonus && ch.goal) r += ch.goal.rep;
    }
    return r;
  },

  items: () => CHAPTERS.filter((ch) => ch.item && state.cleared[ch.n]?.won).map((ch) => ch.item),

  record: () => {
    let w = 0, l = 0;
    for (const k in state.cleared) {
      w += state.cleared[k].wins ?? 0;
      l += state.cleared[k].losses ?? 0;
    }
    return [w, l];
  },

  // a finished chapter fight; returns what was newly earned
  result(n, { won, method, bonus }) {
    const ch = CHAPTERS.find((c) => c.n === n);
    const prev = state.cleared[n] ?? { won: false, bonus: false, wins: 0, losses: 0 };
    const now = { ...prev };
    const earned = { rep: 0, item: null, unlock: null, bonus: false, first: false };
    if (won) {
      now.wins = (prev.wins ?? 0) + 1;
      if (!prev.won) {
        earned.first = true;
        earned.rep += ch.rep;
        earned.item = ch.item ?? null;
        earned.unlock = ch.unlock ?? null;
      }
      now.won = true;
      now.best = best(prev.best, method);
      if (bonus && ch.goal && !prev.bonus) {
        earned.rep += ch.goal.rep;
        earned.bonus = true;
      }
      if (bonus) now.bonus = true;
    } else {
      now.losses = (prev.losses ?? 0) + 1;
    }
    state.cleared[n] = now;
    write();
    return earned;
  },

  markSeen(n) {
    state.seen[n] = true;
    write();
  },

  seen: (n) => !!state.seen[n],

  reset() {
    state = fresh();
    write();
  },

  // ---------- save codes ----------
  exportCode() {
    const json = JSON.stringify(state);
    const body = btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return PREFIX + body + '-' + checksum(body);
  },

  // returns true when the code was valid and loaded
  importCode(code) {
    const m = String(code).trim().match(/^GBS1-([A-Za-z0-9_-]+)-([0-9a-z]+)$/);
    if (!m || checksum(m[1]) !== m[2]) return false;
    try {
      const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(escape(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))));
      const s = migrate(JSON.parse(json));
      if (typeof s.cleared !== 'object') return false;
      state = s;
      write();
      return true;
    } catch {
      return false;
    }
  },
};

const RANK = { DECISION: 1, TKO: 2, KO: 3 };
const best = (a, b) => ((RANK[b] ?? 0) > (RANK[a] ?? 0) ? b : a ?? b);

// short checksum so a mistyped code is caught instead of loading garbage
function checksum(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h.toString(36).slice(0, 5);
}
