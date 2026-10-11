import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { FIGHTERS, ROSTER, UNLOCK_NOTE } from './data.js';
import { buildArena } from './arena.js';
import { Fighter } from './fighter.js';
import { Referee } from './referee.js';
import { CPU } from './ai.js';
import { Input } from './input.js';
import { HUD } from './hud.js';
import { Match } from './match.js';
import { unlockAudio } from './audio.js';
import { Impacts } from './physics.js';
import { createStory } from './story/story.js';

const $ = (id) => document.getElementById(id);

// ---------- renderer and scene ----------
const canvas = $('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 120);
const camLook = new THREE.Vector3(0, 1.0, 0);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');

// ---------- state ----------
const hud = new HUD();
const input = new Input();
const models = {}; // id -> loading promise of the GLTF
let picks = { p1: 'dayo', cpu: 'bisi' };
let slot = 'p1'; // which corner the next tap on a fighter fills
let level = 'normal';
let match = null;
let fighters = null;
let ref = null;
let mode = 'menu';
let staged = null; // which pair is in the ring: 'quick' for the Quick Match picks, else Story's
let focus = 'both'; // who a story scene's camera looks at

// ---------- loading ----------
const loader = new GLTFLoader();
const load = (id) => (models[id] ??= new Promise((res, rej) => loader.load(`/models/${id}.glb`, res, undefined, rej)));
// each fighter gets its own copy of the skeleton, so mirror matches work
const instance = (gltf) => ({ scene: SkeletonUtils.clone(gltf.scene), animations: gltf.animations });

let arena = null;
let fx = null;

let refReady;
async function boot() {
  arena = buildArena(scene);
  fx = new Impacts(scene);
  showModes();
  refReady = load('ref').then((g) => {
    ref = new Referee(g);
    scene.add(ref.root);
  });
  try {
    await refReady;
  } catch (e) {
    $('loading').textContent = 'Could not load the referee. Refresh to try again.';
    $('save-chip').querySelector('span').textContent = 'Could not load the game. Refresh to try again.';
    console.error(e);
    return;
  }
  if (!staged) await setupFighters();
}

// a fighter to put in the ring: which model to load, its data, and optional kit colours (Story's Tunde)
const spec = (id) => ({ model: id, data: FIGHTERS[id] });

// give one fighter's kit new colours: its own copies of those materials, so the other corner is untouched
function tint(root, model, colors) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const key = o.material.name.replace(`${model}_`, '').replace(/\.\d+$/, '');
    if (colors[key]) {
      o.material = o.material.clone();
      o.material.color.set(colors[key]);
    }
  });
}

// load just the two fighters picked, then put them in the ring
let setupId = 0;
async function setupPair(A, B) {
  const id = ++setupId;
  const a = A.model, b = B.model;
  $('fight-btn').disabled = true;
  $('loading').classList.remove('hidden');
  $('loading').textContent = `Loading ${A.data.firstName}${A.data === B.data ? '' : ` and ${B.data.firstName}`}…`;
  let ga, gb;
  try {
    [ga, gb] = await Promise.all([load(a), load(b), refReady]);
  } catch (e) {
    delete models[a];
    delete models[b];
    $('loading').textContent = 'Could not load the fighters. Pick again or refresh.';
    console.error(e);
    return false;
  }
  if (id !== setupId) return false; // the picks changed while this was loading
  if (fighters) scene.remove(fighters[0].root, fighters[1].root);
  const ia = instance(ga), ib = instance(gb);
  if (A.colors) tint(ia.scene, a, A.colors);
  if (B.colors) tint(ib.scene, b, B.colors);
  const p1 = new Fighter(ia, A.data, -1);
  const p2 = new Fighter(ib, B.data, 1);
  scene.add(p1.root, p2.root);
  fighters = [p1, p2];
  if (mode === 'menu' || mode === 'modes' || mode === 'story') placeForMenu();
  $('loading').classList.add('hidden');
  $('fight-btn').disabled = false;
  return true;
}

