// Street Rep: the shared leaderboard (server: api/lb.js).
//
// No sign-up. The first time someone fights, they pick a fight name; the server hands back a player id and
// a secret key, kept in localStorage with their last known record so the board shows something offline.
// The Player Code (id + key) moves a player, and the copy of their Story save the server keeps, to
// another device. Fights are reported as what happened (win, method, round); the server works out the rep.
// Nothing here ever blocks a fight: if the server can't be reached, the fight just isn't counted.

import { FIGHTERS, ROSTER } from './data.js';

const $ = (id) => document.getElementById(id);
const API = `${import.meta.env.VITE_API_BASE ?? ''}/api/lb`;
const IMG = `${import.meta.env.BASE_URL}img/`;
const KEY = 'gbasgbos.player.v1';
const SEEN = 'gbasgbos.rank.seen.v1'; // last rank seen per board, for the ▲/▼ on your row
const CODE = 'GGP1-';

export const FIGHTER_COLORS = { dayo: '#F5C518', bisi: '#FF6B35', emeka: '#4C8DFF', kola: '#2E9E6B', chief: '#E9E1D3', femi: '#9B6BFF' };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = (n) => Number(n || 0).toLocaleString('en-NG');
const NAME = /^[A-Za-z0-9_]{3,16}$/;

// ---------- this device's player ----------
function readJSON(k, fallback) {
  try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; }
}
function writeJSON(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
}

let me = readJSON(KEY, null);
if (!me?.id || !me?.key) me = null;
let skipped = false;
try { skipped = sessionStorage.getItem('gbasgbos.rank.skip') === '1'; } catch {}
const saveMe = () => writeJSON(KEY, me);

// ---------- server ----------
async function call(body) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(data.error || r.status), { code: data.error || 'error', status: r.status });
    return data;
  } catch (e) {
    throw e.code ? e : Object.assign(e, { code: 'offline' });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchBoard(board, fighter) {
  const q = new URLSearchParams({ board });
  if (fighter) q.set('fighter', fighter);
  if (me) q.set('id', me.id);
  const r = await fetch(`${API}?${q}`).catch(() => null);
  if (!r) throw Object.assign(new Error('offline'), { code: 'offline' });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.error || r.status), { code: data.error || 'error' });
  return data;
}

// fold a server reply into the cached record
function remember(res) {
  if (!me || !res) return;
  for (const k of ['name', 'main', 'w', 'l', 'd', 'ko', 'streak', 'best', 'rep']) if (k in res) me[k] = res[k];
  if ('week' in res) me.week = res.week;
  if ('all' in res) me.all = res.all;
  saveMe();
}

// ---------- fights ----------
let fight = null; // the fight under way: { token: Promise<string|null> }
let pending = null; // the last fight's result on its way to the server

export function begin({ fighter, opp, level, mode, chapter }) {
  fight = null;
  pending = null;
  if (!me || new URLSearchParams(location.search).has('autoplay')) return;
  fight = { token: call({ op: 'start', id: me.id, key: me.key, fighter, opp, level, mode, chapter }).then((r) => r.token, () => null) };
}

export function finish(r, p1) {
  const f = fight;
  fight = null;
  if (!f) return (pending = null);
  const out = !r.winner ? 'draw' : r.winner === p1 ? 'win' : 'loss';
  pending = f.token.then((token) => {
    if (!token) throw Object.assign(new Error('offline'), { code: 'offline' });
    return call({ op: 'result', id: me.id, key: me.key, token, out, method: r.method, round: r.round });
  }).then((res) => {
    remember(res);
    renderBar();
    return res;
  });
  pending.catch(() => {});
}

