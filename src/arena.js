// The ring and the Lagos street around it. No crowd in this demo.
import * as THREE from 'three';
import { COLORS } from './data.js';

const PALETTE = ['#E86A92', '#5FB36B', '#F5C518', '#4C8DFF', '#FF8A3D', '#F2E6C9', '#9B6BD6', '#45B8AC', '#E4572E'];

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

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
  parent.add(m);
  return m;
}

function buildingTex(base, r) {
  return canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    // painted wall wear
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.05})`;
      g.fillRect(r() * w, r() * h, 10 + r() * 60, 6 + r() * 30);
    }
    const cols = 3, rows = 7;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const wx = 26 + x * 76, wy = 30 + y * 68;
        g.fillStyle = '#2B2B33';
        g.fillRect(wx, wy, 50, 40);
        g.fillStyle = r() > 0.6 ? '#3D5A73' : '#1E2228';
        g.fillRect(wx + 4, wy + 4, 42, 32);
        // burglary-proof bars
        g.fillStyle = 'rgba(244,238,227,.55)';
        for (let b = 1; b < 4; b++) g.fillRect(wx + b * 12, wy + 4, 2, 32);
        if (r() > 0.75) { // hanging clothes
          g.fillStyle = PALETTE[Math.floor(r() * PALETTE.length)];
          g.fillRect(wx + 6, wy + 40, 14, 12);
        }
      }
    }
  });
}

function signTex(text, bg, fg) {
  return canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = fg;
    g.font = '86px Anton, Impact, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 4);
  });
}

function danfoStripeTex() {
  return canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = '#F5C518';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#13110F';
    g.fillRect(0, 6, w, 8);
    g.fillRect(0, h - 14, w, 8);
  });
}

function canvasFloorTex() {
  return canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#3A6EA5';
    g.fillRect(0, 0, w, h);
    // worn canvas
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`;
      g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 24, 2 + Math.random() * 24);
    }
    g.strokeStyle = 'rgba(244,238,227,.5)';
    g.lineWidth = 10;
    g.strokeRect(40, 40, w - 80, h - 80);
    g.save();
    g.translate(w / 2, h / 2);
    g.fillStyle = '#F5C518';
    g.beginPath();
    g.arc(0, 0, 230, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#13110F';
    g.font = '120px Anton, Impact, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('GBAS', 0, -58);
    g.fillText('GBOS!', 0, 70);
    g.restore();
  });
}

