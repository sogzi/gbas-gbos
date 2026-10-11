import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FIGHTERS } from './data.js';
import { buildArena } from './arena.js';
import { Fighter } from './fighter.js';
import { Referee } from './referee.js';
import { CPU } from './ai.js';
import { Input } from './input.js';
import { HUD } from './hud.js';
import { Match } from './match.js';
import { unlockAudio } from './audio.js';
import { Impacts } from './physics.js';

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
const models = {};
let p1Pick = 'dayo';
let level = 'normal';
let match = null;
let fighters = null;
let ref = null;
let mode = 'menu';

// ---------- loading ----------
const loader = new GLTFLoader();
const load = (id) => new Promise((res, rej) => loader.load(`/models/${id}.glb`, res, undefined, rej));

let arena = null;
let fx = null;

async function boot() {
  arena = buildArena(scene);
  fx = new Impacts(scene);
  try {
    const [d, b, r] = await Promise.all([load('dayo'), load('bisi'), load('ref')]);
    models.dayo = d;
    models.bisi = b;
    models.ref = r;
  } catch (e) {
    $('loading').textContent = 'Could not load the fighters. Refresh to try again.';
    console.error(e);
    return;
  }
  ref = new Referee(models.ref);
  scene.add(ref.root);
  $('loading').classList.add('hidden');
  $('fight-btn').disabled = false;
  setupFighters();
  showMenu();
}

function setupFighters() {
  if (fighters) {
    scene.remove(fighters[0].root, fighters[1].root);
  }
  const cpuPick = p1Pick === 'dayo' ? 'bisi' : 'dayo';
  const p1 = new Fighter(models[p1Pick], FIGHTERS[p1Pick], -1);
  const p2 = new Fighter(models[cpuPick], FIGHTERS[cpuPick], 1);
  scene.add(p1.root, p2.root);
  fighters = [p1, p2];
}

// ---------- menu ----------
function renderPicks() {
  const el = $('picks');
  el.innerHTML = '';
  for (const id of ['dayo', 'bisi']) {
    const f = FIGHTERS[id];
    const on = id === p1Pick;
    const b = document.createElement('button');
    b.className = 'pick' + (on ? ' on' : '');
    b.setAttribute('aria-pressed', on);
    b.innerHTML = `
      <div class="ph" style="background-image:url(/img/${id}.jpg)"></div>
      <div class="nm">${f.firstName.toUpperCase()} ${f.fullName.split(' ')[1].toUpperCase()}</div>
      <div class="nk">“${f.nickname.toUpperCase()}”</div>
      <div class="meta">${f.district} · ${f.style}</div>
      <div class="tag">${on ? 'P1 · RED CORNER' : 'CPU · BLUE CORNER'}</div>
      <div class="stats" style="grid-column:1/-1">
        ${['power', 'speed', 'stamina', 'defence'].map((k) => `<span>${k.toUpperCase()}</span><div class="bar"><i style="width:${f.stats[k] * 10}%"></i></div>`).join('')}
      </div>
      <div class="sig"><b>${f.signature.name}:</b> ${f.signature.effect}</div>`;
    b.addEventListener('click', () => {
      if (p1Pick === id) return;
      p1Pick = id;
      renderPicks();
      if (models.dayo) setupFighters();
    });
    el.appendChild(b);
  }
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
    fighters.forEach((f) => f.reset(true));
    fighters[0].x = -1.1;
    fighters[1].x = 1.1;
    fighters.forEach((f) => (f.root.position.x = f.x));
    ref.reset();
  }
  renderPicks();
}

function startFight() {
  unlockAudio();
  $('menu').classList.add('hidden');
  $('results').classList.add('hidden');
  document.body.classList.add('fighting');
  hud.show(true);
  if (isTouch) $('touch').classList.remove('hidden');
  const [p1, p2] = fighters;
  hud.setNames(p1.data, p2.data);
  const cpu = new CPU(p2, p1, level);
  match = new Match({ p1, p2, ref, cpu, input, hud, onEnd: showResults, fx, arena });
  // ?autoplay lets the CPU box for P1 too (attract mode and automated tests)
  if (new URLSearchParams(location.search).has('autoplay')) match.autoP1 = new CPU(p1, p2, level);
  match.start();
  mode = 'fight';
}

$('fight-btn').disabled = true;
$('fight-btn').addEventListener('click', startFight);

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
  if (mode === 'menu') {
    // slow orbit behind the menu
    const t = performance.now() / 1000;
    x = Math.sin(t * 0.15) * 1.6;
    dist = 5.2 * narrow;
    height = 1.7;
  }
  camPos.lerp(new THREE.Vector3(x, height, dist), Math.min(1, dt * 3));
  camLook.lerp(new THREE.Vector3(mode === 'menu' ? 0 : mid, lookY, 0), Math.min(1, dt * 4));
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
  get match() { return match; }, get fighters() { return fighters; }, get mode() { return mode; }, start: startFight,
  // advance the game without rendering: sim(seconds) steps at 60 Hz
  sim(seconds) {
    for (let t = 0; t < seconds && (mode === 'fight' || mode === 'results'); t += 1 / 60) match.update(1 / 60);
  },
};
