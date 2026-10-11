// Story mode fights in the same ring as Quick Match, dressed for each district: the sky and light for
// the chapter's time of day, the shop signs, and a few props from its movie. Looks only: the ring,
// ropes, fighters and physics are never touched, and dress(0) puts back exactly what Quick Match shows.
import * as THREE from 'three';
import { signTex, noticeTex, buildDanfo, buildBike, buildCar, buildKeke } from './movie/set.js';

const Y = -0.62; // street level around the ring

const std = (color, rough = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });

function box(w, h, d, mat, x, y, z, parent, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function cyl(rt, rb, h, mat, x, y, z, parent, seg = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

function skyTex([top, mid, bot]) {
  const c = document.createElement('canvas');
  c.width = 2;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, top);
  grad.addColorStop(0.62, mid);
  grad.addColorStop(1, bot);
  g.fillStyle = grad;
  g.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// lit windows on the same grid the arena paints its facades with (3 x 7 per tile)
function windowsTex(seed) {
  let s = seed >>> 0;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, 256, 512);
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 3; x++) {
      if (r() > 0.45) continue;
      g.fillStyle = r() > 0.3 ? '#FFD58A' : '#BFD8FF';
      g.fillRect(30 + x * 76, 34 + y * 68, 42, 32);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// a market table with an umbrella, the kind every Lagos street has
function stall(parent, x, z, umbrella, goods) {
  const g = new THREE.Group();
  g.position.set(x, Y, z);
  parent.add(g);
  const wood = std('#8A5A3C', 0.9);
  box(1.8, 0.07, 0.8, wood, 0, 0.82, 0, g);
  for (const [lx, lz] of [[-0.8, -0.32], [0.8, -0.32], [-0.8, 0.32], [0.8, 0.32]]) box(0.06, 0.82, 0.06, wood, lx, 0.41, lz, g);
  cyl(0.03, 0.03, 2.3, std('#6B6259', 0.7), 0.05, 1.15, 0.1, g, 8);
  const top = new THREE.Mesh(new THREE.ConeGeometry(1.35, 0.5, 8, 1, true), std(umbrella, 0.7, { side: THREE.DoubleSide }));
  top.position.set(0.05, 2.35, 0.1);
  top.castShadow = true;
  g.add(top);
  goods?.(g);
  return g;
}

// ---------- each district's props ----------
const PROPS = {
  // Oshodi: the motor park, more danfos, and the Landlord's notices on the hoarding
  1(p) {
    const d1 = buildDanfo();
    d1.position.set(7.6, Y, -7.2);
    d1.rotation.y = -0.22;
    p.add(d1);
    const d2 = buildDanfo({ color: '#E8B812' });
    d2.position.set(10.8, Y, -5.4);
    d2.rotation.y = Math.PI / 2 + 0.1;
    p.add(d2);
    const board = box(3.6, 1.7, 0.08, std('#6E4B33', 0.9), 4.4, Y + 1.35, -9.0, p);
    board.rotation.y = 0.05;
    const tex = noticeTex();
    tex.colorSpace = THREE.SRGBColorSpace;
    for (let i = 0; i < 3; i++) {
      const n = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.87), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
      n.position.set(3.25 + i * 1.15, Y + 1.38 + (i % 2) * 0.08, -8.94);
      n.rotation.z = (i - 1) * 0.06;
      p.add(n);
    }
  },
  // Ojuelegba: Bisi's buka, pots on the fire and bowls of jollof
  2(p) {
    stall(p, 7.0, -6.6, '#E4572E', (g) => {
      const black = std('#1B1B1E', 0.5);
      cyl(0.32, 0.28, 0.42, black, -0.45, 1.06, 0, g);
      cyl(0.26, 0.22, 0.34, black, 0.35, 1.02, 0.05, g);
      const rice = std('#E86A2C', 0.8);
      cyl(0.3, 0.3, 0.02, rice, -0.45, 1.27, 0, g);
      for (let i = 0; i < 4; i++) cyl(0.11, 0.06, 0.07, std('#F4EEE3', 0.4), -0.7 + i * 0.4, 0.89, 0.3, g, 12);
    });
    box(1.8, 0.06, 0.32, std('#8A5A3C', 0.9), 7.0, Y + 0.45, -5.7, p); // bench
    for (const bx of [6.3, 7.7]) box(0.06, 0.45, 0.28, std('#8A5A3C', 0.9), bx, Y + 0.22, -5.7, p);
    const keke = buildKeke('#2E9E6B');
    keke.position.set(10.6, Y, -6.0);
    keke.rotation.y = -0.6;
    p.add(keke);
  },
  // Ikeja: Computer Village stalls and the dispatch bikes
  3(p) {
    const phones = (g) => {
      const cols = ['#4C8DFF', '#13110F', '#F4EEE3', '#E86A92', '#F5C518'];
      for (let i = 0; i < 7; i++) box(0.12, 0.02, 0.22, std(cols[i % cols.length], 0.3), -0.7 + i * 0.23, 0.87, -0.1 + (i % 2) * 0.22, g, false);
      box(0.5, 0.3, 0.3, std('#C9A97A', 0.9), 0.55, 1.0, 0.15, g);
    };
    stall(p, 6.4, -6.8, '#4C8DFF', phones);
    stall(p, 9.4, -7.3, '#2E9E6B', phones);
    for (const [bx, bz, ry] of [[-5.6, -6.0, 0.4], [-6.9, -6.6, 0.55]]) {
      const b = buildBike();
      b.position.set(bx, Y, bz);
      b.rotation.y = ry;
      p.add(b);
    }
  },
  // Yaba: a suya grill glowing at golden hour and a hub table with a laptop
  4(p) {
    stall(p, 7.2, -6.6, '#F5C518', (g) => {
      box(1.2, 0.18, 0.5, std('#2A2A2E', 0.5), 0, 0.95, 0, g);
      box(1.1, 0.04, 0.42, std('#FF6B2C', 0.6, { emissive: '#FF4A12', emissiveIntensity: 1.6 }), 0, 1.05, 0, g, false);
      for (let i = 0; i < 6; i++) box(0.04, 0.03, 0.46, std('#7A3B1E', 0.7), -0.45 + i * 0.18, 1.09, 0, g, false);
    });
    const t = new THREE.Group();
    t.position.set(-6.2, Y, -6.4);
    t.rotation.y = 0.3;
    p.add(t);
    box(1.4, 0.06, 0.7, std('#D9D2C5', 0.7), 0, 0.76, 0, t);
    for (const [lx, lz] of [[-0.62, -0.28], [0.62, -0.28], [-0.62, 0.28], [0.62, 0.28]]) box(0.05, 0.76, 0.05, std('#3A332B', 0.6), lx, 0.38, lz, t);
    box(0.42, 0.02, 0.3, std('#2B2B33', 0.4), 0, 0.8, 0.05, t);
    const scr = box(0.42, 0.28, 0.02, std('#2B2B33', 0.4, { emissive: '#7FD1FF', emissiveIntensity: 0.9 }), 0, 0.95, -0.1, t);
    scr.rotation.x = -0.25;
    box(0.4, 0.45, 0.4, std('#4C8DFF', 0.7), 0.9, 0.22, 0.3, t); // stool
  },
  // Mushin: Kola's gym spills onto the street, bags on a frame and old tyres
  5(p) {
    const steel = std('#3A332B', 0.5, { metalness: 0.3 });
    for (const fx of [5.2, 9.6]) cyl(0.07, 0.07, 3.0, steel, fx, Y + 1.5, -6.8, p, 10);
    const beam = cyl(0.06, 0.06, 4.4, steel, 7.4, Y + 3.0, -6.8, p, 10);
    beam.rotation.z = Math.PI / 2;
    for (const [bx, col] of [[6.3, '#C8322B'], [8.5, '#1B1B1E']]) {
      cyl(0.01, 0.01, 0.5, steel, bx, Y + 2.72, -6.8, p, 6);
      cyl(0.24, 0.24, 1.15, std(col, 0.7), bx, Y + 1.88, -6.8, p);
    }
    const tyre = std('#1B1B1E', 0.9);
    for (let i = 0; i < 3; i++) {
      const t = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.16, 10, 20), tyre);
      t.rotation.x = Math.PI / 2;
      t.position.set(-5.9, Y + 0.16 + i * 0.3, -6.3);
      t.castShadow = true;
      p.add(t);
    }
    box(1.6, 0.08, 0.36, std('#8A5A3C', 0.9), 4.6, Y + 0.45, -5.6, p);
    for (const bx of [4.0, 5.2]) box(0.06, 0.45, 0.3, std('#8A5A3C', 0.9), bx, Y + 0.22, -5.6, p);
  },
  // Lagos Island at night: towers behind the block, Chief's car, and lights over the ring
  6(p, a) {
    const suv = buildCar('#13110F');
    suv.scale.set(1.15, 1.25, 1.1);
    suv.position.set(7.8, Y, -6.6);
    suv.rotation.y = -0.25;
    p.add(suv);
    const glass = ['#2C3E5C', '#3A4F70', '#24324A', '#40506A'];
    for (let i = 0; i < 6; i++) {
      const w = 6 + (i % 3) * 1.5, h = 24 + ((i * 7) % 11), x = -22 + i * 8.6;
      const lit = windowsTex(90 + i);
      lit.repeat.set(Math.round(w / 2.2), Math.round(h / 4.5));
      const m = new THREE.MeshStandardMaterial({ color: glass[i % glass.length], roughness: 0.35, metalness: 0.3, emissive: '#FFFFFF', emissiveMap: lit, emissiveIntensity: 0.9 });
      box(w, h, 5, m, x, Y + h / 2, -22 - (i % 2) * 3, p, false);
    }
    const spot = new THREE.SpotLight('#FFE2B0', 70, 16, 0.75, 0.55, 1.6);
    spot.position.set(0.4, 6.2, 2.2);
    spot.target.position.set(0, 0, 0);
    p.add(spot, spot.target);
  },
};

