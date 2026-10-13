// Fight Night: the game's look. The street at night, a lighting rig over the ring, a Lagos crowd, a branded
// ring, fighters with sweat sheen, glossy gloves and named trunks, and bloom with a film grade. Looks only:
// it never moves the ring, ropes, posts or floor, and never touches fight logic or physics. Open the game
// with ?look=day for the original daylight look.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export const lookWanted = () => new URLSearchParams(location.search).get('look') !== 'day';

const Y = -0.62; // street level
const INK = '#13110F', YELLOW = '#F5C518', RED = '#FF6B35', BLUE = '#4C8DFF', CHALK = '#F4EEE3';
const SHIRTS = ['#E86A92', '#5FB36B', '#F5C518', '#4C8DFF', '#FF8A3D', '#F2E6C9', '#9B6BD6', '#45B8AC', '#E4572E', '#F4EEE3', '#2B2B33', '#C8322B'];
const SKINS = ['#5A3A28', '#6B4430', '#7A4E36', '#4A2F21', '#8A5A3C', '#3E271B'];
const PANTS = ['#2B2B33', '#33415C', '#1E2228', '#4A3F35', '#2E3A2A'];

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  // the display font may still be loading: draw again once it's in
  if (!document.fonts.check('40px Anton')) {
    document.fonts.load('40px Anton').then(() => {
      g.clearRect(0, 0, w, h);
      draw(g, w, h);
      t.needsUpdate = true;
    });
  }
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (opts.repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...opts.repeat);
  }
  return t;
}

// ---------- textures ----------
function skyTex() {
  return canvasTex(4, 512, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#05060D');
    grad.addColorStop(0.55, '#141026');
    grad.addColorStop(0.8, '#33203A');
    grad.addColorStop(1, '#4A2A32'); // the city's orange glow on the haze
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });
}

// lit windows on the arena's facade grid (3 x 7 per tile)
function windowsTex(seed) {
  const r = rng(seed);
  return canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 3; x++) {
        if (r() > 0.36) continue;
        g.fillStyle = r() > 0.25 ? '#FFC870' : r() > 0.5 ? '#9FC4FF' : '#7FE0B0';
        g.fillRect(30 + x * 76, 34 + y * 68, 42, 32);
      }
    }
  }, { repeat: [1, 1] });
}

