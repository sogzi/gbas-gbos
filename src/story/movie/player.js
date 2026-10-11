// Plays a cold-open movie: loads the cast, drives the set, the actors and the camera from the film's
// timeline, and shows the subtitles. Everything is a function of the film time, so seek() and skip() are exact.
import * as THREE from 'three';
import { buildSet } from './set.js';
import { Actor } from './actor.js';

const $ = (id) => document.getElementById(id);
export const clamp01 = (x) => Math.max(0, Math.min(1, x));
export const seg = (t, t0, t1) => clamp01((t - t0) / (t1 - t0));
export const ease = (u) => u * u * (3 - 2 * u);
export const V = (x, y, z) => new THREE.Vector3(x, y, z);

// walk an actor along a path of points between two times; before and after, it stands at the ends
export function walkPath(actor, t, t0, t1, pts, faceAfter) {
  const lens = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += lens[i - 1] = pts[i].distanceTo(pts[i - 1]);
  const u = seg(t, t0, t1);
  let d = u * total, i = 0;
  while (i < lens.length - 1 && d > lens[i]) d -= lens[i++];
  const a = pts[i], b = pts[i + 1];
  const pos = a.clone().lerp(b, lens[i] ? d / lens[i] : 0);
  const moving = t > t0 && t < t1;
  actor.place(pos, moving || !faceAfter ? b.clone().sub(a).multiplyScalar(10).add(pos) : faceAfter);
  if (moving) actor.walk(u * total, total / (t1 - t0));
  return pos;
}

export function createMovie({ renderer, loadModel }) {
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 400);
  const look = new THREE.Vector3();
  let baseFov = 34;
  let set = null;
  let film = null;
  let cast = {};
  let t = 0;
  let playing = false;
  let done = null;
  let exposure = 1.05;
  const ui = {};

  async function load(f) {
    set ??= buildSet();
    for (const a of Object.values(cast)) set.root.remove(a.root);
    cast = {};
    const entries = Object.entries(f.cast);
    const gltfs = await Promise.all(entries.map(([, spec]) => loadModel(spec.model)));
    entries.forEach(([k, spec], i) => {
      cast[k] = new Actor(gltfs[i], spec);
      set.root.add(cast[k].root);
    });
    set.setDistrict(f.district, f.names);
    film = f;
  }

  function cam(pos, at, fov = 34) {
    camera.position.copy(pos);
    look.copy(at);
    camera.lookAt(look);
    baseFov = fov;
  }
  // a camera move between two framings, eased
  function move(t, t0, t1, [p0, l0, f0 = 34], [p1, l1, f1 = f0], curve = ease) {
    const u = curve(seg(t, t0, t1));
    cam(p0.clone().lerp(p1, u), l0.clone().lerp(l1, u), THREE.MathUtils.lerp(f0, f1, u));
  }

  function apply(time) {
    t = time;
    for (const a of Object.values(cast)) a.pose = {};
    film.frame({ t, cast, set, dress: set.dress[film.district].userData, cam, move });
    set.setFocus(look);
    const [a, b, k] = film.light(t);
    exposure = set.light(a, b, k);
    const opts = typeof film.setOpts === 'function' ? film.setOpts(t) : { ...film.setOpts };
    opts.clear = [...(opts.clear ?? []), { x: camera.position.x, z: camera.position.z, r: 3.2 }];
    set.update(t, opts);
    for (const actor of Object.values(cast)) actor.update();
    // props that follow a hand go last, once the bones are posed
    film.after?.({ t, cast, dress: set.dress[film.district].userData });
    overlay();
  }

  function overlay() {
    const at = (list) => list?.find(([t0, t1]) => t >= t0 && t < t1);
    const line = at(film.lines);
    const cap = at(film.caps);
    ui.sub.classList.toggle('hidden', !line);
    if (line && ui.lineKey !== line) {
      ui.lineKey = line;
      ui.subWho.textContent = line[2];
      ui.subWho.className = line[4] ?? '';
      ui.subLine.textContent = line[3];
      ui.sub.style.animation = 'none';
      void ui.sub.offsetWidth;
      ui.sub.style.animation = '';
    }
    ui.cap.classList.toggle('hidden', !cap);
    if (cap) ui.cap.textContent = cap[2];
    ui.title.classList.toggle('hidden', !(t > 0.3 && t < 4.2));
    // fades: black in at the start and out at the end
    const fadeIn = 1 - seg(t, 0, 1.2);
    const fadeOut = seg(t, film.length - 0.9, film.length);
    ui.fade.style.opacity = Math.max(fadeIn, fadeOut, ...(film.fades ?? []).map(([a, b]) => (t > a && t < b ? Math.sin(Math.PI * seg(t, a, b)) : 0)));
  }

  function show(on) {
    $('movie').classList.toggle('hidden', !on);
  }

  return {
    camera,
    get t() { return t; },
    get playing() { return playing; },
    get film() { return film; },
    get scene() { return set?.scene; },
    async prepare(f) {
      await load(f);
    },
    start(f, tag, onDone) {
      Object.assign(ui, { sub: $('mv-sub'), subWho: $('mv-who'), subLine: $('mv-line'), cap: $('mv-cap'), title: $('mv-title'), fade: $('mv-fade') });
      ui.lineKey = null;
      $('mv-tag').textContent = tag;
      ui.title.innerHTML = `<b>${f.title}</b><span>${tag}</span>`;
      done = onDone;
      playing = true;
      show(true);
      apply(0);
    },
    hold: false, // tests freeze the film on a frame
    update(dt) {
      if (!playing || this.hold) return;
      apply(t + dt);
      if (t >= film.length) this.stop();
    },
    seek(time) {
      apply(time);
    },
    stop() {
      if (!playing) return;
      playing = false;
      show(false);
      const cb = done;
      done = null;
      cb?.();
    },
    render() {
      const size = renderer.getSize(new THREE.Vector2());
      // the films are framed for a wide screen: on a tall one, open the lens so the action still fits across
      const aspect = size.x / size.y;
      const fov = aspect < 1.4 ? baseFov * (1 + (1.4 - aspect) * 0.8) : baseFov;
      if (Math.abs(camera.aspect - aspect) > 1e-3 || camera.fov !== fov) {
        camera.aspect = aspect;
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
      const before = renderer.toneMappingExposure;
      renderer.toneMappingExposure = exposure;
      renderer.render(set.scene, camera);
      renderer.toneMappingExposure = before;
    },
  };
}