// a line on the result screens: what the fight was worth
export function showGain(el) {
  if (!el) return;
  el.className = 'rank-gain hidden';
  if (!pending) {
    if (!me && !new URLSearchParams(location.search).has('autoplay')) {
      el.innerHTML = 'Unranked fight. <u>Pick a fight name</u> to earn Street Rep.';
      el.className = 'rank-gain dim';
      el.onclick = () => askName().then(() => { if (me) el.innerHTML = `Next fight counts, <b>${esc(me.name)}</b>.`; });
    }
    return;
  }
  el.onclick = null;
  const p = pending;
  el.textContent = 'Adding up your Street Rep…';
  el.className = 'rank-gain dim';
  p.then((res) => {
    if (p !== pending) return;
    const bits = [`LEADERBOARD <b>+${res.gained}</b>`]; // not "Street Rep": Story's chapter card has its own
    if (res.week) bits.push(`#${fmt(res.week.rank)} THIS WEEK`);
    if (res.streak > 1) bits.push(`${res.streak} WIN STREAK`);
    el.innerHTML = bits.join(' · ');
    el.className = 'rank-gain';
  }, (e) => {
    if (p !== pending) return;
    el.textContent = e.code === 'too_fast' ? 'That one was too quick to count.' : e.code === 'removed' ? 'This name is off the board.' : 'Couldn’t reach the leaderboard, so this fight wasn’t counted.';
    el.className = 'rank-gain dim';
  });
}

