// Lagos Life (Vatar Games SDK): https://lagoslife.app/developers/docs
// When the game is opened inside Lagos Life it runs in their frame. We load their SDK there, learn who is
// playing (a per-game pseudonym, a display name and an avatar), follow their pause and resume, and post
// Street Rep to the game's leaderboard. Opened anywhere else, none of this runs and nothing is loaded.
// Purchases and anything that grants value must be verified by our server with the secret key; that
// side isn't here yet.

const SDK = 'https://lagoslife.app/sdk/vatar-games-v1.js';
const SCORE_GAP = 21000; // the SDK takes one score per 20 s per player

const framed = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true; // a cross-origin parent can block the check, which itself means we're framed
  }
})();

const state = { framed, player: null, mode: null, error: null };
let ready = null;
let lastScore = 0;
let pendingScore = null;
let scoreTimer = 0;

function loadSdk() {
  if (window.Vatar) return Promise.resolve(window.Vatar);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SDK;
    s.async = true;
    s.onload = () => (window.Vatar ? resolve(window.Vatar) : reject(new Error('Vatar SDK missing')));
    s.onerror = () => reject(new Error('Could not load the Lagos Life SDK'));
    document.head.appendChild(s);
  });
}

// Resolves to the Lagos Life player, or null when we're not in Lagos Life (or it didn't answer).
// onPause/onResume are wired before init so a pay sheet or backgrounding is never missed.
export function connect({ onPause, onResume } = {}) {
  if (ready) return ready;
  if (!framed) return (ready = Promise.resolve(null));
  ready = (async () => {
    try {
      const V = await loadSdk();
      if (onPause) V.onPause(onPause);
      if (onResume) V.onResume(onResume);
      const r = await V.init();
      state.player = r.player;
      state.mode = r.mode;
      return r.player;
    } catch (e) {
      // not_framed (some other site framed us), timeout, signed_out, …: carry on as a normal web game
      state.error = e?.code || e?.message || 'error';
      console.info('Lagos Life not connected:', state.error);
      return null;
    }
  })();
  return ready;
}

export const lagosLife = {
  get framed() { return state.framed; },
  get connected() { return !!state.player; },
  get player() { return state.player; },
  get mode() { return state.mode; },
};

// Post a score (whole number, higher is better; Lagos Life keeps each player's best). Calls closer than
// 20 s apart are held and the latest one is sent when the gap has passed.
export function submitScore(n) {
  if (!state.player || !window.Vatar) return;
  pendingScore = Math.max(0, Math.round(n));
  const wait = lastScore + SCORE_GAP - Date.now();
  clearTimeout(scoreTimer);
  if (wait > 0) {
    scoreTimer = setTimeout(() => submitScore(pendingScore), wait);
    return;
  }
  const score = pendingScore;
  pendingScore = null;
  lastScore = Date.now();
  window.Vatar.submitScore(score).catch((e) => {
    if (e?.code === 'too_soon' || e?.code === 'rate_limited') {
      lastScore = Date.now();
      submitScore(score);
    } else console.info('Lagos Life score not sent:', e?.code || e);
  });
}

// Top 50 plus the player's own rank, straight from the SDK.
export async function leaderboard() {
  if (!state.player || !window.Vatar) return null;
  return window.Vatar.leaderboard();
}