async function setupFighters() {
  staged = 'quick';
  return setupPair(spec(picks.p1), spec(picks.cpu));
}

function placeForMenu() {
  fighters.forEach((f) => f.reset(true));
  fighters[0].x = -1.1;
  fighters[1].x = 1.1;
  fighters.forEach((f) => (f.root.position.x = f.x));
}

// ---------- menu ----------
const STATS = ['power', 'speed', 'stamina', 'defence'];
const surname = (f) => f.fullName.split(' ').slice(1).join(' ');

function renderPicks() {
  // the two corners: tap one, then tap a fighter
  for (const k of ['p1', 'cpu']) {
    const f = FIGHTERS[picks[k]];
    const el = $(`slot-${k}`);
    el.classList.toggle('on', slot === k);
    el.setAttribute('aria-pressed', slot === k);
    el.querySelector('.ph').style.backgroundImage = `url(/img/${f.id}.jpg)`;
    el.querySelector('.nm').textContent = f.firstName.toUpperCase();
    el.querySelector('.nk').textContent = `“${f.nickname}”`;
  }
  const grid = $('picks');
  grid.innerHTML = '';
  ROSTER.forEach((id, i) => {
    const f = FIGHTERS[id];
    const tags = [picks.p1 === id && '<i class="t1">P1</i>', picks.cpu === id && '<i class="t2">CPU</i>'].filter(Boolean).join('');
    const b = document.createElement('button');
    b.className = 'pick' + (picks[slot] === id ? ' on' : '') + (picks.p1 === id || picks.cpu === id ? ' taken' : '');
    b.setAttribute('aria-pressed', picks[slot] === id);
    b.setAttribute('aria-label', `${f.fullName}, ${f.style}`);
    b.innerHTML = `
      <div class="ph" style="background-image:url(/img/${id}.jpg)"><span class="no">0${i + 1}</span><span class="tags">${tags}</span></div>
      <div class="nm">${f.firstName.toUpperCase()}</div>
      <div class="nk">“${f.nickname}”</div>
      <div class="meta">${f.district}</div>`;
    b.addEventListener('click', () => choose(id));
    grid.appendChild(b);
  });
  // details of whoever the active corner has
  const f = FIGHTERS[picks[slot]];
  $('detail').innerHTML = `
    <div class="d-head">
      <div><div class="d-dist">${f.district.toUpperCase()}</div>
      <div class="d-name">${f.firstName.toUpperCase()} ${surname(f).toUpperCase()}</div>
      <div class="d-nick">“${f.nickname}”</div></div>
    </div>
    <p class="d-bio">${f.bio}</p>
    <div class="d-style"><b>${f.style}</b> · ${f.tagline}</div>
    <div class="stats">${STATS.map((k) => `<span>${k.toUpperCase()}</span><div class="bar"><i style="width:${f.stats[k] * 10}%"></i></div><b>${f.stats[k]}</b>`).join('')}</div>
    <div class="sig"><span>SIGNATURE · ${f.signature.name.toUpperCase()}</span>${f.signature.effect}</div>
    <div class="unlock">${UNLOCK_NOTE[f.unlock] ?? ''}${f.unlock === 'starter' ? '' : ' · open in Quick Match for the demo'}</div>`;
}

function choose(id) {
  const changed = picks[slot] !== id;
  picks[slot] = id;
  // fill P1 first, then hand the tap over to the CPU corner
  if (slot === 'p1') slot = 'cpu';
  renderPicks();
  if (changed) setupFighters();
}

for (const k of ['p1', 'cpu']) {
  $(`slot-${k}`).addEventListener('click', () => {
    slot = k;
    renderPicks();
  });
}