// ---------- the fight name ----------
const BITS_A = ['Danfo', 'Okada', 'Keke', 'Molue', 'Suya', 'Jollof', 'Agege', 'Buka', 'Eko', 'Owambe', 'Shakara', 'Wahala', 'Pepper', 'Gbas', 'Gbos', 'Bole', 'Zobo', 'Puff', 'Area', 'Agbero', 'Yaba', 'Mushin', 'Ikeja', 'Oshodi', 'Third_Mainland', 'Gala', 'Chinchin', 'Dodo', 'Fuji', 'Amala'];
const BITS_B = ['King', 'Queen', 'Boss', 'Oga', 'Hook', 'Jab', 'Slugger', 'Express', 'Uppercut', 'Bomber', 'Champ', 'Hustler', 'Fist', 'Tiger', 'Hammer', 'Lion', 'Don', 'Kid', 'Machine', 'Thunder'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
export function funkyName() {
  for (;;) {
    const a = pick(BITS_A), b = pick(BITS_B);
    const n = Math.random();
    const name = n < 0.35 ? `${a}${b}${10 + Math.floor(Math.random() * 90)}` : n < 0.7 ? `${a}_${b}` : `${a}${b}`;
    if (name.length <= 16) return name;
  }
}

let suggestion = null; // from Lagos Life, when it gave us the player's name
export function suggest(name) {
  const s = String(name || '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 16);
  if (s.length >= 3) suggestion = s;
}

const NAME_MSG = {
  bad_name: '3 to 16 letters, numbers or _ (no spaces).',
  rude_name: 'Keep it clean. Pick another name.',
  taken: 'Somebody already fights under that name. Try another.',
  rate_limited: 'Too many tries. Wait a minute, then try again.',
  bad_key: 'Your Player Code didn’t work on this device. Open the leaderboard to set it up again.',
};

let nameDone = null; // resolves the dialog's promise

// before a fight: ask for a fight name once, unless this player said not now this visit
export const needsName = () => !me && !skipped && !new URLSearchParams(location.search).has('autoplay');
export function ensureName() {
  return needsName() ? askName() : Promise.resolve();
}

function askName({ rename = false } = {}) {
  const dlg = $('name-dialog');
  dlg.dataset.mode = rename ? 'rename' : 'new';
  $('name-title').textContent = rename ? 'NEW FIGHT NAME' : 'WHAT DO THEY CALL YOU?';
  $('name-skip').textContent = rename ? 'CANCEL' : 'NOT NOW';
  $('name-go').textContent = rename ? 'SAVE' : 'LET’S GO';
  $('name-have').classList.toggle('hidden', rename);
  $('name-in').value = rename ? me.name : suggestion ?? '';
  msg('name-msg', '3 to 16 letters, numbers or _ · no sign-up, no email');
  renderIdeas();
  dlg.classList.remove('hidden');
  if (!matchMedia('(pointer: coarse)').matches) setTimeout(() => $('name-in').focus(), 30);
  return new Promise((res) => (nameDone = res));
}

function closeName() {
  $('name-dialog').classList.add('hidden');
  $('name-in').blur();
  const done = nameDone;
  nameDone = null;
  done?.();
}

function renderIdeas() {
  const ideas = new Set();
  while (ideas.size < 3) ideas.add(funkyName());
  $('name-ideas').innerHTML = [...ideas].map((n) => `<button type="button" class="idea">${esc(n)}</button>`).join('');
}

function msg(id, text, tone = '') {
  $(id).textContent = text;
  $(id).className = `save-msg ${tone}`;
}

async function submitName() {
  const name = $('name-in').value.trim();
  if (!NAME.test(name)) return msg('name-msg', NAME_MSG.bad_name, 'bad');
  const rename = $('name-dialog').dataset.mode === 'rename';
  const go = $('name-go');
  go.disabled = true;
  msg('name-msg', rename ? 'Saving…' : 'Claiming your name…');
  try {
    if (rename) {
      const r = await call({ op: 'rename', id: me.id, key: me.key, name });
      me.name = r.name;
      saveMe();
    } else {
      const r = await call({ op: 'register', name });
      me = { id: r.id, key: r.key, name: r.name, w: 0, l: 0, d: 0, ko: 0, streak: 0, best: 0, rep: 0 };
      saveMe();
    }
    renderBar();
    closeName();
  } catch (e) {
    if (NAME_MSG[e.code]) msg('name-msg', NAME_MSG[e.code], 'bad');
    else if (rename) msg('name-msg', 'Couldn’t reach the leaderboard. Try again in a moment.', 'bad');
    else {
      // offline, or the board isn't open yet: fight anyway, unranked, and ask again next visit
      msg('name-msg', e.code === 'no_store' ? 'The leaderboard opens soon. This fight is unranked.' : 'Couldn’t reach the leaderboard. This fight is unranked.', 'bad');
      setTimeout(skipName, 1600);
    }
  } finally {
    go.disabled = false;
  }
}

function skipName() {
  if ($('name-dialog').dataset.mode === 'new') {
    skipped = true;
    try { sessionStorage.setItem('gbasgbos.rank.skip', '1'); } catch {}
  }
  closeName();
}

// ---------- Player Code: move to another device ----------
const codeOf = () => (me ? `${CODE}${me.id}.${me.key}` : '');

function openCard() {
  $('pc-name').textContent = me?.name ?? 'No fight name yet';
  $('pc-rename').textContent = me ? 'CHANGE NAME' : 'PICK A NAME';
  $('pc-out').value = codeOf();
  $('pc-copy').disabled = !me;
  $('pc-mine').classList.toggle('hidden', !me);
  $('pc-in').value = '';
  msg('pc-msg', '');
  $('player-dialog').classList.remove('hidden');
}

async function loadCode() {
  const raw = $('pc-in').value.trim();
  const m = raw.match(/^GGP1-([\w-]{6,24})\.([\w-]{20,64})$/);
  if (!m) return msg('pc-msg', 'That code doesn’t look right. It starts with GGP1-.', 'bad');
  const [, id, key] = m;
  msg('pc-msg', 'Checking…');
  try {
    const r = await call({ op: 'me', id, key });
    me = { id, key };
    remember(r);
    let note = `Welcome back, ${r.name}.`;
    if (r.story && hooks.importStory?.(r.story)) note += ' Your Story progress came with you.';
    msg('pc-msg', note, 'ok');
    $('pc-out').value = codeOf();
    $('pc-name').textContent = me.name;
    $('pc-mine').classList.remove('hidden');
    $('pc-copy').disabled = false;
    renderBar();
    if (!$('ranks').classList.contains('hidden')) load();
  } catch (e) {
    msg('pc-msg', e.code === 'bad_key' ? 'That code isn’t recognised. Check you copied all of it.' : 'Couldn’t reach the leaderboard. Try again in a moment.', 'bad');
  }
}

// keep a copy of the Story save with the player, so the Player Code brings it along
let storyTimer = null;
export function syncStory(code) {
  if (!me || !code) return;
  clearTimeout(storyTimer);
  storyTimer = setTimeout(() => call({ op: 'story', id: me.id, key: me.key, code }).catch(() => {}), 1500);
}

// ---------- Mode Select bar ----------
export function renderBar() {
  const el = $('rb-me');
  if (!el) return;
  if (!me) {
    el.innerHTML = 'Pick a fight name and climb the street';
    return;
  }
  const where = me.week ? `#${fmt(me.week.rank)} this week` : 'not ranked this week';
  el.innerHTML = `<b>${esc(me.name)}</b> · ${where} · ${fmt(me.rep)} REP`;
}

// ---------- the leaderboard screen ----------
let tab = 'week';
let fighterTab = 'dayo';
let loadId = 0;
const hooks = {};

export function initRank(h) {
  Object.assign(hooks, h);
  renderBar();
  // freshen the cached record for the Mode Select bar; a key the server no longer knows means start over
  if (me) call({ op: 'me', id: me.id, key: me.key }).then((r) => { remember(r); renderBar(); }, (e) => {
    if (e.code !== 'bad_key') return;
    me = null;
    try { localStorage.removeItem(KEY); } catch {}
    renderBar();
  });
  $('rank-open').addEventListener('click', openBoard);
  $('rk-back').addEventListener('click', () => {
    $('ranks').classList.add('hidden');
    hooks.back?.();
  });
  $('rk-climb').addEventListener('click', () => {
    $('ranks').classList.add('hidden');
    hooks.climb?.();
  });
  $('rk-card').addEventListener('click', openCard);
  document.querySelectorAll('#rk-tabs button').forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab;
    load();
  }));
  $('rk-fighters').innerHTML = ROSTER.map((id) => `<button data-f="${id}" style="--fc:${FIGHTER_COLORS[id]}">${FIGHTERS[id].firstName.toUpperCase()}</button>`).join('');
  $('rk-fighters').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    fighterTab = b.dataset.f;
    load();
  }));

  // the name dialog; the game's keys mustn't fire while typing
  for (const id of ['name-in', 'pc-in']) $(id).addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') (id === 'name-in' ? submitName : loadCode)();
    if (e.key === 'Escape' && id === 'name-in') skipName();
  });
  $('name-in').addEventListener('input', (e) => {
    const clean = e.target.value.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_]/g, '').slice(0, 16);
    if (clean !== e.target.value) e.target.value = clean;
  });
  $('name-go').addEventListener('click', submitName);
  $('name-skip').addEventListener('click', skipName);
  $('name-dice').addEventListener('click', () => {
    $('name-in').value = funkyName();
    renderIdeas();
  });
  $('name-ideas').addEventListener('click', (e) => {
    const b = e.target.closest('.idea');
    if (b) $('name-in').value = b.textContent;
  });
  $('name-have').addEventListener('click', () => {
    closeName();
    openCard();
  });

  $('pc-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(codeOf());
      msg('pc-msg', 'Copied. Keep it private: anyone with it can fight as you.', 'ok');
    } catch {
      $('pc-out').select();
      msg('pc-msg', 'Select the code above and copy it.');
    }
  });
  $('pc-load').addEventListener('click', loadCode);
  $('pc-rename').addEventListener('click', () => {
    $('player-dialog').classList.add('hidden');
    askName({ rename: !!me }).then(() => {
      if (!$('ranks').classList.contains('hidden')) load();
      openCard();
    });
  });
  $('pc-close').addEventListener('click', () => $('player-dialog').classList.add('hidden'));
}

