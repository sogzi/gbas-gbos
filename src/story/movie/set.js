// The street the cold-open movies are shot on: one Lagos road, redressed for each district and lit for
// its time of day (Oshodi at dawn to Lagos Island at night). It lives in its own scene, away from the ring.
import * as THREE from 'three';

const PALETTE = ['#E86A92', '#5FB36B', '#F5C518', '#4C8DFF', '#FF8A3D', '#F2E6C9', '#9B6BD6', '#45B8AC', '#E4572E', '#D9D2C5'];
const CLOTH = ['#E4572E', '#4C8DFF', '#F5C518', '#2E9E6B', '#9B6BD6', '#F4EEE3', '#13110F', '#E86A92', '#45B8AC', '#FF8A3D', '#7A4B2A'];
const SKIN = ['#5A2E17', '#6B3A1F', '#4A2512', '#7A4526', '#3E1F0F'];
export const ROAD = { half: 4, walk: 7.5 }; // road edge and building line (|z|)

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const pick = (r, a) => a[Math.floor(r() * a.length)];

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const std = (color, rough = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });

function box(w, h, d, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}

function cyl(rt, rb, h, mat, parent, seg = 14) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.castShadow = true;
  parent.add(m);
  return m;
}

// a block of flats: the painted wall, and a matching glow map where some windows are lit at night
function buildingTex(base, r) {
  const lit = [];
  const map = canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.05})`;
      g.fillRect(r() * w, r() * h, 10 + r() * 60, 6 + r() * 30);
    }
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 3; x++) {
        const wx = 26 + x * 76, wy = 30 + y * 68;
        g.fillStyle = '#2B2B33';
        g.fillRect(wx, wy, 50, 40);
        g.fillStyle = r() > 0.6 ? '#3D5A73' : '#1E2228';
        g.fillRect(wx + 4, wy + 4, 42, 32);
        if (r() < 0.35) lit.push([wx + 4, wy + 4]);
        g.fillStyle = 'rgba(244,238,227,.55)';
        for (let b = 1; b < 4; b++) g.fillRect(wx + b * 12, wy + 4, 2, 32);
        if (r() > 0.75) {
          g.fillStyle = PALETTE[Math.floor(r() * PALETTE.length)];
          g.fillRect(wx + 6, wy + 40, 14, 12);
        }
      }
    }
  });
  const glow = canvasTex(256, 512, (g) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, 256, 512);
    for (const [x, y] of lit) {
      g.fillStyle = r() > 0.5 ? '#FFC870' : '#FFE2A8';
      g.fillRect(x, y, 42, 32);
    }
  });
  return { map, glow };
}

export function signTex(text, bg, fg, w = 512, h = 128, font = 86) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = fg;
    let size = font;
    g.font = `${size}px Anton, Impact, sans-serif`;
    while (g.measureText(text).width > w * 0.92 && size > 20) g.font = `${(size -= 4)}px Anton, Impact, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 4);
  });
}

function sign(text, bg, fg, w, h, parent) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: signTex(text, bg, fg, 512, Math.round((512 * h) / w), Math.round(((512 * h) / w) * 0.7)), roughness: 0.6 }));
  parent.add(m);
  return m;
}