document.querySelectorAll('#difficulty button').forEach((b) => {
  b.setAttribute('aria-checked', b.classList.contains('on'));
  b.addEventListener('click', () => {
    level = b.dataset.v;
    document.querySelectorAll('#difficulty button').forEach((x) => {
      x.classList.toggle('on', x === b);
      x.setAttribute('aria-checked', x === b);
    });
  });
});

function showMenu() {
  mode = 'menu';
  document.body.classList.remove('fighting');
  $('menu').classList.remove('hidden');
  $('results').classList.add('hidden');
  $('pause').classList.add('hidden');
  hud.show(false);
  $('touch').classList.add('hidden');
  hud.hideFlash();
  hud.count(null);
  if (fighters) {
    placeForMenu();
    ref.reset();
  }
  slot = 'p1';
  renderPicks();
}

function startFight() {
  if (!fighters || $('fight-btn').disabled) return;
  startMatch();
}

// shared by Quick Match and Story. Quick Match passes nothing, so it plays exactly as it always has;
// Story passes its chapter's rules, hooks, level and CPU tweak.
function startMatch({ rules, hooks, level: lv, cpuTweak, onEnd } = {}) {
  unlockAudio();
  $('menu').classList.add('hidden');
  $('results').classList.add('hidden');
  document.body.classList.add('fighting');
  hud.show(true);
  if (isTouch) $('touch').classList.remove('hidden');
  const [p1, p2] = fighters;
  hud.setNames(p1.data, p2.data);
  const cpu = new CPU(p2, p1, lv ?? level);
  cpuTweak?.(cpu);
  match = new Match({ p1, p2, ref, cpu, input, hud, onEnd: onEnd ?? showResults, fx, arena, rules, hooks });
  // ?autoplay lets the CPU box for P1 too (attract mode and automated tests)
  if (new URLSearchParams(location.search).has('autoplay')) match.autoP1 = new CPU(p1, p2, lv ?? level);
  match.start();
  mode = 'fight';
}

// a story fight is over (or abandoned): drop the HUD and stop driving the match
function endMatch() {
  match = null;
  hud.show(false);
  hud.hideFlash();
  hud.count(null);
  $('touch').classList.add('hidden');
  $('pause').classList.add('hidden');
  document.body.classList.remove('fighting');
}

$('fight-btn').disabled = true;
$('fight-btn').addEventListener('click', startFight);

// ---------- mode select ----------
function showModes() {
  mode = 'modes';
  for (const id of ['menu', 'story', 'results', 'pause', 'chapter-end', 'scene']) $(id).classList.add('hidden');
  document.body.classList.remove('fighting');
  hud.show(false);
  $('touch').classList.add('hidden');
  $('modes').classList.remove('hidden');
  story.renderModeCard();
  if (fighters) {
    placeForMenu();
    ref?.reset();
  }
}

$('mode-cpu').addEventListener('click', () => {
  $('modes').classList.add('hidden');
  showMenu();
  // coming back from Story, the ring still has Story's pair in it
  if (staged !== 'quick') setupFighters();
});
$('mode-story').addEventListener('click', () => {
  $('modes').classList.add('hidden');
  story.showMap();
});
$('menu-back').addEventListener('click', () => {
  $('menu').classList.add('hidden');
  showModes();
});

const story = createStory({
  hud,
  isTouch,
  renderer,
  loadModel: load,
  async setupPair(a, b) {
    staged = 'story';
    return setupPair(a, b);
  },
  startMatch,
  endMatch,
  setMode: (m) => (mode = m),
  setFocus: (f) => (focus = f),
  get fighters() { return fighters; },
  get match() { return match; },
  showModes,
});

// ---------- pause ----------
function setPause(on) {
  if (mode !== 'fight' || !match) return;
  match.paused = on;
  $('pause').classList.toggle('hidden', !on);
}
input.onPause = () => setPause(!match?.paused);
$('pause-btn').addEventListener('click', () => setPause(true));
$('resume-btn').addEventListener('click', () => setPause(false));
$('quit-btn').addEventListener('click', () => {
  setPause(false);
  if (story.active) return story.quit();
  match = null;
  showMenu();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) setPause(true);
});