// ---------- each district's sky, light and signs ----------
const LOOKS = {
  1: { sky: ['#6FA3E0', '#F8D9AE', '#F2C79B'], fog: '#F0D2B0', sun: ['#FFE7C8', 2.6, [5, 8, 6]], hemi: ['#FFF4E2', '#6E5E50', 1.55], rim: 1.1, bulbs: 0.5, windows: 0,
    signs: [['OSHODI • OBALENDE • CMS', '#13110F', '#F5C518'], ['PURE WATER ₦20', '#4C8DFF', '#F4EEE3'], ['CHARGE YOUR PHONE ₦200', '#2E9E6B', '#F4EEE3'], ['MAMA ALAKARA', '#E4572E', '#F4EEE3']], bus: true },
  2: { sky: ['#4E8FE0', '#CFE3F5', '#E8E0D0'], fog: '#DCE6EE', sun: ['#FFF6E8', 2.9, [-2, 11, 4]], hemi: ['#FFFFFF', '#6E5E50', 1.7], rim: 1.0, bulbs: 0.3, windows: 0,
    signs: [['MAMA PUT BUKA', '#E4572E', '#F4EEE3'], ['JOLLOF • DODO • MOI MOI', '#F5C518', '#13110F'], ['OJUELEGBA', '#13110F', '#F5C518'], ['FRESH ZOBO ₦300', '#9B6BD6', '#F4EEE3']], bus: false },
  3: { sky: ['#5B95DB', '#F2E1C4', '#E8D6B8'], fog: '#E8DCC6', sun: ['#FFE9C4', 2.7, [-6, 9, 6]], hemi: ['#FFF4E2', '#6E5E50', 1.6], rim: 1.1, bulbs: 0.3, windows: 0,
    signs: [['UK USED PHONES', '#E4572E', '#F4EEE3'], ['LAPTOP REPAIRS', '#13110F', '#F4EEE3'], ['SCREEN GUARD ₦500', '#4C8DFF', '#F4EEE3'], ['WE FIX ALL PHONES', '#F5C518', '#13110F']], bus: false },
  4: { sky: ['#5A6FB8', '#FF9F5A', '#F2B482'], fog: '#E8A878', sun: ['#FFB46A', 2.4, [-9, 5, 6]], hemi: ['#FFD7B0', '#5E4A40', 1.35], rim: 1.3, bulbs: 1.4, windows: 0.25,
    signs: [['YABA LABS', '#13110F', '#7FD1FF'], ['BRO SUYA', '#E4572E', '#F4EEE3'], ['YABA MARKET', '#9B6BD6', '#F4EEE3'], ['FAST WIFI • 5G', '#2E9E6B', '#F4EEE3']], bus: false },
  5: { sky: ['#2A2F66', '#E0686A', '#5A3550'], fog: '#5A3A55', sun: ['#FF8A6A', 1.5, [-8, 5, 5]], hemi: ['#B090C8', '#2E2420', 1.15], rim: 1.3, bulbs: 2.6, windows: 0.6,
    signs: [['MUSHIN BOXING CLUB', '#C8322B', '#F4EEE3'], ['EST. 1987', '#13110F', '#F5C518'], ['NO SHAKING', '#F5C518', '#13110F'], ['IRON GYM', '#2A231D', '#F4EEE3']], bus: true },
  6: { sky: ['#0B1230', '#1E2A55', '#141A2E'], fog: '#141A2E', sun: ['#9FB4FF', 1.1, [-4, 10, 6]], hemi: ['#6E80B8', '#1A1714', 0.95], rim: 1.7, bulbs: 3.6, windows: 1.1,
    signs: [['ADEWALE HOLDINGS', '#13110F', '#F5C518'], ['BUREAU DE CHANGE', '#2E9E6B', '#F4EEE3'], ['MARINA', '#4C8DFF', '#F4EEE3'], ['LAGOS ISLAND', '#7D5BD6', '#F4EEE3']], bus: false },
};