export function openBoard() {
  hooks.open?.();
  $('ranks').classList.remove('hidden');
  load();
}

const cache = {}; // the last board seen per tab, shown while the fresh one loads

async function load() {
  const id = ++loadId;
  const k = tab === 'fighter' ? `fighter:${fighterTab}` : tab;
  document.querySelectorAll('#rk-tabs button').forEach((b) => {
    b.classList.toggle('on', b.dataset.tab === tab);
    b.setAttribute('aria-selected', b.dataset.tab === tab);
  });
  $('rk-fighters').classList.toggle('hidden', tab !== 'fighter');
  $('rk-fighters').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.f === fighterTab));
  if (cache[k]) render(cache[k]);
  else {
    $('rk-list').innerHTML = '<li class="rk-empty">Loading the street…</li>';
    $('rk-podium').innerHTML = '';
    $('rk-me').innerHTML = '';
    $('rk-gap').textContent = '';
  }
  try {
    const b = await fetchBoard(tab, tab === 'fighter' ? fighterTab : null);
    if (id !== loadId) return;
    cache[k] = b;
    if (b.me && tab !== 'fighter') remember({ [tab === 'week' ? 'week' : 'all']: { rank: b.me.rank, rep: b.me.rep } });
    render(b);
    renderBar();
  } catch (e) {
    if (id !== loadId || cache[k]) return;
    $('rk-list').innerHTML = `<li class="rk-empty">${e.code === 'no_store' ? 'The leaderboard opens soon. Fights still count once it does.' : e.code === 'rate_limited' ? 'Easy! Give it a moment, then try again.' : 'Couldn’t load the board. Check your connection and try again.'}</li>`;
    $('rk-meta').textContent = '';
  }
}