// ---------- results ----------
function showResults(r) {
  mode = 'results';
  hud.show(false);
  $('touch').classList.add('hidden');
  document.body.classList.remove('fighting');
  const [p1, p2] = fighters;
  const w = r.winner;
  const clock = `${Math.floor(r.clock / 60)}:${String(Math.floor(r.clock % 60)).padStart(2, '0')}`;
  $('res-big').textContent = r.method === 'DECISION' ? (w ? 'DECISION' : 'DRAW') : r.method === 'TKO' ? 'T.K.O.!' : 'K.O.!';
  $('res-big').style.fontSize = r.method === 'DECISION' ? 'clamp(64px, 11vw, 150px)' : '';
  if (w) {
    $('res-meta').textContent = r.method === 'DECISION' ? `WINNER · ${r.kind}` : `WINNER · ROUND ${r.round} · ${clock}`;
    $('res-name').textContent = `${w.data.firstName} “${w.data.nickname}” ${w.data.fullName.split(' ')[1]}`.toUpperCase();
    $('res-line').textContent = r.method === 'DECISION'
      ? (w === p1 ? 'You took it on the judges’ cards.' : 'The CPU took it on the judges’ cards.')
      : r.lastSig ? `Finished with a signature ${r.lastSig}.` : r.method === 'TKO' ? 'Three knockdowns. The referee waved it off.' : 'Counted out on the canvas.';
  } else {
    $('res-meta').textContent = 'AFTER 3 ROUNDS';
    $('res-name').textContent = 'NOBODY BLINKED';
    $('res-line').textContent = 'The judges could not split them.';
  }
  const acc = (f) => (f.stats.thrown ? Math.round((100 * f.stats.landed) / f.stats.thrown) : 0) + '%';
  $('res-stats').innerHTML = `
    <span class="h">FIGHT STATS</span><span class="h" style="color:#9E3412">YOU</span><span class="h" style="color:#1F4FA8">CPU</span>
    <span>Punches landed</span><span>${p1.stats.landed}</span><span>${p2.stats.landed}</span>
    <span>Accuracy</span><span>${acc(p1)}</span><span>${acc(p2)}</span>
    <span>Biggest combo</span><span>${p1.stats.bestCombo}</span><span>${p2.stats.bestCombo}</span>
    <span>Knockdowns</span><span>${p1.stats.knockdownsScored}</span><span>${p2.stats.knockdownsScored}</span>`;
  let card = '';
  if (r.judges) {
    card = `<div class="k">JUDGES’ SCORECARDS</div><table>
      <tr><th></th><th style="color:#FF6B35">${p1.data.firstName.toUpperCase()}</th><th style="color:#4C8DFF">${p2.data.firstName.toUpperCase()}</th></tr>
      ${r.judges.map(([a, b], i) => `<tr><td>Judge ${i + 1}</td><td>${a}</td><td>${b}</td></tr>`).join('')}
      <tr class="tot"><td>${r.kind}</td><td></td><td></td></tr></table>`;
  } else {
    card = `<div class="k">ROUND BY ROUND</div><table>
      <tr><th></th><th style="color:#FF6B35">${p1.data.firstName.toUpperCase()}</th><th style="color:#4C8DFF">${p2.data.firstName.toUpperCase()}</th></tr>
      ${match.cards.map((c, i) => `<tr><td>Round ${i + 1} damage</td><td>${Math.round(c.d1)}</td><td>${Math.round(c.d2)}</td></tr>`).join('')}
      <tr class="tot"><td>${r.method === 'TKO' ? 'T.K.O.' : 'K.O.'}</td><td>${w === p1 ? 'WIN' : ''}</td><td>${w === p2 ? 'WIN' : ''}</td></tr></table>`;
  }
  $('res-card').innerHTML = card;
  $('results').classList.remove('hidden');
}
$('rematch-btn').addEventListener('click', startFight);
$('menu-btn').addEventListener('click', showMenu);