// the quit notice: a printed A4 sheet with the Landlord's seal
export function noticeTex() {
  return canvasTex(256, 360, (g, w, h) => {
    g.fillStyle = '#F4EEE3';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#B3261E';
    g.font = '44px Anton, Impact, sans-serif';
    g.textAlign = 'center';
    g.fillText('QUIT NOTICE', w / 2, 58);
    g.fillStyle = '#13110F';
    g.font = '600 15px sans-serif';
    ['This motor park is to be', 'vacated in 30 days.', '', 'By order of', 'ADEWALE HOLDINGS'].forEach((l, i) => g.fillText(l, w / 2, 104 + i * 24));
    g.fillStyle = 'rgba(19,17,15,.25)';
    for (let i = 0; i < 6; i++) g.fillRect(30, 236 + i * 14, w - 60 - (i % 3) * 30, 5);
    g.strokeStyle = '#7D5BD6';
    g.lineWidth = 5;
    g.beginPath();
    g.arc(w - 62, h - 50, 28, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#7D5BD6';
    g.font = '13px Anton, Impact, sans-serif';
    g.fillText('SEAL', w - 62, h - 46);
  });
}

// ---------- vehicles ----------
export function buildDanfo(opts = {}) {
  const g = new THREE.Group();
  const yellow = std(opts.color ?? '#F5C518', 0.45);
  const black = std('#13110F', 0.5);
  const glass = std('#22303A', 0.2, { metalness: 0.2 });
  const L = 5.2, W = 2.1;
  // body: the near (right-hand, +z) side is open at the sliding door
  const door = { x0: -2.2, x1: -1.1 };
  box(L, 0.95, W, yellow, 0, 0.92, 0, g); // lower body
  box(L, 0.5, W, yellow, 0, 2.08, 0, g); // roof band
  box(L, 0.08, W + 0.02, black, 0, 1.36, 0, g);
  box(L, 0.08, W + 0.02, black, 0, 0.62, 0, g);
  // pillars between the windows on both sides
  for (const z of [-W / 2, W / 2]) for (let i = 0; i <= 4; i++) box(0.12, 0.62, 0.08, yellow, -2.55 + i * 1.27, 1.7, z, g);
  // windows: far side all glass; near side glass except the open door
  for (let i = 0; i < 4; i++) {
    box(1.15, 0.6, 0.04, glass, -1.9 + i * 1.27, 1.7, -W / 2, g);
    if (i > 0) box(1.15, 0.6, 0.04, glass, -1.9 + i * 1.27, 1.7, W / 2, g);
  }
  // cut the door out of the near side: a dark doorway and a step
  const doorway = box(door.x1 - door.x0, 1.5, 0.05, std('#1A1714', 0.9), (door.x0 + door.x1) / 2, 1.2, W / 2 + 0.005, g);
  doorway.castShadow = false;
  box(door.x1 - door.x0 + 0.1, 0.06, 0.3, black, (door.x0 + door.x1) / 2, 0.42, W / 2 + 0.1, g); // step
  box(0.05, 0.7, 1.8, glass, L / 2 + 0.01, 1.7, 0, g); // windscreen
  box(0.06, 0.25, 1.5, black, L / 2 + 0.02, 0.8, 0, g); // grille
  for (const z of [-0.75, 0.75]) {
    const lamp = box(0.04, 0.16, 0.28, std('#FFF4D6', 0.3, { emissive: '#FFE7A8', emissiveIntensity: 0 }), L / 2 + 0.03, 1.02, z, g);
    lamp.userData.lamp = true;
  }
  // passengers' heads in the windows
  const r = rng(opts.seed ?? 3);
  for (let i = 0; i < 6; i++) {
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), std(pick(r, SKIN), 0.6));
    head.position.set(-1.6 + i * 0.75, 1.62, (i % 2 ? -1 : 1) * 0.4);
    g.add(head);
  }
  // a rail by the door for the conductor
  const rail = cyl(0.025, 0.025, 1.2, std('#C9C2B6', 0.3, { metalness: 0.6 }), g, 8);
  rail.position.set(door.x1 - 0.06, 1.35, W / 2 + 0.06);
  g.userData.grip = new THREE.Vector3(door.x1 - 0.06, 1.75, W / 2 + 0.06);
  g.userData.step = new THREE.Vector3((door.x0 + door.x1) / 2 + 0.15, 0.45, W / 2 + 0.12);
  // wheels
  g.userData.wheels = [];
  for (const [wx, wz] of [[-1.7, 1.02], [1.7, 1.02], [-1.7, -1.02], [1.7, -1.02]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.28, 16), std('#1B1B1E', 0.8));
    w.rotation.x = Math.PI / 2;
    w.position.set(wx, 0.4, wz);
    const hub = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.29, 0.08), std('#9A938A', 0.5));
    w.add(hub);
    g.add(w);
    g.userData.wheels.push(w);
  }
  if (opts.text) {
    const s = sign(opts.text, '#13110F', '#F5C518', 2.6, 0.32, g);
    s.position.set(-0.5, 2.08, W / 2 + 0.012);
  }
  return g;
}

export function buildKeke(color) {
  const g = new THREE.Group();
  const body = std(color, 0.5);
  box(1.9, 0.9, 1.2, body, 0, 0.8, 0, g);
  box(1.6, 0.08, 1.3, std('#13110F', 0.6), -0.1, 1.75, 0, g); // canvas roof
  for (const x of [-0.85, 0.75]) for (const z of [-0.55, 0.55]) box(0.05, 0.6, 0.05, std('#13110F', 0.5), x, 1.45, z, g);
  g.userData.wheels = [];
  for (const [x, z] of [[0.9, 0], [-0.7, 0.55], [-0.7, -0.55]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.14, 12), std('#1B1B1E', 0.8));
    w.rotation.x = Math.PI / 2;
    w.position.set(x, 0.25, z);
    g.add(w);
    g.userData.wheels.push(w);
  }
  return g;
}

export function buildCar(color) {
  const g = new THREE.Group();
  const body = std(color, 0.35, { metalness: 0.3 });
  box(4.2, 0.7, 1.8, body, 0, 0.65, 0, g);
  box(2.3, 0.6, 1.6, std('#22303A', 0.2, { metalness: 0.3 }), -0.2, 1.25, 0, g);
  box(2.2, 0.06, 1.62, body, -0.2, 1.57, 0, g);
  g.userData.wheels = [];
  for (const [x, z] of [[-1.3, 0.85], [1.3, 0.85], [-1.3, -0.85], [1.3, -0.85]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.22, 14), std('#1B1B1E', 0.8));
    w.rotation.x = Math.PI / 2;
    w.position.set(x, 0.34, z);
    g.add(w);
    g.userData.wheels.push(w);
  }
  for (const z of [-0.6, 0.6]) {
    const lamp = box(0.04, 0.12, 0.3, std('#FFF4D6', 0.3, { emissive: '#FFE7A8', emissiveIntensity: 0 }), 2.11, 0.75, z, g);
    lamp.userData.lamp = true;
  }
  return g;
}

export function buildBike() {
  // a delivery motorbike with a box on the back
  const g = new THREE.Group();
  const dark = std('#1B1B1E', 0.6);
  for (const x of [-0.65, 0.65]) {
    const w = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.08, 8, 18), dark);
    w.position.set(x, 0.32, 0);
    w.castShadow = true;
    g.add(w);
  }
  box(1.0, 0.28, 0.3, std('#E4572E', 0.4), 0, 0.68, 0, g);
  box(0.6, 0.12, 0.32, std('#13110F', 0.6), -0.15, 0.86, 0, g); // seat
  const bar = cyl(0.03, 0.03, 0.7, dark, g, 8);
  bar.position.set(0.55, 1.0, 0);
  bar.rotation.x = Math.PI / 2;
  const fork = cyl(0.035, 0.035, 0.75, dark, g, 8);
  fork.position.set(0.6, 0.65, 0);
  fork.rotation.z = 0.3;
  const crate = box(0.55, 0.5, 0.55, std('#2E9E6B', 0.5), -0.6, 1.05, 0, g);
  const label = sign('EXPRESS', '#2E9E6B', '#F4EEE3', 0.5, 0.18, crate);
  label.position.set(0, 0.05, 0.28);
  return g;
}