const left = (s) => {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${Math.max(1, m)}m`;
};
const mainTag = (id) => id && FIGHTERS[id]
  ? `<span class="rk-main" style="--fc:${FIGHTER_COLORS[id]}"><i></i>${FIGHTERS[id].firstName.toUpperCase()}</span>`
  : '<span class="rk-main">–</span>';
const badge = (name, main) => `<span class="rk-badge" style="--fc:${FIGHTER_COLORS[main] ?? '#B8AE9F'}">${esc(name[0]?.toUpperCase())}</span>`;
const streakCell = (n) => `<span class="rk-streak${n >= 3 ? ' hot' : ''}">${n}</span>`;

function render(b) {
  const label = tab === 'week' ? 'this week' : tab === 'all' ? 'all time' : `with ${FIGHTERS[b.fighter].firstName}`;
  const meta = [tab === 'week' ? `Week resets in <b>${left(b.resetsIn)}</b>` : null, `<b>${fmt(b.total)}</b> ${b.total === 1 ? 'fighter' : 'fighters'} ranked`];
  $('rk-meta').innerHTML = meta.filter(Boolean).join(' · ');

  // top three on cards
  const order = [1, 0, 2].map((i) => b.top[i]).filter(Boolean);
  $('rk-podium').innerHTML = order.map((r) => {
    const f = FIGHTERS[r.main] ?? FIGHTERS.dayo;
    return `<div class="pod p${r.rank}${r.me ? ' me' : ''}" style="--fc:${FIGHTER_COLORS[r.main] ?? '#F5C518'}">
      <span class="pod-n">${r.rank}</span>
      ${r.rank === 1 ? '<span class="pod-king">KING OF THE STREET</span>' : ''}
      <div class="pod-ph" style="background-image:url(${IMG}${f.id}.jpg)"></div>
      <div class="pod-info">
        <div class="pod-name${r.name.length > 12 ? ' long' : ''}">${esc(r.name)}</div>
        <div class="pod-f">${f.firstName.toUpperCase()} · ${esc(f.nickname.toUpperCase())}</div>
        <div class="pod-rec"><b>${r.w}–${r.l}</b> W-L <b>${r.ko}</b> KO${r.streak > 1 ? ` <em>${r.streak} streak</em>` : ''}</div>
        <div class="pod-rep"><b>${fmt(r.rep)}</b><span>REP</span></div>
      </div>
    </div>`;
  }).join('') || '<div class="pod-empty">Nobody on the street yet. Win a fight and take the crown.</div>';

  // everyone else in rows (on small screens the top three are rows too)
  $('rk-list').innerHTML = b.top.map((r) => row(r, '')).join('')
    || `<li class="rk-empty">Nobody ranked ${label} yet. Win a fight and be first.</li>`;

  // your row
  const seen = readJSON(SEEN, {});
  const k = tab === 'fighter' ? `f:${b.fighter}` : tab;
  if (b.me) {
    const was = seen[k];
    const move = was && was !== b.me.rank ? (was > b.me.rank ? `<i class="up">▲${was - b.me.rank}</i>` : `<i class="down">▼${b.me.rank - was}</i>`) : '';
    const pct = b.total >= 20 ? `Top ${Math.max(1, Math.ceil((100 * b.me.rank) / b.total))}% ${label}` : `#${fmt(b.me.rank)} of ${fmt(b.total)} ${label}`;
    $('rk-me').innerHTML = `<ol class="rk-list">${row(b.me, 'you', move, `YOU · ${pct}`)}</ol>`;
    seen[k] = b.me.rank;
    writeJSON(SEEN, seen);
    // the next target
    const above = b.top[b.me.rank - 2];
    $('rk-gap').innerHTML = b.me.rank === 1 ? `You run the street ${label}. Hold it.`
      : b.me.rank > b.top.length && b.top.length >= 50 ? `<b>${fmt(b.top[b.top.length - 1].rep - b.me.rep + 1)} REP</b> to break into the top 50`
      : above ? `<b>${fmt(above.rep - b.me.rep + 1)} REP</b> to pass ${esc(above.name)}` : '';
  } else if (me) {
    $('rk-me').innerHTML = `<div class="rk-you-empty"><b>${esc(me.name)}</b> isn’t on this board yet. Win a fight ${tab === 'fighter' ? `as ${FIGHTERS[b.fighter].firstName}` : ''} to get on it.</div>`;
    $('rk-gap').textContent = '';
  } else {
    $('rk-me').innerHTML = '<button class="rk-you-empty pick" id="rk-pick"><b>Pick a fight name</b> to get on the board. No sign-up.</button>';
    $('rk-pick').addEventListener('click', () => askName().then(() => load()));
    $('rk-gap').textContent = '';
  }

  // most picked this week
  const total = Object.values(b.picks).reduce((a, n) => a + n, 0);
  const picks = Object.entries(b.picks).sort((x, y) => y[1] - x[1]);
  $('rk-picks').innerHTML = picks.map(([id, n]) => {
    const pct = total ? Math.round((100 * n) / total) : 0;
    return `<span class="pk-n">${FIGHTERS[id].firstName.toUpperCase()}</span><span class="pk-bar"><i style="width:${pct}%;background:${FIGHTER_COLORS[id]}"></i></span><span class="pk-p">${pct}%</span>`;
  }).join('');
}

function row(r, cls, move = '', sub = null) {
  const district = sub ?? (FIGHTERS[r.main] ? `Reps ${FIGHTERS[r.main].district}` : '');
  return `<li class="rk-row ${cls}${r.rank <= 3 ? ' top3' : ''}${r.me && !cls ? ' mine' : ''}" style="--fc:${FIGHTER_COLORS[r.main] ?? '#B8AE9F'}">
    <span class="rk-rank">${r.rank}${move}</span>
    <span class="rk-player">${badge(r.name, r.main)}<span><b>${esc(r.name)}</b><small>${esc(district)}</small></span></span>
    ${mainTag(r.main)}
    <span class="rk-wl">${r.w}–${r.l}</span>
    <span class="rk-ko">${r.ko}</span>
    ${streakCell(r.streak)}
    <span class="rk-rep">${fmt(r.rep)}</span>
  </li>`;
}

export const rank = {
  get me() { return me; },
};