// the ring canvas at night: deeper blue, the logo, and the event name on two sides
function floorTex() {
  const r = rng(3);
  return canvasTex(2048, 2048, (g, w, h) => {
    g.fillStyle = '#244A7C';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1600; i++) {
      g.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '0,0,0'},${r() * 0.035})`;
      g.fillRect(r() * w, r() * h, 3 + r() * 40, 3 + r() * 40);
    }
    // scuffs where the fighters work: the middle of the ring
    const sc = g.createRadialGradient(w / 2, h / 2, 100, w / 2, h / 2, 900);
    sc.addColorStop(0, 'rgba(255,255,255,.07)');
    sc.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sc;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(244,238,227,.55)';
    g.lineWidth = 18;
    g.strokeRect(70, 70, w - 140, h - 140);
    g.save();
    g.translate(w / 2, h / 2);
    g.fillStyle = INK;
    g.beginPath();
    g.arc(0, 0, 500, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = YELLOW;
    g.beginPath();
    g.arc(0, 0, 470, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = INK;
    g.font = '250px Anton, Impact, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('GBAS', 0, -122);
    g.fillText('GBOS!', 0, 148);
    g.restore();
    g.fillStyle = 'rgba(244,238,227,.85)';
    g.font = '120px Anton, Impact, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const [y, rot] of [[h - 210, 0], [210, 0]]) { // both read from the camera's side
      g.save();
      g.translate(w / 2, y);
      g.rotate(rot);
      g.fillText('LAGOS FIGHT NIGHT', 0, 0);
      g.restore();
    }
  });
}

// rope sleeves: the colour with the name running along it (the cylinder's v runs down the rope)
function ropeTex(bg, fg) {
  // u runs round the rope, so the name sits twice round it (one copy always faces the camera)
  return canvasTex(128, 1024, (g, w, h) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = fg;
    g.font = '40px Anton, Impact, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const x of [w * 0.25, w * 0.75]) {
      for (const y of [h * 0.25, h * 0.75]) {
        g.save();
        g.translate(x, y);
        g.rotate(Math.PI / 2);
        g.fillText('GBAS GBOS', 0, 2);
        g.restore();
      }
    }
  }, { repeat: [1, 5] });
}

// corner pads: the corner's colour, the logo, ink bands top and bottom
function padTex(bg, fg) {
  return canvasTex(256, 1024, (g, w, h) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = INK;
    g.fillRect(0, 0, w, 60);
    g.fillRect(0, h - 60, w, 60);
    g.fillStyle = YELLOW;
    g.fillRect(0, 60, w, 14);
    g.fillRect(0, h - 74, w, 14);
    g.fillStyle = fg;
    g.font = '150px Anton, Impact, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.save();
    g.translate(w / 2, h / 2);
    g.rotate(-Math.PI / 2);
    g.fillText('GBAS GBOS', 0, 4);
    g.restore();
  });
}

// the apron: danfo stripes top and bottom, and the night's boards between them
function apronTex() {
  const boards = [
    ['GBAS GBOS!', YELLOW, INK], ['PURE WATER', BLUE, CHALK], ['LAGOS FIGHT NIGHT', INK, YELLOW],
    ['MAMA PUT BUKA', '#E4572E', CHALK], ['DANFO EXPRESS', YELLOW, INK], ['OKADA RIDERS UNION', '#2E9E6B', CHALK],
  ];
  return canvasTex(4096, 340, (g, w, h) => {
    g.fillStyle = INK;
    g.fillRect(0, 0, w, h);
    const bw = w / boards.length;
    boards.forEach(([t, bg, fg], i) => {
      g.fillStyle = bg;
      g.fillRect(i * bw + 10, 52, bw - 20, h - 104);
      g.fillStyle = fg;
      g.font = `${t.length > 14 ? 92 : 120}px Anton, Impact, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(t, i * bw + bw / 2, h / 2 + 4);
    });
    g.fillStyle = YELLOW;
    g.fillRect(0, 0, w, 30);
    g.fillRect(0, h - 30, w, 30);
    g.fillStyle = INK;
    g.fillRect(0, 10, w, 8);
    g.fillRect(0, h - 18, w, 8);
  });
}

// trunks, wrapped round the waist (u) from the bottom of the legs to the waistband (v): the fighter's
// colour, an ink waistband with the nickname across the front, a side stripe and a trim at the hem
function trunksTex(base, nickname) {
  const c = new THREE.Color(base);
  const hsl = {};
  c.getHSL(hsl);
  const accent = Math.abs(hsl.h - 0.13) < 0.06 && hsl.s > 0.5 ? RED : YELLOW; // no yellow on yellow
  return canvasTex(1024, 256, (g, w, h) => {
    g.fillStyle = `#${c.getHexString()}`;
    g.fillRect(0, 0, w, h);
    // satin: soft vertical folds
    for (let x = 0; x < w; x += 16) {
      g.fillStyle = `rgba(255,255,255,${0.04 + 0.04 * Math.sin(x * 0.05)})`;
      g.fillRect(x, 56, 8, h);
    }
    const band = 58;
    g.fillStyle = INK;
    g.fillRect(0, 0, w, band);
    g.fillStyle = accent;
    g.fillRect(0, band - 6, w, 6);
    g.fillRect(0, h - 12, w, 12);
    for (const sx of [w * 0.25, w * 0.75]) g.fillRect(sx - 14, band, 28, h - band);
    g.fillStyle = accent;
    g.font = '46px Anton, Impact, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(nickname.toUpperCase(), w / 2, band / 2);
    g.font = '28px Anton, Impact, sans-serif';
    g.fillStyle = CHALK;
    g.fillText('GBAS GBOS', 0.02 * w, band / 2); // wraps across the back seam
    g.fillText('GBAS GBOS', 0.98 * w, band / 2);
  });
}

// soft disc for phone flashes
function dotTex() {
  return canvasTex(64, 64, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.3, 'rgba(255,255,255,.6)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, w, h);
  });
}