// ---------- extras: the people who make it Lagos ----------
function buildExtra(r) {
  const g = new THREE.Group();
  const skin = std(pick(r, SKIN), 0.6);
  const top = std(pick(r, CLOTH), 0.8);
  const bottom = std(pick(r, ['#2B2B33', '#3D5A73', '#5A524B', '#13110F', pick(r, CLOTH)]), 0.85);
  const tall = 0.9 + r() * 0.2;
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(s * 0.1, 0.82 * tall, 0);
    const leg = cyl(0.075, 0.06, 0.8 * tall, bottom, hip, 8);
    leg.position.y = -0.4 * tall;
    g.add(hip);
    legs.push(hip);
  }
  const wrapper = r() < 0.4; // a wrapper skirt instead of trousers
  if (wrapper) {
    const sk = cyl(0.17, 0.24, 0.62 * tall, std(pick(r, CLOTH), 0.8), g, 12);
    sk.position.y = 0.52 * tall;
  }
  const torso = cyl(0.17, 0.15, 0.62 * tall, top, g, 12);
  torso.position.y = 1.12 * tall;
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(s * 0.22, 1.38 * tall, 0);
    const arm = cyl(0.05, 0.045, 0.6 * tall, s > 0 ? top : top, sh, 8);
    arm.position.y = -0.3 * tall;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), skin);
    hand.position.y = -0.62 * tall;
    sh.add(hand);
    g.add(sh);
    arms.push(sh);
  }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), skin);
  head.position.y = 1.6 * tall;
  head.castShadow = true;
  g.add(head);
  // what's on the head: a hawker's tray, a basin, a gele, a cap, or nothing
  const k = r();
  if (k < 0.22) {
    const tray = cyl(0.32, 0.28, 0.07, std('#C9C2B6', 0.3, { metalness: 0.5 }), g, 16);
    tray.position.y = 1.78 * tall;
    for (let i = 0; i < 5; i++) {
      const item = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), std(pick(r, ['#E4572E', '#F5C518', '#2E9E6B', '#F4EEE3']), 0.6));
      item.position.set(Math.cos(i * 1.3) * 0.16, 1.85 * tall, Math.sin(i * 1.3) * 0.16);
      g.add(item);
    }
  } else if (k < 0.36) {
    const basin = cyl(0.28, 0.2, 0.18, std(pick(r, ['#4C8DFF', '#E4572E', '#F4EEE3']), 0.5), g, 16);
    basin.position.y = 1.83 * tall;
  } else if (k < 0.5 && wrapper) {
    const gele = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.06, 8, 14), std(pick(r, CLOTH), 0.7));
    gele.rotation.x = Math.PI / 2;
    gele.position.y = 1.7 * tall;
    g.add(gele);
  } else if (k < 0.62) {
    const cap = cyl(0.13, 0.14, 0.08, std(pick(r, CLOTH), 0.7), g, 12);
    cap.position.y = 1.72 * tall;
  }
  g.userData = { legs, arms, phase: r() * 6, carry: k < 0.36 };
  return g;
}