// ---------- camera and loop ----------
const clock = new THREE.Clock();
const camPos = new THREE.Vector3(0, 1.6, 6);
const ORBIT = new Set(['menu', 'modes', 'story']); // screens with the slow orbit behind them

function updateCamera(dt) {
  let mid = 0, gap = 2;
  if (fighters) {
    mid = (fighters[0].x + fighters[1].x) / 2;
    gap = Math.abs(fighters[1].x - fighters[0].x);
  }
  // on narrow (portrait) screens pull back just enough to fit both fighters across
  const halfW = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
  const fit = (gap + 1.8) / 2 / halfW;
  let dist = Math.max(4.1 + gap * 0.55, fit);
  const narrow = Math.max(1, 1.5 / camera.aspect);
  let height = 1.55 + Math.min(1.2, (dist - 4.6) * 0.12);
  let lookY = 1.0 - Math.min(0.3, (narrow - 1) * 0.12);
  let x = mid * 0.85;
  if (mode === 'scene' && fighters) {
    // story scenes: close on whoever is talking, or both of them
    const f = focus === 'p1' ? fighters[0] : focus === 'p2' ? fighters[1] : null;
    const span = f ? 1.3 : gap + 1.6;
    dist = Math.max(f ? 2.7 : 4.0, span / 2 / halfW);
    x = f ? f.x * 0.9 : mid;
    height = 1.45;
    lookY = 1.12;
    camPos.lerp(new THREE.Vector3(x, height, dist), Math.min(1, dt * 2.5));
    camLook.lerp(new THREE.Vector3(f ? f.x : mid, lookY, 0), Math.min(1, dt * 3));
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    return;
  }
  if (ORBIT.has(mode)) {
    // slow orbit behind the menu
    const t = performance.now() / 1000;
    x = Math.sin(t * 0.15) * 1.6;
    dist = 5.2 * narrow;
    height = 1.7;
  }
  camPos.lerp(new THREE.Vector3(x, height, dist), Math.min(1, dt * 3));
  camLook.lerp(new THREE.Vector3(ORBIT.has(mode) ? 0 : mid, lookY, 0), Math.min(1, dt * 4));
  camera.position.copy(camPos);
  if (match?.kick) camera.position.x += match.kick;
  const s = match?.shake ?? 0;
  if (s > 0.001) camera.position.add(new THREE.Vector3((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, 0));
  camera.lookAt(camLook);
}

function frame() {
  const dt = Math.min(clock.getDelta(), 1 / 20);
  if (mode === 'fight' || mode === 'results') {
    if (match) match.update(mode === 'results' ? dt : dt);
  } else if (fighters) {
    fighters.forEach((f) => f.animate(dt));
    ref?.update(dt);
    if (mode === 'scene') fx?.update(dt);
  }
  if (mode === 'movie') {
    // a Story cold open: its own set, camera and timeline
    story.movie.update(dt);
    if (mode === 'movie') {
      story.movie.render();
      requestAnimationFrame(frame);
      return;
    }
  }
  updateCamera(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

renderPicks();
boot();
frame();

// handy for debugging and automated tests
window.__gg = {
  get match() { return match; }, get fighters() { return fighters; }, get mode() { return mode; }, start: startFight, story,
  // pick both corners and wait for the models: await __gg.pick('kola', 'femi')
  async pick(p1, cpu) {
    picks = { p1, cpu };
    renderPicks();
    return setupFighters();
  },
  // advance the game without rendering: sim(seconds) steps at 60 Hz
  sim(seconds) {
    for (let t = 0; t < seconds && (mode === 'fight' || mode === 'results'); t += 1 / 60) match.update(1 / 60);
  },
};