// ---------- the light beams you see in the haze ----------
function beamMaterial(color, opacity) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity } },
    vertexShader: `
      varying vec3 vN; varying vec3 vV; varying float vY;
      void main() {
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = normalize(-mv.xyz);
        vY = uv.y;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uOpacity;
      varying vec3 vN; varying vec3 vV; varying float vY;
      void main() {
        float edge = pow(abs(dot(normalize(vN), normalize(vV))), 2.0);
        float along = smoothstep(0.0, 0.9, vY);
        gl_FragColor = vec4(uColor, edge * along * uOpacity);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

function beam(from, to, angle, color, opacity, parent) {
  const len = from.distanceTo(to);
  const geo = new THREE.ConeGeometry(Math.tan(angle) * len, len, 40, 1, true);
  geo.translate(0, -len / 2, 0); // apex at the lamp
  const m = new THREE.Mesh(geo, beamMaterial(color, opacity));
  m.position.copy(from);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), to.clone().sub(from).normalize());
  m.renderOrder = 5;
  parent.add(m);
  return m;
}

// ---------- the crowd ----------
// Instanced street fans in rows behind and beside the ring, a few on the danfo's roof, all facing the
// ring. They bob, and the closer rows throw their arms up when a big shot lands.
function buildCrowd(parent) {
  const r = rng(21);
  const people = [];
  const add = (x, z, y = Y, lift = 0) => {
    const h = 0.9 + r() * 0.2; // height scale
    people.push({ x, z, y: y + lift, h, face: Math.atan2(-x, -z) + (r() - 0.5) * 0.5, phase: r() * Math.PI * 2, speed: 1.5 + r() * 2.5,
      shirt: SHIRTS[Math.floor(r() * SHIRTS.length)], skin: SKINS[Math.floor(r() * SKINS.length)], pants: PANTS[Math.floor(r() * PANTS.length)],
      fan: r(), arms: 0 });
  };
  // behind the ring: standing rows, the back ones on crates and benches
  for (let row = 0; row < 6; row++) {
    const z = -4.9 - row * 0.72;
    for (let x = -6.2; x <= 6.2; x += 0.58) {
      if (r() < 0.12) continue;
      add(x + (r() - 0.5) * 0.3, z + (r() - 0.5) * 0.25, Y, row * 0.16);
    }
  }
  // both sides, up to the camera's flank
  for (const sx of [-1, 1]) {
    for (let col = 0; col < 4; col++) {
      const x = sx * (4.7 + col * 0.72);
      for (let z = -4.3; z <= 2.6; z += 0.6) {
        if (r() < 0.15) continue;
        if (sx < 0 && x < -6.2 && z < -4.5) continue; // the danfo is parked there
        add(x + (r() - 0.5) * 0.25, z + (r() - 0.5) * 0.3, Y, col * 0.14);
      }
    }
  }
  // the best seats in Lagos: on top of the danfo
  for (let i = 0; i < 6; i++) add(-10.6 + i * 0.75 + (r() - 0.5) * 0.2, -6.25 + (i % 2) * 0.5, Y + 2.2);

  const n = people.length;
  const parts = {
    legs: new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.8, 0.2).translate(0, 0.4, 0), new THREE.MeshStandardMaterial({ roughness: 0.9 }), n),
    body: new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.17, 0.4, 4, 10).scale(1.15, 1, 0.75).translate(0, 1.13, 0), new THREE.MeshStandardMaterial({ roughness: 0.85 }), n),
    head: new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 12, 10).translate(0, 1.6, 0), new THREE.MeshStandardMaterial({ roughness: 0.7 }), n),
    armL: new THREE.InstancedMesh(new THREE.BoxGeometry(0.09, 0.56, 0.09).translate(0, -0.26, 0), new THREE.MeshStandardMaterial({ roughness: 0.85 }), n),
    armR: new THREE.InstancedMesh(new THREE.BoxGeometry(0.09, 0.56, 0.09).translate(0, -0.26, 0), new THREE.MeshStandardMaterial({ roughness: 0.85 }), n),
  };
  const col = new THREE.Color();
  people.forEach((p, i) => {
    const dim = 0.45; // they stand in the dark beyond the ring lights
    parts.legs.setColorAt(i, col.set(p.pants).multiplyScalar(dim));
    parts.body.setColorAt(i, col.set(p.shirt).multiplyScalar(dim));
    parts.head.setColorAt(i, col.set(p.skin).multiplyScalar(dim));
    parts.armL.setColorAt(i, col.set(p.skin).multiplyScalar(dim));
    parts.armR.setColorAt(i, col.set(p.skin).multiplyScalar(dim));
  });
  for (const m of Object.values(parts)) {
    m.instanceColor.needsUpdate = true;
    m.castShadow = false;
    m.receiveShadow = true;
    m.frustumCulled = false;
    parent.add(m);
  }

  // phones held up: a flash now and then
  const flashGeo = new THREE.BufferGeometry();
  const fpos = new Float32Array(n * 3), fcol = new Float32Array(n * 3);
  flashGeo.setAttribute('position', new THREE.BufferAttribute(fpos, 3));
  flashGeo.setAttribute('color', new THREE.BufferAttribute(fcol, 3));
  const flashes = new THREE.Points(flashGeo, new THREE.PointsMaterial({ size: 0.35, map: dotTex(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  flashes.frustumCulled = false;
  parent.add(flashes);
  const flashT = new Float32Array(n);

  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3(), O = new THREE.Vector3();
  const shoulder = new THREE.Vector3();
  let time = 0;
  function update(dt, excite) {
    time += dt;
    people.forEach((p, i) => {
      const hype = Math.min(1, excite * (0.6 + p.fan));
      const bob = Math.max(0, Math.sin(time * p.speed * (1 + hype) + p.phase)) * (0.02 + hype * 0.09);
      P.set(p.x, p.y + bob, p.z);
      Q.setFromEuler(E.set(0, p.face, 0));
      S.set(p.h, p.h, p.h);
      M.compose(P, Q, S);
      parts.legs.setMatrixAt(i, M);
      parts.body.setMatrixAt(i, M);
      parts.head.setMatrixAt(i, M);
      // arms: hang, or go up when the fan's hype passes their threshold
      const want = hype > 0.35 + p.fan * 0.4 ? 1 : 0;
      p.arms += (want - p.arms) * Math.min(1, dt * 6);
      for (const [mesh, side] of [[parts.armL, -1], [parts.armR, 1]]) {
        const wave = Math.sin(time * 6 + p.phase + side) * 0.25 * p.arms;
        const up = p.arms * (2.7 + wave) + 0.12;
        shoulder.set(side * 0.24, 1.42, 0).multiplyScalar(p.h).applyQuaternion(Q).add(P);
        const q = new THREE.Quaternion().setFromEuler(E.set(0, p.face, side * up, 'YXZ'));
        M.compose(shoulder, q, S);
        mesh.setMatrixAt(i, M);
      }
      // a phone flash: rare, brighter when the crowd's up
      if (flashT[i] > 0) flashT[i] -= dt;
      else if (Math.random() < dt * (0.01 + hype * 0.08)) flashT[i] = 0.08 + Math.random() * 0.1;
      const on = flashT[i] > 0 ? 1 : 0;
      O.set(0, 1.85 * p.h, 0.12).applyQuaternion(Q).add(P);
      fpos[i * 3] = O.x;
      fpos[i * 3 + 1] = O.y;
      fpos[i * 3 + 2] = O.z;
      fcol[i * 3] = fcol[i * 3 + 1] = fcol[i * 3 + 2] = on * 1.6;
    });
    for (const m of Object.values(parts)) m.instanceMatrix.needsUpdate = true;
    flashGeo.attributes.position.needsUpdate = true;
    flashGeo.attributes.color.needsUpdate = true;
  }
  update(0, 0);
  return { update, count: n };
}

// ---------- the grade: a touch of contrast, a vignette and film grain ----------
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVignette: { value: 0.42 }, uGrain: { value: 0.035 } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime; uniform float uVignette; uniform float uGrain;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      c.rgb = mix(c.rgb, smoothstep(0.0, 1.0, c.rgb), 0.35); // contrast
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = mix(vec3(l), c.rgb, 1.08); // a little more colour
      vec2 d = vUv - 0.5;
      c.rgb *= 1.0 - uVignette * smoothstep(0.25, 0.85, dot(d, d) * 2.2);
      c.rgb += (hash(vUv * 1000.0 + uTime) - 0.5) * uGrain;
      gl_FragColor = c;
    }`,
};