export function createVenues(arena) {
  const { scene, sun, hemi, rim, buildings, signs, bus, bulbMat } = arena;
  // what Quick Match looks like, so dress(0) can put it back exactly
  const base = {
    background: scene.background,
    fog: scene.fog.color.clone(),
    sun: [sun.color.clone(), sun.intensity, sun.position.clone()],
    hemi: [hemi.color.clone(), hemi.groundColor.clone(), hemi.intensity],
    rim: rim.intensity,
    bulbs: bulbMat.emissiveIntensity,
    signs: signs.map((s) => s.material.map),
    buildings: buildings.map((b) => [b.material.emissive.clone(), b.material.emissiveMap, b.material.emissiveIntensity]),
  };
  const built = {};
  let current = 0;

  function props(n) {
    if (!built[n]) {
      const g = new THREE.Group();
      PROPS[n](g, arena);
      g.visible = false;
      arena.root.add(g);
      built[n] = { group: g, sky: skyTex(LOOKS[n].sky), signs: LOOKS[n].signs.map(([t, bg, fg]) => signTex(t, bg, fg)), windows: [] };
    }
    return built[n];
  }

  function dress(n) {
    if (!LOOKS[n]) n = 0;
    if (n === current) return;
    if (built[current]) built[current].group.visible = false;
    current = n;
    if (!n) {
      scene.background = base.background;
      scene.fog.color.copy(base.fog);
      sun.color.copy(base.sun[0]);
      sun.intensity = base.sun[1];
      sun.position.copy(base.sun[2]);
      hemi.color.copy(base.hemi[0]);
      hemi.groundColor.copy(base.hemi[1]);
      hemi.intensity = base.hemi[2];
      rim.intensity = base.rim;
      bulbMat.emissiveIntensity = base.bulbs;
      signs.forEach((s, i) => (s.material.map = base.signs[i]));
      buildings.forEach((b, i) => {
        const [e, map, k] = base.buildings[i];
        b.material.emissive.copy(e);
        b.material.emissiveMap = map;
        b.material.emissiveIntensity = k;
        b.material.needsUpdate = true;
      });
      bus.visible = true;
      return;
    }
    const L = LOOKS[n];
    const B = props(n);
    B.group.visible = true;
    scene.background = B.sky;
    scene.fog.color.set(L.fog);
    sun.color.set(L.sun[0]);
    sun.intensity = L.sun[1];
    sun.position.set(...L.sun[2]);
    hemi.color.set(L.hemi[0]);
    hemi.groundColor.set(L.hemi[1]);
    hemi.intensity = L.hemi[2];
    rim.intensity = L.rim;
    bulbMat.emissiveIntensity = L.bulbs;
    signs.forEach((s, i) => (s.material.map = B.signs[i]));
    // evening and night: lights come on in the windows
    buildings.forEach((b, i) => {
      const m = b.material;
      if (L.windows) {
        B.windows[i] ??= (() => {
          const t = windowsTex(17 + i);
          t.repeat.copy(m.map.repeat);
          return t;
        })();
        m.emissive.set('#FFFFFF');
        m.emissiveMap = B.windows[i];
        m.emissiveIntensity = L.windows;
      } else {
        m.emissive.copy(base.buildings[i][0]);
        m.emissiveMap = base.buildings[i][1];
        m.emissiveIntensity = base.buildings[i][2];
      }
      m.needsUpdate = true;
    });
    bus.visible = L.bus;
  }

  return { dress, get current() { return current; } };
}