// ---------- the whole street ----------
export function buildSet() {
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  scene.add(root);
  const r = rng(11);

  // sky: a gradient dome, plus a sun disc
  const skyU = { top: { value: new THREE.Color('#2B3A67') }, mid: { value: new THREE.Color('#F7A35C') }, bot: { value: new THREE.Color('#F2C79B') } };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(180, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, uniforms: skyU,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0, 0.55, h)) : mix(mid, bot, smoothstep(0.0, -0.2, h)); gl_FragColor = vec4(c, 1.); }',
    }),
  );
  scene.add(sky);
  const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(5, 20, 12), new THREE.MeshBasicMaterial({ color: '#FFD9A0', fog: false }));
  scene.add(sunDisc);
  scene.fog = new THREE.Fog('#F2C79B', 30, 110);

  // ground
  const asphalt = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#4A4540';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1600; i++) {
      g.fillStyle = `rgba(${Math.random() > 0.5 ? 255 : 0},${Math.random() > 0.5 ? 255 : 0},0,${Math.random() * 0.04})`;
      g.fillRect(Math.random() * w, Math.random() * h, 3 + Math.random() * 20, 2 + Math.random() * 8);
    }
    // patched potholes
    for (let i = 0; i < 6; i++) {
      g.fillStyle = 'rgba(20,18,16,.35)';
      g.beginPath();
      g.ellipse(Math.random() * w, Math.random() * h, 20 + Math.random() * 30, 10 + Math.random() * 14, 0, 0, 7);
      g.fill();
    }
  });
  asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping;
  asphalt.repeat.set(30, 4);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(240, ROAD.half * 2), std('#FFFFFF', 0.95, { map: asphalt }));
  road.rotation.x = -Math.PI / 2;
  road.receiveShadow = true;
  root.add(road);
  for (let i = -40; i <= 40; i++) box(1.6, 0.01, 0.14, std('#F4EEE3', 0.8), i * 3, 0.005, 0, root).castShadow = false;
  for (const s of [-1, 1]) {
    const walk = new THREE.Mesh(new THREE.PlaneGeometry(240, 60), std('#8A8072', 0.95));
    walk.rotation.x = -Math.PI / 2;
    walk.position.set(0, 0.12, s * (ROAD.half + 30));
    walk.receiveShadow = true;
    root.add(walk);
    // kerb, painted black and yellow like everywhere in Lagos
    const kerbTex = canvasTex(64, 16, (g) => {
      g.fillStyle = '#F5C518';
      g.fillRect(0, 0, 64, 16);
      g.fillStyle = '#13110F';
      g.fillRect(0, 0, 32, 16);
    });
    kerbTex.wrapS = THREE.RepeatWrapping;
    kerbTex.repeat.set(120, 1);
    box(240, 0.16, 0.25, std('#FFFFFF', 0.8, { map: kerbTex }), 0, 0.06, s * ROAD.half, root);
  }

  // buildings on both sides, with gaps the camera can see through. Facades come from a small pool
  // (clones share one upload on the GPU), so phones aren't holding a hundred textures.
  const facades = PALETTE.map((c) => buildingTex(c, r));
  const facade = (rr, w, h) => {
    const t = facades[Math.floor(rr() * facades.length)];
    const out = { map: t.map.clone(), glow: t.glow.clone() };
    for (const tex of [out.map, out.glow]) {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(w, h);
    }
    return out;
  };
  const windows = [];
  const lamps = [];
  const buildRow = (s, x0, x1, gapFrom, gapTo) => {
    let x = x0;
    while (x < x1) {
      const w = 3 + r() * 3.5, h = 6 + r() * 11, d = 6;
      if (x + w > gapFrom && x < gapTo) {
        x = gapTo;
        continue;
      }
      const t = facade(r, Math.max(1, Math.round(w / 3.2)), Math.max(1, Math.round(h / 6.5)));
      const mat = std('#FFFFFF', 0.92, { map: t.map, emissiveMap: t.glow, emissive: '#FFFFFF', emissiveIntensity: 0 });
      windows.push(mat);
      box(w, h, d, mat, x + w / 2, h / 2, s * (ROAD.walk + d / 2 + r() * 1.2), root);
      box(w + 0.2, 0.3, d + 0.2, std('#D9D2C5', 0.9), x + w / 2, h + 0.15, s * (ROAD.walk + d / 2), root);
      if (r() > 0.4) {
        const tank = cyl(0.55, 0.55, 1.1, std('#1B1B1E', 0.6), root, 18);
        tank.position.set(x + w * (0.25 + r() * 0.5), h + 0.85, s * (ROAD.walk + 2 + r() * 2));
      }
      // ground-floor awning
      if (r() > 0.35) {
        const aw = box(w * 0.8, 0.08, 1.4, std(pick(r, ['#E4572E', '#4C8DFF', '#2E9E6B', '#F5C518']), 0.7), x + w / 2, 2.7, s * (ROAD.walk - 0.6), root);
        aw.rotation.x = s * 0.18;
      }
      x += w + 0.08 + r() * 0.4;
    }
  };
  buildRow(-1, -70, 70, 999, 999);
  buildRow(1, -70, 70, 7, 27); // the motor park opens off the near side

  // street lamps along both kerbs
  for (let x = -60; x <= 60; x += 14) {
    for (const s of [-1, 1]) {
      const pole = cyl(0.07, 0.09, 6.5, std('#6B6259', 0.7), root, 8);
      pole.position.set(x + (s > 0 ? 7 : 0), 3.25, s * (ROAD.half + 0.5));
      const arm = box(1.4, 0.08, 0.08, std('#6B6259', 0.7), x + (s > 0 ? 7 : 0), 6.4, s * (ROAD.half - 0.1), root);
      arm.rotation.y = Math.PI / 2;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), std('#FFF4D6', 0.3, { emissive: '#FFD27A', emissiveIntensity: 0 }));
      bulb.position.set(x + (s > 0 ? 7 : 0), 6.3, s * (ROAD.half - 0.7));
      root.add(bulb);
      lamps.push(bulb.material);
    }
  }

  // ---------- light ----------
  const hemi = new THREE.HemisphereLight('#FFF4E2', '#6E5E50', 1.5);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#FFE3C2', 2.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 120 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight('#B8D4FF', 0.6);
  fill.position.set(10, 8, 20);
  scene.add(fill);
  // a warm pool from the street lamps at night (one light that follows the action)
  const glowLight = new THREE.PointLight('#FFC27A', 0, 26, 1.4);
  scene.add(glowLight);

  // ---------- traffic and crowd ----------
  const traffic = [];
  const vehicles = [
    () => buildDanfo({ seed: 5 }), () => buildDanfo({ seed: 6 }), () => buildKeke('#F5C518'), () => buildCar('#C9C2B6'),
    () => buildDanfo({ seed: 7 }), () => buildKeke('#2E9E6B'), () => buildCar('#B3261E'), () => buildDanfo({ seed: 8 }),
  ];
  vehicles.forEach((make, i) => {
    const v = make();
    const dir = i % 2 ? -1 : 1;
    v.rotation.y = dir > 0 ? 0 : Math.PI;
    v.position.z = dir * 2.0 * (dir > 0 ? 1 : 1) * (dir > 0 ? 1 : 1);
    v.position.z = dir > 0 ? 2.0 : -2.0;
    root.add(v);
    traffic.push({ obj: v, dir, x0: -60 + i * 17, speed: 5 + (i % 3) * 1.6 });
  });
  const crowd = [];
  const cr = rng(29);
  for (let i = 0; i < 46; i++) {
    const p = buildExtra(cr);
    const s = i % 2 ? -1 : 1;
    const dir = cr() > 0.5 ? 1 : -1;
    root.add(p);
    crowd.push({ obj: p, s, dir, x0: -50 + cr() * 100, z: s * (ROAD.half + 0.9 + cr() * 2.2), speed: 0.9 + cr() * 0.6, still: cr() < 0.25 });
  }

  // ---------- per-district dressing ----------
  const dress = {};
  const group = (n) => {
    const g = new THREE.Group();
    g.visible = false;
    root.add(g);
    dress[n] = g;
    return g;
  };
  // shop signs that change with the district
  const shopSigns = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), new THREE.MeshStandardMaterial({ roughness: 0.6 }));
    const s = i % 2 ? 1 : -1;
    m.position.set(-24 + i * 9, 3.3, s * (ROAD.walk - 0.05));
    if (s > 0) m.rotation.y = Math.PI;
    root.add(m);
    shopSigns.push(m);
  }
  // an overhead footbridge with the district's name on it
  const bridge = new THREE.Group();
  root.add(bridge);
  const concrete = std('#BDB3A4', 0.9);
  box(2.4, 0.5, ROAD.half * 2 + 6, concrete, 0, 6.2, 0, bridge);
  for (const s of [-1, 1]) {
    box(0.5, 6.2, 0.5, concrete, 0, 3.1, s * (ROAD.half + 1.2), bridge);
    box(2.4, 0.9, 0.1, concrete, 0, 6.9, s * 0.9, bridge);
  }
  const bridgeSign = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 0.85), new THREE.MeshStandardMaterial({ roughness: 0.6 }));
  bridgeSign.position.set(-1.22, 6.2, 0);
  bridgeSign.rotation.y = -Math.PI / 2;
  bridge.add(bridgeSign);
  bridge.position.x = -14;

  // 1 Oshodi: the motor park, its arch and the quit notices
  {
    const g = group(1);
    const arch = new THREE.Group();
    g.add(arch);
    for (const x of [8.5, 15.5]) box(0.7, 5, 0.7, std('#F5C518', 0.6), x, 2.5, ROAD.walk - 0.3, arch);
    box(7.7, 1.1, 0.5, std('#13110F', 0.6), 12, 5.2, ROAD.walk - 0.3, arch);
    const name = sign('OSHODI MOTOR PARK', '#13110F', '#F5C518', 7, 0.9, arch);
    name.position.set(12, 5.2, ROAD.walk - 0.56);
    name.rotation.y = Math.PI;
    // the notice, pasted on the right pillar, facing the road
    const notice = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.7), new THREE.MeshStandardMaterial({ map: noticeTex(), roughness: 0.8 }));
    notice.position.set(15.5, 1.75, ROAD.walk - 0.66);
    notice.rotation.y = Math.PI;
    arch.add(notice);
    g.userData.notice = notice;
    // more notices up the left pillar
    for (let i = 0; i < 2; i++) {
      const n2 = notice.clone();
      n2.position.set(8.5, 1.4 + i * 0.8, ROAD.walk - 0.66);
      n2.rotation.z = (i - 0.5) * 0.12;
      arch.add(n2);
    }
    // parked danfos in the park
    for (let i = 0; i < 6; i++) {
      const bus = buildDanfo({ seed: 20 + i });
      bus.position.set(8 + (i % 3) * 6.5, 0, ROAD.walk + 4 + Math.floor(i / 3) * 4);
      bus.rotation.y = Math.PI / 2 + (i % 2 ? 0.1 : -0.06);
      g.add(bus);
    }
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 22), std('#6E655A', 0.95));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(17, 0.13, ROAD.walk + 11);
    ground.receiveShadow = true;
    g.add(ground);
    // umbrellas and stalls along the far kerb
    umbrellas(g, r, -1, -30, 30);
    // the danfo Dayo rides in on
    const hero = buildDanfo({ seed: 41, text: 'OSHODI · OBALENDE · CMS' });
    g.add(hero);
    g.userData.hero = hero;
  }
  // 2 Ojuelegba: Bisi's buka
  {
    const g = group(2);
    const buka = new THREE.Group();
    buka.position.set(4, 0.12, -(ROAD.walk - 2.2));
    g.add(buka);
    g.userData.buka = buka;
    box(4.4, 0.1, 2.6, std('#E4572E', 0.7), 0, 2.6, 0, buka); // awning
    for (const x of [-2.1, 2.1]) for (const z of [-1.2, 1.2]) cyl(0.05, 0.05, 2.6, std('#6B6259', 0.6), buka, 8).position.set(x, 1.3, z);
    const s = sign('MAMA PUT BUKA', '#E4572E', '#F4EEE3', 4.2, 0.6, buka);
    s.position.set(0, 2.95, 1.31);
    box(2.6, 0.9, 0.9, std('#7A4B2A', 0.8), -0.6, 0.45, -0.6, buka); // counter
    for (let i = 0; i < 4; i++) {
      const bowl = cyl(0.2, 0.12, 0.12, std(pick(r, ['#F4EEE3', '#4C8DFF', '#E4572E']), 0.4), buka, 14);
      bowl.position.set(-1.6 + i * 0.6, 0.96, -0.6);
    }
    // the big pot over a fire
    const pot = cyl(0.42, 0.36, 0.6, std('#2B2B33', 0.4, { metalness: 0.4 }), buka, 20);
    pot.position.set(1.3, 0.6, 0.2);
    const fire = cyl(0.36, 0.42, 0.25, std('#FF8A3D', 0.5, { emissive: '#FF6B35', emissiveIntensity: 1.6 }), buka, 12);
    fire.position.set(1.3, 0.13, 0.2);
    const jollof = cyl(0.4, 0.4, 0.04, std('#D9481C', 0.6), buka, 20);
    jollof.position.set(1.3, 0.88, 0.2);
    g.userData.pot = pot;
    g.userData.steam = steam(buka, new THREE.Vector3(1.3, 1.0, 0.2));
    for (const x of [-1.2, 0.8]) box(1.6, 0.45, 0.4, std('#7A4B2A', 0.8), x, 0.23, 1.6, buka); // benches
    const ladle = new THREE.Group();
    const handle = cyl(0.018, 0.018, 0.9, std('#7A4B2A', 0.7), ladle, 6);
    handle.position.y = -0.45;
    const cup = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), std('#9A938A', 0.3, { metalness: 0.6, side: THREE.DoubleSide }));
    cup.position.y = -0.9;
    ladle.add(cup);
    g.add(ladle);
    g.userData.ladle = ladle;
    const notice = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.56), new THREE.MeshStandardMaterial({ map: noticeTex(), roughness: 0.8 }));
    notice.position.set(2.16, 1.6, 1.2);
    buka.add(notice);
    umbrellas(g, r, -1, -30, -2);
    umbrellas(g, r, -1, 9, 30);
  }
  // 3 Ikeja: Computer Village, phones and signs everywhere
  {
    const g = group(3);
    for (let i = 0; i < 5; i++) {
      const stall = new THREE.Group();
      stall.position.set(-8 + i * 4.5, 0.12, -(ROAD.walk - 1.2));
      box(2.6, 1.0, 0.9, std('#2B2B33', 0.6), 0, 0.5, 0, stall);
      box(2.8, 0.08, 1.4, std(pick(r, ['#4C8DFF', '#F5C518', '#E4572E']), 0.6), 0, 2.4, 0, stall);
      for (let k = 0; k < 6; k++) box(0.14, 0.26, 0.02, std('#13110F', 0.3, { emissive: '#4C8DFF', emissiveIntensity: 0.3 }), -1 + k * 0.4, 1.12, 0.2, stall);
      const s = sign(pick(r, ['PHONE & ACCESSORIES', 'WE FIX ALL PHONES', 'LAPTOP REPAIRS', 'SCREEN GUARD ₦500', 'ORIGINAL CHARGERS']), '#F4EEE3', '#13110F', 2.6, 0.38, stall);
      s.position.set(0, 2.62, 0.71);
      g.add(stall);
    }
    const bike = buildBike();
    g.add(bike);
    g.userData.bike = bike;
    const env = box(0.24, 0.16, 0.02, std('#E8D9B0', 0.8), 0, 0, 0, g);
    g.userData.envelope = env;
  }
  // 4 Yaba: the tech hub and Femi's table
  {
    const g = group(4);
    const hub = new THREE.Group();
    hub.position.set(3, 0.12, -(ROAD.walk + 0.1));
    g.add(hub);
    box(10, 4.2, 0.3, std('#1E2228', 0.15, { metalness: 0.5, emissive: '#3D5A73', emissiveIntensity: 0.2 }), 0, 2.1, 0, hub);
    const s = sign('YABA LABS', '#13110F', '#45B8AC', 4.5, 0.8, hub);
    s.position.set(0, 4.7, 0.2);
    const table = new THREE.Group();
    table.position.set(2, 0, 1.8);
    hub.add(table);
    box(1.6, 0.06, 0.8, std('#C9C2B6', 0.5), 0, 0.76, 0, table);
    for (const x of [-0.7, 0.7]) for (const z of [-0.32, 0.32]) box(0.05, 0.76, 0.05, std('#6B6259', 0.6), x, 0.38, z, table);
    box(0.42, 0.02, 0.3, std('#9A938A', 0.4, { metalness: 0.6 }), 0, 0.8, -0.05, table);
    const lid = box(0.42, 0.28, 0.02, std('#9A938A', 0.4, { metalness: 0.6 }), 0, 0.95, 0.1, table);
    lid.rotation.x = -0.25;
    const screen = box(0.4, 0.26, 0.005, std('#13110F', 0.3, { emissive: '#45B8AC', emissiveIntensity: 0.9 }), 0, 0.95, 0.088, table);
    screen.rotation.x = -0.25;
    box(0.5, 0.45, 0.5, std('#2B2B33', 0.7), 0, 0.23, -0.85, table); // stool
    g.userData.table = table;
    const sticker = sign('412 SENT · 0 BUGS', '#13110F', '#45B8AC', 0.36, 0.08, table);
    sticker.position.set(0, 0.97, 0.115);
    sticker.rotation.x = -0.25;
    umbrellas(g, r, -1, -30, -4);
  }
  // 5 Mushin: the boxing club and a heavy bag out front
  {
    const g = group(5);
    const gym = new THREE.Group();
    gym.position.set(2, 0.12, -(ROAD.walk + 0.05));
    g.add(gym);
    box(6, 3.4, 0.2, std('#3A332B', 0.9), 0, 1.7, 0, gym);
    box(1.4, 2.4, 0.22, std('#13110F', 0.8), -1.5, 1.2, 0.01, gym); // door
    const s = sign('MUSHIN BOXING CLUB · EST. 1987', '#B3261E', '#F4EEE3', 5.6, 0.7, gym);
    s.position.set(0, 3.0, 0.12);
    const frame = new THREE.Group();
    frame.position.set(1.4, 0, 1.6);
    gym.add(frame);
    for (const x of [-0.9, 0.9]) cyl(0.05, 0.05, 2.8, std('#6B6259', 0.6), frame, 8).position.set(x, 1.4, 0);
    const beam = cyl(0.05, 0.05, 1.9, std('#6B6259', 0.6), frame, 8);
    beam.rotation.z = Math.PI / 2;
    beam.position.y = 2.8;
    const pivot = new THREE.Group();
    pivot.position.y = 2.8;
    frame.add(pivot);
    const chain = cyl(0.01, 0.01, 0.45, std('#9A938A', 0.4, { metalness: 0.7 }), pivot, 6);
    chain.position.y = -0.22;
    const bag = cyl(0.22, 0.22, 1.1, std('#B3261E', 0.5), pivot, 16);
    bag.position.y = -1.0;
    g.userData.bag = pivot;
    g.userData.frame = frame;
    umbrellas(g, r, -1, -30, -5);
  }
  // 6 Lagos Island: towers, the Landlord's building and his car
  {
    const g = group(6);
    const tr = rng(77);
    for (let i = 0; i < 14; i++) {
      const w = 6 + tr() * 6, h = 30 + tr() * 45;
      const t = facade(tr, 3, Math.round(h / 5));
      const mat = std('#FFFFFF', 0.4, { map: t.map, emissiveMap: t.glow, emissive: '#FFFFFF', emissiveIntensity: 0, metalness: 0.2 });
      windows.push(mat);
      box(w, h, w, mat, -60 + i * 9 + tr() * 3, h / 2, -(ROAD.walk + 18 + tr() * 14), g);
    }
    const hq = sign('ADEWALE HOLDINGS', '#13110F', '#D9A521', 9, 1.2, g);
    hq.position.set(2, 8.5, -(ROAD.walk - 0.02));
    const suv = buildCar('#13110F');
    suv.scale.set(1.15, 1.25, 1.1);
    g.add(suv);
    g.userData.suv = suv;
  }

  function umbrellas(g, rr, s, x0, x1) {
    for (let x = x0; x < x1; x += 3.2 + rr() * 2) {
      const u = new THREE.Group();
      u.position.set(x, 0.12, s * (ROAD.half + 1.6 + rr() * 0.8));
      const pole = cyl(0.03, 0.03, 2.3, std('#6B6259', 0.6), u, 6);
      pole.position.y = 1.15;
      const top = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.5, 8, 1, true), std(pick(rr, ['#E4572E', '#F5C518', '#4C8DFF', '#2E9E6B', '#F4EEE3']), 0.6, { side: THREE.DoubleSide }));
      top.position.y = 2.4;
      top.castShadow = true;
      u.add(top);
      box(1.1, 0.75, 0.6, std(pick(rr, ['#7A4B2A', '#5A524B']), 0.8), 0, 0.38, 0, u);
      for (let k = 0; k < 4; k++) {
        const item = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), std(pick(rr, ['#E4572E', '#F5C518', '#2E9E6B', '#FF8A3D']), 0.6));
        item.position.set(-0.4 + k * 0.27, 0.82, 0);
        u.add(item);
      }
      g.add(u);
    }
  }

  function steam(parent, at) {
    const puffs = [];
    const mat = new THREE.MeshBasicMaterial({ color: '#F4EEE3', transparent: true, opacity: 0.35, depthWrite: false });
    for (let i = 0; i < 8; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), mat.clone());
      parent.add(p);
      puffs.push(p);
    }
    return { puffs, at };
  }

  // ---------- lighting presets ----------
  const LIGHTS = {
    night: { top: '#0B1230', mid: '#1E2A55', bot: '#141A2E', fog: '#141A2E', sun: '#8FA8FF', sunI: 0.35, sunPos: [20, 30, 10], hemi: ['#5D6FA8', '#1A1714', 0.55], exposure: 1.1, glow: 1, disc: '#E8ECFF', discPos: [-60, 70, -120] },
    predawn: { top: '#1B2550', mid: '#C26E7A', bot: '#3A2E4A', fog: '#4A3A55', sun: '#FF9A6B', sunI: 0.5, sunPos: [80, 4, -60], hemi: ['#8A7AB8', '#3A2E2A', 0.8], exposure: 1.05, glow: 0.8, disc: '#FFB27A', discPos: [120, -6, -100] },
    dawn: { top: '#5A7BC0', mid: '#FFB070', bot: '#F2C79B', fog: '#E8B48E', sun: '#FFC08A', sunI: 2.1, sunPos: [70, 14, -50], hemi: ['#FFE0C0', '#6E5E50', 1.3], exposure: 1.05, glow: 0.15, disc: '#FFD9A0', discPos: [130, 14, -100] },
    morning: { top: '#6FA3E0', mid: '#F8D9AE', bot: '#F2C79B', fog: '#F0D2B0', sun: '#FFE7C8', sunI: 2.6, sunPos: [40, 30, -25], hemi: ['#FFF4E2', '#6E5E50', 1.5], exposure: 1.05, glow: 0, disc: '#FFF0D0', discPos: [120, 50, -100] },
    noon: { top: '#4E8FE0', mid: '#CFE3F5', bot: '#E8E0D0', fog: '#DCE6EE', sun: '#FFF6E8', sunI: 2.9, sunPos: [6, 40, 12], hemi: ['#FFFFFF', '#6E5E50', 1.6], exposure: 1.0, glow: 0, disc: '#FFFFFF', discPos: [20, 170, 30] },
    afternoon: { top: '#5B95DB', mid: '#F2E1C4', bot: '#E8D6B8', fog: '#E8DCC6', sun: '#FFE9C4', sunI: 2.7, sunPos: [-30, 26, 20], hemi: ['#FFF4E2', '#6E5E50', 1.5], exposure: 1.02, glow: 0, disc: '#FFF0D0', discPos: [-110, 70, 60] },
    golden: { top: '#5A6FB8', mid: '#FF9F5A', bot: '#F2B482', fog: '#E8A878', sun: '#FFB46A', sunI: 2.4, sunPos: [-60, 10, 30], hemi: ['#FFD7B0', '#5E4A40', 1.2], exposure: 1.08, glow: 0.3, disc: '#FFB870', discPos: [-130, 12, 60] },
    dusk: { top: '#2A2F66', mid: '#E0686A', bot: '#5A3550', fog: '#5A3A55', sun: '#FF7A5A', sunI: 0.9, sunPos: [-70, 5, 30], hemi: ['#9A7AB8', '#2E2420', 0.85], exposure: 1.08, glow: 0.75, disc: '#FF8A5A', discPos: [-130, -2, 60] },
  };
  const C = (h) => new THREE.Color(h);
  const blend = (a, b, k) => {
    const A = LIGHTS[a], B = LIGHTS[b] ?? A;
    const col = (key) => C(A[key]).lerp(C(B[key]), k);
    const v = (key) => new THREE.Vector3(...A[key]).lerp(new THREE.Vector3(...B[key]), k);
    return {
      top: col('top'), mid: col('mid'), bot: col('bot'), fog: col('fog'), sun: col('sun'), disc: col('disc'),
      sunI: THREE.MathUtils.lerp(A.sunI, B.sunI, k), sunPos: v('sunPos'), discPos: v('discPos'),
      hemiSky: C(A.hemi[0]).lerp(C(B.hemi[0]), k), hemiGround: C(A.hemi[1]).lerp(C(B.hemi[1]), k), hemiI: THREE.MathUtils.lerp(A.hemi[2], B.hemi[2], k),
      exposure: THREE.MathUtils.lerp(A.exposure, B.exposure, k), glow: THREE.MathUtils.lerp(A.glow, B.glow, k),
    };
  };

  let focus = new THREE.Vector3();
  function light(a, b = a, k = 0) {
    const L = blend(a, b, k);
    skyU.top.value.copy(L.top);
    skyU.mid.value.copy(L.mid);
    skyU.bot.value.copy(L.bot);
    scene.fog.color.copy(L.fog);
    sun.color.copy(L.sun);
    sun.intensity = L.sunI;
    sun.position.copy(focus).add(L.sunPos.clone().normalize().multiplyScalar(40));
    sun.target.position.copy(focus);
    sunDisc.position.copy(L.discPos);
    sunDisc.material.color.copy(L.disc);
    hemi.color.copy(L.hemiSky);
    hemi.groundColor.copy(L.hemiGround);
    hemi.intensity = L.hemiI;
    for (const m of windows) m.emissiveIntensity = L.glow * 1.4;
    for (const m of lamps) m.emissiveIntensity = L.glow * 3;
    glowLight.intensity = L.glow * 30;
    glowLight.position.set(focus.x, 5.5, focus.z + 2);
    root.traverse((o) => {
      if (o.userData.lamp) o.material.emissiveIntensity = L.glow * 3;
    });
    return L.exposure;
  }

  function setDistrict(n, names) {
    for (const k in dress) dress[k].visible = +k === n;
    bridge.visible = !!names.bridge;
    if (names.bridge) {
      bridgeSign.material.map?.dispose();
      bridgeSign.material.map = signTex(names.bridge, '#2E9E6B', '#F4EEE3', 1024, 134, 96);
      bridgeSign.material.needsUpdate = true;
    }
    names.shops.forEach((t, i) => {
      const m = shopSigns[i];
      m.material.map?.dispose();
      const [text, bg, fg] = t;
      m.material.map = signTex(text, bg, fg);
      m.material.needsUpdate = true;
    });
  }

  // traffic and people move on their own; everything is a function of time, so seeking works
  function update(t, opts = {}) {
    const span = 130;
    for (const v of traffic) {
      // a lane can be kept clear so cars don't drive through a close-up
      if (opts.noTraffic || (opts.hideLane === 'far' && v.dir < 0) || (opts.hideLane === 'near' && v.dir > 0)) {
        v.obj.visible = false;
        continue;
      }
      v.obj.visible = true;
      let x = ((v.x0 + v.speed * t) % span + span) % span - span / 2;
      x *= v.dir;
      v.obj.position.x = x;
      v.obj.position.y = Math.abs(Math.sin(t * 9 + v.x0)) * 0.025;
      for (const w of v.obj.userData.wheels ?? []) w.rotation.y = (-v.speed * t) / 0.4;
    }
    for (const p of crowd) {
      const u = p.obj.userData;
      const walking = !p.still;
      let x = p.x0;
      if (walking) x = (((p.x0 + p.dir * p.speed * t) % 100) + 150) % 100 - 50;
      p.obj.position.set(x, 0.12, p.z);
      // nobody walks through the shot: extras keep clear of the camera and the action
      p.obj.visible = !(opts.clear ?? []).some((c) => Math.hypot(x - c.x, p.z - c.z) < c.r);
      if (!p.obj.visible) continue;
      p.obj.rotation.y = walking ? (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (p.s > 0 ? Math.PI : 0) + Math.sin(u.phase) * 0.6;
      const ph = walking ? t * p.speed * 6 + u.phase : 0;
      u.legs[0].rotation.x = Math.sin(ph) * 0.5;
      u.legs[1].rotation.x = -Math.sin(ph) * 0.5;
      if (u.carry) {
        u.arms[0].rotation.z = Math.PI * 0.92;
        u.arms[1].rotation.x = -Math.sin(ph) * 0.4;
      } else {
        u.arms[0].rotation.x = -Math.sin(ph) * 0.45;
        u.arms[1].rotation.x = Math.sin(ph) * 0.45;
      }
      p.obj.position.y = 0.12 + Math.abs(Math.sin(ph)) * 0.03;
    }
    // steam from Bisi's pot
    const st = dress[2].userData.steam;
    if (dress[2].visible) {
      st.puffs.forEach((p, i) => {
        const k = ((t * 0.45 + i / st.puffs.length) % 1);
        p.position.set(st.at.x + Math.sin(i * 2.1 + t) * 0.12 * k, st.at.y + k * 1.4, st.at.z + Math.cos(i * 1.7) * 0.1 * k);
        p.scale.setScalar(0.6 + k * 1.6);
        p.material.opacity = 0.35 * (1 - k);
      });
    }
  }

  function setFocus(v) {
    focus.copy(v);
  }

  return { scene, root, light, setDistrict, update, setFocus, dress, sun };
}