export function createFightNight({ arena, renderer, scene, camera }) {
  const { root, sun, hemi, rim, buildings, signs, bulbMat, ring, bus } = arena;
  const group = new THREE.Group();
  root.add(group);

  // ---- night ----
  scene.background = skyTex();
  scene.fog = new THREE.Fog('#160F1C', 16, 46);
  hemi.color.set('#5C6BA8');
  hemi.groundColor.set('#1C140E');
  hemi.intensity = 0.42;
  sun.color.set('#8EA4FF'); // moonlight
  sun.intensity = 0.32;
  sun.castShadow = false;
  rim.color.set('#7C9CFF');
  rim.intensity = 1.5;
  rim.position.set(4, 5, -7);
  bulbMat.emissiveIntensity = 4.5;
  renderer.toneMappingExposure = 1.0;

  buildings.forEach((b, i) => {
    const m = b.material;
    m.color.set('#5E5866');
    const t = windowsTex(40 + i);
    t.repeat.copy(m.map.repeat);
    m.emissive.set('#FFFFFF');
    m.emissiveMap = t;
    m.emissiveIntensity = 0.85;
    m.needsUpdate = true;
  });
  // shop signs: lit from a strip light above each
  const signGlow = new THREE.MeshStandardMaterial({ color: '#FFF3D6', emissive: '#FFE2A8', emissiveIntensity: 3.2 });
  signs.forEach((s) => {
    const m = s.material;
    m.emissive.set('#FFFFFF');
    m.emissiveMap = m.map;
    m.emissiveIntensity = 0.55;
    m.needsUpdate = true;
    const strip = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.06, 0.08), signGlow);
    strip.position.copy(s.position).add(new THREE.Vector3(0, 0.62, 0.12));
    group.add(strip);
  });
  // the danfo's headlights and a warm light by each pole
  for (const [x, z] of [[-6, -4.2], [6, -4.2]]) {
    const l = new THREE.PointLight('#FFB866', 9, 9, 2);
    l.position.set(x, 3.9, z + 0.3);
    group.add(l);
  }

  // ---- the lighting rig over the ring ----
  const steel = new THREE.MeshStandardMaterial({ color: '#1B1B1E', roughness: 0.5, metalness: 0.6 });
  const T = 5.4, TY = 5.2;
  for (const [w, d, x, z] of [[2 * T, 0.16, 0, -T], [2 * T, 0.16, 0, T], [0.16, 2 * T, -T, 0], [0.16, 2 * T, T, 0]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, d), steel);
    b.position.set(x, TY, z);
    group.add(b);
    const b2 = b.clone();
    b2.position.y = TY + 0.32;
    group.add(b2);
  }
  const lampMat = new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.4, metalness: 0.5 });
  const lensMat = new THREE.MeshStandardMaterial({ color: '#FFF6E0', emissive: '#FFF1D2', emissiveIntensity: 6 });
  const target = new THREE.Vector3(0, 0.6, 0);
  const lamps = [];
  for (const [x, z] of [[-T, -T], [T, -T], [-T, T], [T, T], [-T * 0.45, -T], [T * 0.45, -T]]) {
    const from = new THREE.Vector3(x, TY - 0.15, z);
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.42, 16), lampMat);
    can.position.copy(from);
    can.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), target.clone().sub(from).normalize());
    group.add(can);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.2, 20), lensMat);
    lens.position.set(0, -0.215, 0);
    lens.rotation.x = Math.PI / 2;
    can.add(lens);
    lamps.push(from);
  }
  // key: straight over the ring, the only light with shadows
  const key = new THREE.SpotLight('#FFF2DE', 120, 16, 0.6, 0.6, 2);
  key.position.set(0.4, 7.2, 1.6);
  key.target.position.set(0, 0.6, 0);
  key.castShadow = true;
  const touch = matchMedia('(pointer: coarse)').matches;
  key.shadow.mapSize.set(touch ? 1024 : 2048, touch ? 1024 : 2048); // lighter on phones
  key.shadow.camera.near = 2;
  key.shadow.camera.far = 14;
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.02;
  group.add(key, key.target);
  // backlights from the far corners: the rim that makes the fighters pop off the crowd
  for (const [from, color] of [[lamps[0], '#FFD7A8'], [lamps[1], '#BFD4FF']]) {
    const s = new THREE.SpotLight(color, 80, 18, 0.45, 0.7, 2);
    s.position.copy(from);
    s.target.position.copy(target);
    group.add(s, s.target);
  }
  // a soft front fill so faces still read
  const fill = new THREE.SpotLight('#FFD9B4', 28, 16, 0.5, 0.9, 2);
  fill.position.set(0, 3.4, 7.5);
  fill.target.position.set(0, 1.1, 0);
  group.add(fill, fill.target);
  // the beams in the haze
  for (const from of lamps) beam(from, target.clone().add(new THREE.Vector3((from.x > 0 ? -1 : 1) * 0.6, 0, 0)), 0.16, '#FFE9C8', 0.07, group);
  beam(key.position, new THREE.Vector3(0, 0, 0), 0.32, '#FFF4E2', 0.05, group);

  // ---- the ring, branded ----
  ring.floor.material[2].map = floorTex();
  ring.floor.material[2].roughness = 0.75;
  ring.floor.material[2].needsUpdate = true;
  ring.skirt.material.map = apronTex();
  ring.skirt.material.emissive = new THREE.Color('#FFFFFF');
  ring.skirt.material.emissiveMap = ring.skirt.material.map; // the boards are backlit
  ring.skirt.material.emissiveIntensity = 0.35;
  ring.skirt.material.needsUpdate = true;
  const PADS = { red: ['#C8322B', CHALK], blue: ['#2F6BD8', CHALK], white: [CHALK, INK] };
  const padMats = {};
  for (const p of ring.pads) {
    padMats[p.corner] ??= new THREE.MeshStandardMaterial({ map: padTex(...PADS[p.corner]), roughness: 0.35 });
    p.mesh.material = padMats[p.corner];
  }
  const ROPES = [['#C8322B', CHALK], [CHALK, INK], ['#2F6BD8', CHALK]];
  ring.ropeMats.forEach((m, i) => {
    m.color.set('#FFFFFF');
    m.map = ropeTex(...ROPES[i]);
    m.roughness = 0.35;
    m.needsUpdate = true;
  });
  // crowd barriers round the ring
  const rail = new THREE.MeshStandardMaterial({ color: '#8A8F98', roughness: 0.35, metalness: 0.7 });
  const B = 4.35;
  for (const [x0, z0, x1, z1] of [[-B, -B, B, -B], [-B, -B, -B, 3.2], [B, -B, B, 3.2]]) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    for (const y of [0.42, 0.95]) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, len, 8), rail);
      m.position.set((x0 + x1) / 2, Y + y, (z0 + z1) / 2);
      m.rotation.set(x0 === x1 ? Math.PI / 2 : 0, 0, x0 === x1 ? 0 : Math.PI / 2);
      group.add(m);
    }
    for (let k = 0; k <= Math.round(len / 1.2); k++) {
      const t = k / Math.round(len / 1.2);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.0, 8), rail);
      m.position.set(x0 + (x1 - x0) * t, Y + 0.5, z0 + (z1 - z0) * t);
      group.add(m);
    }
  }

  // ---- the crowd ----
  const crowd = buildCrowd(group);
  bus.visible = true;

  // ---- bloom and grade ----
  const size = renderer.getSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.4, 0.6, 0.9);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);

  // ---- per fighter: sweat, glossy gloves, named trunks ----
  const skins = [];
  const uvCache = new Map();
  function trunksGeometry(key, geo) {
    if (uvCache.has(key)) return uvCache.get(key);
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.computeBoundingBox();
    const { min, max } = g.boundingBox;
    const pos = g.attributes.position;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = Math.atan2(pos.getX(i), pos.getZ(i)) / (Math.PI * 2) + 0.5;
      uv[i * 2 + 1] = (pos.getY(i) - min.y) / (max.y - min.y);
    }
    // triangles across the back seam: unwrap them so they don't smear the whole texture
    for (let i = 0; i < pos.count; i += 3) {
      const us = [uv[i * 2], uv[i * 2 + 2], uv[i * 2 + 4]];
      if (Math.max(...us) - Math.min(...us) > 0.5) for (let k = 0; k < 3; k++) if (us[k] < 0.5) uv[(i + k) * 2] += 1;
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    uvCache.set(key, g);
    return g;
  }
  function dressFighter(model, data, isRef = false) {
    model.traverse((o) => {
      if (!o.isMesh) return;
      const name = o.material.name.replace(/^[a-z]+_/, '').replace(/\.\d+$/, '');
      const old = o.material;
      if (name === 'skin') {
        const m = new THREE.MeshPhysicalMaterial({ color: old.color, roughness: 0.46, clearcoat: isRef ? 0 : 0.2, clearcoatRoughness: 0.32, sheen: 0.12, sheenRoughness: 0.6, sheenColor: new THREE.Color('#C9876A') });
        m.name = old.name;
        o.material = m;
        if (!isRef) skins.push(m);
      } else if (name === 'glove' && !isRef) {
        const m = new THREE.MeshPhysicalMaterial({ color: old.color, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 });
        m.name = old.name;
        o.material = m;
      } else if (name === 'gcuff' && !isRef) {
        const m = old.clone();
        m.roughness = 0.75;
        o.material = m;
      } else if (name === 'trunks' && !isRef) {
        o.geometry = trunksGeometry(`${data.id}:${old.name}`, o.geometry);
        const m = new THREE.MeshPhysicalMaterial({ map: trunksTex(old.color, data.nickname), roughness: 0.5, sheen: 0.45, sheenRoughness: 0.4, sheenColor: new THREE.Color(old.color).lerp(new THREE.Color('#FFFFFF'), 0.5) });
        m.name = old.name;
        o.material = m;
      } else if (name === 'hair') {
        // short hair takes the top light as a soft sheen, not a grey cap
        const m = new THREE.MeshPhysicalMaterial({ color: old.color, roughness: 0.9, specularIntensity: 0.15, sheen: 0.3, sheenRoughness: 0.8, sheenColor: new THREE.Color('#3A2A22') });
        m.name = old.name;
        o.material = m;
      } else if (name === 'boot') {
        const m = old.clone();
        m.roughness = 0.28;
        o.material = m;
      }
      o.castShadow = true;
    });
  }

  // ---- each frame ----
  let excite = 0.15, lastHp = null, sweat = 0, t = 0;
  function update(dt, fighters, mode) {
    t += dt;
    // the crowd answers the fight: big shots and knockdowns lift it, then it settles
    if (fighters && mode === 'fight') {
      const hp = fighters.map((f) => f.hp);
      if (lastHp) hp.forEach((h, i) => { if (lastHp[i] - h > 0.5) excite += (lastHp[i] - h) * 0.06; });
      lastHp = hp;
      sweat = Math.min(1, sweat + dt / 120);
      if (fighters.some((f) => f.down)) excite = Math.max(excite, 1);
    } else {
      lastHp = null;
      if (mode !== 'results') sweat = Math.max(0, sweat - dt / 10);
    }
    excite = Math.min(1.2, Math.max(mode === 'results' ? 0.9 : 0.12, excite * Math.exp(-dt * 0.7)));
    crowd.update(dt, excite);
    for (const m of skins) {
      m.clearcoat = 0.2 + sweat * 0.5;
      m.clearcoatRoughness = 0.32 - sweat * 0.18;
    }
    // story swaps the sign faces per district; keep their glow matching
    signs.forEach((s) => {
      if (s.material.emissiveMap !== s.material.map) {
        s.material.emissiveMap = s.material.map;
        s.material.needsUpdate = true;
      }
    });
    grade.uniforms.uTime.value = t % 100;
  }

  function setSize(w, h) {
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
    bloom.resolution.set(w / 2, h / 2);
  }
  setSize(window.innerWidth, window.innerHeight);

  return { dressFighter, update, render: () => composer.render(), setSize, crowd };
}
