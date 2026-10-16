// Where the game keeps its saves (Story progress, the leaderboard player, ranks seen).
// Normally that's the browser's localStorage. Inside CrazyGames it's their SDK's Data module, which works like
// localStorage but also keeps the saves on the player's CrazyGames account, so they follow them to other devices.
// CrazyGames requires it for iframe games: https://docs.crazygames.com/sdk/data/
// openStore() runs before the game loads (src/boot.js), so every module reads its save from the right place.

const SDK = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
const KEYS = ['gbasgbos.story.v1', 'gbasgbos.player.v1', 'gbasgbos.rank.seen.v1'];
const WAIT = 6000; // past this, play on with localStorage rather than hold the loading screen

let data = null; // CrazyGames' Data module once it's ready

export const store = {
  getItem: (k) => (data ?? localStorage).getItem(k),
  setItem: (k, v) => (data ?? localStorage).setItem(k, v),
  removeItem: (k) => (data ?? localStorage).removeItem(k),
};

const inCrazyGames = (() => {
  try {
    if (window.self === window.top) return false;
    const a = location.ancestorOrigins;
    const parent = a?.length ? a[0] : document.referrer ? new URL(document.referrer).origin : '';
    return /^https:\/\/([a-z0-9-]+\.)*crazygames\.com$/.test(parent) || parent === 'capacitor://app.crazygames.com';
  } catch {
    return false;
  }
})();

function loadSdk() {
  if (window.CrazyGames?.SDK) return Promise.resolve(window.CrazyGames.SDK);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SDK;
    s.onload = () => (window.CrazyGames?.SDK ? resolve(window.CrazyGames.SDK) : reject(new Error('CrazyGames SDK missing')));
    s.onerror = () => reject(new Error('Could not load the CrazyGames SDK'));
    document.head.appendChild(s);
  });
}

// Resolves once saves have a home. Anywhere but CrazyGames that's at once, with localStorage.
export async function openStore() {
  if (!inCrazyGames) return;
  try {
    const sdk = await Promise.race([
      loadSdk().then(async (sdk) => (await sdk.init(), sdk)),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), WAIT)),
    ]);
    if (sdk.environment !== 'crazygames') return;
    const d = sdk.data;
    // saves made here before the Data module was on move across once, without overwriting what it holds
    for (const k of KEYS) {
      let local = null;
      try { local = localStorage.getItem(k); } catch {}
      if (local != null && d.getItem(k) == null) d.setItem(k, local);
    }
    data = d;
  } catch (e) {
    console.info('CrazyGames saves not connected:', e?.code || e?.message || e);
  }
}