export function buildArena(scene) {
  const root = new THREE.Group();
  scene.add(root);
  const r = rng(7);

  scene.background = new THREE.Color('#F2C79B');
  scene.fog = new THREE.Fog('#F2C79B', 22, 46);

  // ---- street ----
  const street = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), std('#5A524B', 0.95));
  street.rotation.x = -Math.PI / 2;
  street.position.y = -0.62;
  street.receiveShadow = true;
  root.add(street);
  // kerb and gutter lines
  box(40, 0.12, 0.5, std('#BDB3A4', 0.9), 0, -0.56, -7.2, root).receiveShadow = true;
  for (let i = -6; i <= 6; i++) box(1.4, 0.01, 0.16, std('#F4EEE3', 0.8), i * 3, -0.615, 7.5, root);

  // ---- ring ----
  const S = 6.4;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(S, 0.1, S), [
    std('#2A231D'), std('#2A231D'), std('#FFFFFF', 0.9, { map: canvasFloorTex() }), std('#2A231D'), std('#2A231D'), std('#2A231D'),
  ]);
  floor.position.y = -0.05;
  floor.receiveShadow = true;
  root.add(floor);
  const skirtMat = std('#FFFFFF', 0.7, { map: danfoStripeTex() });
  skirtMat.map.wrapS = THREE.RepeatWrapping;
  skirtMat.map.repeat.set(6, 1);
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(S + 0.1, 0.52, S + 0.1), skirtMat);
  skirt.position.y = -0.36;
  skirt.castShadow = skirt.receiveShadow = true;
  root.add(skirt);

  const postMat = { red: std(COLORS.red, 0.45), blue: std(COLORS.blue, 0.45), white: std(COLORS.chalk, 0.5) };
  const P = 3.1;
  const posts = [[-P, -P, 'red'], [P, P, 'blue'], [-P, P, 'white'], [P, -P, 'white']];
  for (const [x, z, c] of posts) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 1.45, 16), postMat[c]);
    p.position.set(x, 0.72, z);
    p.castShadow = true;
    root.add(p);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.05, 0.22), postMat[c]);
    pad.position.set(x - Math.sign(x) * 0.08, 0.72, z - Math.sign(z) * 0.08);
    pad.castShadow = true;
    root.add(pad);
  }
  const ropeMats = [std(COLORS.red, 0.4), std(COLORS.chalk, 0.5), std(COLORS.blue, 0.4)];
  [0.48, 0.86, 1.24].forEach((y, i) => {
    const pts = [[-P, -P], [P, -P], [P, P], [-P, P], [-P, -P]];
    for (let k = 0; k < 4; k++) {
      const a = new THREE.Vector3(pts[k][0], y, pts[k][1]);
      const b = new THREE.Vector3(pts[k + 1][0], y, pts[k + 1][1]);
      // leave the near rope out of the camera's way
      if (a.z > 0 && b.z > 0) continue;
      const len = a.distanceTo(b);
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, len, 10), ropeMats[i]);
      rope.position.copy(a).add(b).multiplyScalar(0.5);
      rope.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      rope.castShadow = true;
      root.add(rope);
    }
  });
  // near side: short rope stubs only at the posts so the frame still reads as a ring
  for (const x of [-P, P]) {
    [0.48, 0.86, 1.24].forEach((y, i) => {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 8), ropeMats[i]);
      s.rotation.z = Math.PI / 2;
      s.position.set(x - Math.sign(x) * 0.25, y, P);
      root.add(s);
    });
  }
  // corner stools and buckets
  for (const [x, z, c] of [[-P - 0.5, -P + 0.6, 'red'], [P + 0.5, P - 0.6, 'blue']]) {
    box(0.4, 0.04, 0.4, postMat[c], x, -0.2, z, root).castShadow = true;
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.32, 14), std('#E4E0D8', 0.6));
    b.position.set(x, -0.46, z + 0.5);
    root.add(b);
  }

  // ---- Lagos block behind the ring ----
  let x = -24;
  while (x < 24) {
    const w = 3 + r() * 3.5, h = 6 + r() * 10, d = 4 + r() * 3;
    const color = PALETTE[Math.floor(r() * PALETTE.length)];
    const tex = buildingTex(color, r);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(Math.max(1, Math.round(w / 3.2)), Math.max(1, Math.round(h / 6.5)));
    const mat = std('#FFFFFF', 0.92, { map: tex });
    const z = -10.5 - r() * 2 - d / 2;
    const b = box(w, h, d, mat, x + w / 2, h / 2 - 0.62, z, root);
    b.receiveShadow = true;
    // roof parapet and black water tank, a Lagos rooftop staple
    box(w + 0.2, 0.3, d + 0.2, std('#D9D2C5', 0.9), x + w / 2, h - 0.47, z, root);
    if (r() > 0.4) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.1, 18), std('#1B1B1E', 0.6));
      tank.position.set(x + w * (0.25 + r() * 0.5), h + 0.4, z);
      root.add(tank);
    }
    x += w + 0.1 + r() * 0.5;
  }
  // side blocks so a panning camera never runs out of street
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const w = 5, h = 5 + r() * 7, d = 4;
      const tex = buildingTex(PALETTE[Math.floor(r() * PALETTE.length)], r);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(1, Math.max(1, Math.round(h / 6.5)));
      const b = box(d, h, w, std('#FFFFFF', 0.92, { map: tex }), side * (13 + r() * 2), h / 2 - 0.62, -7 + i * 5.2, root);
      b.receiveShadow = true;
    }
  }

  // shop signs on the ground floors
  const signs = [['MAMA PUT BUKA', '#E4572E', '#F4EEE3'], ['OSHODI • OJUELEGBA', '#13110F', '#F5C518'], ['PURE WATER', '#4C8DFF', '#F4EEE3'], ['GBAS GBOS!', '#F5C518', '#13110F']];
  signs.forEach(([t, bg, fg], i) => {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.05), new THREE.MeshStandardMaterial({ map: signTex(t, bg, fg), roughness: 0.6 }));
    s.position.set(-10.5 + i * 7, 2.6, -9.6 - (i % 2) * 0.4);
    root.add(s);
  });

  // a parked danfo bus
  const bus = new THREE.Group();
  const yellow = std(COLORS.yellow, 0.45);
  box(5.2, 1.9, 2.1, yellow, 0, 1.25, 0, bus).castShadow = true;
  box(5.22, 0.12, 2.12, std(COLORS.ground, 0.5), 0, 0.9, 0, bus);
  box(5.22, 0.12, 2.12, std(COLORS.ground, 0.5), 0, 1.45, 0, bus);
  const glass = std('#22303A', 0.2, { metalness: 0.2 });
  for (let i = 0; i < 4; i++) box(0.95, 0.55, 2.14, glass, -1.8 + i * 1.15, 1.8, 0, bus);
  box(0.05, 0.75, 1.8, glass, 2.62, 1.75, 0, bus);
  for (const [wx, wz] of [[-1.7, 1.05], [1.7, 1.05], [-1.7, -1.05], [1.7, -1.05]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 18), std('#1B1B1E', 0.8));
    w.rotation.x = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    bus.add(w);
  }
  bus.position.set(-8.6, -0.62, -6.6);
  bus.rotation.y = 0.18;
  root.add(bus);

  // string bulbs over the ring
  const bulbMat = new THREE.MeshStandardMaterial({ color: '#FFE7A8', emissive: '#FFD27A', emissiveIntensity: 2.2 });
  const wire = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    wire.push(new THREE.Vector3(-6 + 12 * t, 4.6 - Math.sin(t * Math.PI) * 0.9, -4.2));
  }
  root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(wire), new THREE.LineBasicMaterial({ color: '#13110F' })));
  for (let i = 1; i < 24; i += 2) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), bulbMat);
    b.position.copy(wire[i]).add(new THREE.Vector3(0, -0.12, 0));
    root.add(b);
  }
  // poles
  for (const px of [-6, 6]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 5.4, 10), std('#6B6259', 0.8));
    p.position.set(px, 2.08, -4.2);
    p.castShadow = true;
    root.add(p);
  }

  // ---- light ----
  const hemi = new THREE.HemisphereLight('#FFF4E2', '#6E5E50', 1.7);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#FFE3C2', 2.6);
  sun.position.set(-5, 9, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -6;
  sun.shadow.camera.right = 6;
  sun.shadow.camera.top = 6;
  sun.shadow.camera.bottom = -6;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 30;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  const rim = new THREE.DirectionalLight('#B8D4FF', 1.2);
  rim.position.set(6, 4, -6);
  scene.add(rim);

  return { root, sun };
}
