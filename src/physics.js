// Boxing physics: hit volumes on the skeleton, glove sweeps, spring-driven hit reactions,
// and impact particles. Not a full ragdoll: animation drives the body, physics layers on top.
import * as THREE from 'three';

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();

export const GLOVE_R = 0.11;
// the camera looks along z, so depth mismatches between the two fighters count for less
const DEPTH_WEIGHT = 0.45;

function dist2D(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y, dz = (a.z - b.z) * DEPTH_WEIGHT;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// closest distance between segment p0-p1 (the glove's path this frame) and point c
function segPoint(p0, p1, c, out) {
  _v.subVectors(p1, p0);
  const len2 = _v.lengthSq();
  let t = len2 > 1e-8 ? _w.subVectors(c, p0).dot(_v) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  out.copy(p0).addScaledVector(_v, t);
  return dist2D(out, c);
}

// closest distance between segment a0-a1 (torso) and point p
function pointSeg(p, a0, a1, out) {
  return segPoint(a0, a1, p, out) /* symmetric */;
}

/** A damped angular spring applied on top of the animated pose of a chain of bones. */
class Spring {
  constructor(bones, weights, k, zeta, cap) {
    this.bones = bones;
    this.weights = weights;
    this.k = k;
    this.c = 2 * zeta * Math.sqrt(k);
    this.cap = cap;
    this.a = new THREE.Vector3(); // angle (axis * radians) in model space
    this.v = new THREE.Vector3();
  }

  kick(w) {
    this.v.add(w);
  }

  step(dt) {
    // semi-implicit Euler in small steps keeps the stiff spring stable
    const n = Math.ceil(dt / (1 / 120));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      _v.copy(this.a).multiplyScalar(-this.k).addScaledVector(this.v, -this.c);
      this.v.addScaledVector(_v, h);
      this.a.addScaledVector(this.v, h);
    }
    const l = this.a.length();
    if (l > this.cap) {
      this.a.multiplyScalar(this.cap / l);
      this.v.multiplyScalar(0.5);
    }
  }

  apply(model, save) {
    const ang = this.a.length();
    if (ang < 1e-4) return;
    const axis = _w.copy(this.a).divideScalar(ang);
    for (let i = 0; i < this.bones.length; i++) {
      const b = this.bones[i];
      // parent's rotation relative to the model root
      _q.identity();
      let p = b.parent;
      const chain = [];
      while (p && p !== model) {
        chain.push(p);
        p = p.parent;
      }
      for (let j = chain.length - 1; j >= 0; j--) _q.multiply(chain[j].quaternion);
      // offset defined in model space, expressed in the bone's parent space: P^-1 * W * P
      _q2.setFromAxisAngle(axis, ang * this.weights[i]);
      const inv = _q.clone().invert();
      save(b);
      b.quaternion.premultiply(inv.multiply(_q2).multiply(_q)).normalize();
    }
  }
}

/** Per-fighter physics body built from named bones. */
export class Body {
  constructor(model, girth = 0.16) {
    this.model = model;
    const g = (n) => model.getObjectByName(n);
    this.b = {
      pelvis: g('pelvis'), spine1: g('spine_01'), spine2: g('spine_02'), spine3: g('spine_03'),
      neck: g('neck_01'), head: g('head'),
      handL: g('hand_l'), handR: g('hand_r'), knuckL: g('middle_01_l'), knuckR: g('middle_01_r'),
    };
    this.girth = girth;
    this.headR = 0.125;
    this.glove = [new THREE.Vector3(), new THREE.Vector3()];
    this.prevGlove = [new THREE.Vector3(), new THREE.Vector3()];
    this.gloveVel = [new THREE.Vector3(), new THREE.Vector3()];
    this.headC = new THREE.Vector3();
    this.chestP = new THREE.Vector3();
    this.hipP = new THREE.Vector3();
    this.neckP = new THREE.Vector3();
    this.headSpring = new Spring([this.b.neck, this.b.head], [0.45, 0.6], 150, 0.32, 0.75);
    this.torsoSpring = new Spring([this.b.spine1, this.b.spine2, this.b.spine3], [0.3, 0.35, 0.35], 110, 0.38, 0.5);
    this.primed = false;
    // bones we offset this frame, with their pure animated rotation; restored before the next
    // mixer update so offsets never pile up on bones the mixer doesn't rewrite (paused clips)
    this.base = new Map();
    this.save = (bone) => {
      if (!this.base.has(bone)) this.base.set(bone, bone.quaternion.clone());
    };
  }

  // undo last frame's physics offsets; call before the mixer poses the skeleton
  restore() {
    for (const [bone, q] of this.base) bone.quaternion.copy(q);
    this.base.clear();
  }

  // call after the mixer has posed the skeleton
  sample(dt) {
    this.model.updateMatrixWorld(true);
    const { b } = this;
    for (let i = 0; i < 2; i++) {
      this.prevGlove[i].copy(this.glove[i]);
      const hand = i === 0 ? b.handL : b.handR;
      const kn = i === 0 ? b.knuckL : b.knuckR;
      // the glove's centre sits a little past the knuckles
      hand.getWorldPosition(_v);
      kn.getWorldPosition(this.glove[i]);
      this.glove[i].sub(_v).multiplyScalar(1.25).add(_v);
      if (this.primed && dt > 0) this.gloveVel[i].subVectors(this.glove[i], this.prevGlove[i]).divideScalar(dt);
    }
    if (!this.primed) {
      this.prevGlove[0].copy(this.glove[0]);
      this.prevGlove[1].copy(this.glove[1]);
      this.primed = true;
    }
    b.head.getWorldPosition(this.headC);
    _v.set(0, 1, 0).applyQuaternion(b.head.getWorldQuaternion(_q)).multiplyScalar(0.09);
    this.headC.add(_v);
    b.neck.getWorldPosition(this.neckP);
    b.spine3.getWorldPosition(this.chestP);
    b.pelvis.getWorldPosition(this.hipP);
    this.hipP.y += 0.08;
  }

  /**
   * Sweep a glove of `att` this frame against this body. Returns { zone, point, dist } or null.
   * zone: 'head' | 'body' | 'guard' (the defender's own gloves).
   */
  contact(att, hand, guardUp) {
    const p0 = att.prevGlove[hand], p1 = att.glove[hand];
    const out = new THREE.Vector3();
    if (guardUp) {
      for (let i = 0; i < 2; i++) {
        const d = segPoint(p0, p1, this.glove[i], out);
        if (d < GLOVE_R * 2.1) return { zone: 'guard', point: out.clone().lerp(this.glove[i], 0.5), dist: d };
      }
    }
    const dh = segPoint(p0, p1, this.headC, out);
    if (dh < this.headR + GLOVE_R) return { zone: 'head', point: out.lerp(this.headC, 0.6).clone(), dist: dh };
    // torso: a capsule from hip to chest, tested against the glove's end position
    const tp = new THREE.Vector3();
    const db = pointSeg(p1, this.hipP, this.chestP, tp);
    if (db < this.girth + GLOVE_R) return { zone: 'body', point: tp.lerp(p1, 0.6).clone(), dist: db };
    return null;
  }

  // closest the glove ever got to the head and body this frame (for calibration)
  clearance(att, hand) {
    const out = new THREE.Vector3();
    return {
      head: segPoint(att.prevGlove[hand], att.glove[hand], this.headC, out) - this.headR - GLOVE_R,
      body: pointSeg(att.glove[hand], this.hipP, this.chestP, out) - this.girth - GLOVE_R,
    };
  }

  /**
   * Physical hit reaction: angular impulse = r x v about the neck (head) or hips (body),
   * converted into model space. Mirrored models flip handedness, so the sign follows det.
   */
  impulse(zone, point, vel, strength) {
    const pivot = zone === 'head' ? this.neckP : this.hipP;
    const r = _v.subVectors(point, pivot);
    const w = new THREE.Vector3().crossVectors(r, vel);
    if (w.lengthSq() < 1e-6) w.set(0, 0, 1).cross(vel);
    w.normalize();
    // into model space
    const inv = new THREE.Matrix4().copy(this.model.matrixWorld).invert();
    w.transformDirection(inv);
    const det = Math.sign(this.model.matrixWorld.determinant()) || 1;
    w.multiplyScalar(det * strength);
    (zone === 'head' ? this.headSpring : this.torsoSpring).kick(w);
    if (zone === 'head') this.torsoSpring.kick(w.clone().multiplyScalar(0.25));
  }

  // a nudge in model space: x pitch (+ = forward), y twist, z side bend
  nudge(spring, x, y, z) {
    (spring === 'head' ? this.headSpring : this.torsoSpring).kick(_w.set(x, y, z));
  }

  /**
   * Aim a punching arm at a world-space target with two-bone IK, blended by `w` (0..1) over
   * the animated pose. Solved in model space so the mirrored blue corner works the same.
   * If the target is out of reach the arm just extends toward it and falls short.
   */
  aim(hand, target, w) {
    if (w <= 0.001) return;
    const m = this.model;
    const sfx = hand === 0 ? '_l' : '_r';
    const up = m.getObjectByName('upperarm' + sfx);
    const lo = m.getObjectByName('lowerarm' + sfx);
    const hd = hand === 0 ? this.b.handL : this.b.handR;
    const kn = hand === 0 ? this.b.knuckL : this.b.knuckR;
    const cl = m.getObjectByName('clavicle' + sfx);
    const modelQ = (o) => {
      const q = new THREE.Quaternion();
      const chain = [];
      for (let p = o; p && p !== m; p = p.parent) chain.push(p);
      for (let j = chain.length - 1; j >= 0; j--) q.multiply(chain[j].quaternion);
      return q;
    };
    const rotateBone = (bone, delta) => {
      if (!Number.isFinite(delta.x + delta.y + delta.z + delta.w)) return;
      const Pq = modelQ(bone.parent);
      const inv = Pq.clone().invert();
      this.save(bone);
      bone.quaternion.premultiply(inv.multiply(delta).multiply(Pq)).normalize();
    };
    m.updateMatrixWorld(true);
    const P = (o) => m.worldToLocal(o.getWorldPosition(new THREE.Vector3()));
    // out of reach: roll the shoulder forward (protract the clavicle) for a few more centimetres
    {
      const S0 = P(up), C = P(cl);
      const W0 = P(hd), K0 = P(kn);
      const G0 = K0.sub(W0).multiplyScalar(1.25).add(W0);
      const len = S0.distanceTo(P(lo)) + P(lo).distanceTo(G0);
      const tm = m.worldToLocal(target.clone());
      const excess = tm.distanceTo(S0) - len;
      if (excess > 0) {
        const S1 = S0.clone().addScaledVector(tm.clone().sub(S0).normalize(), Math.min(0.08, excess) * w);
        rotateBone(cl, new THREE.Quaternion().setFromUnitVectors(S0.sub(C).normalize(), S1.sub(C).normalize()));
        m.updateMatrixWorld(true);
      }
    }
    const S = P(up), E = P(lo), W = P(hd), K = P(kn);
    const G = K.sub(W).multiplyScalar(1.25).add(W);
    const a = E.distanceTo(S), b = G.distanceTo(E);
    const T = G.clone().lerp(m.worldToLocal(target.clone()), w);
    const toT = T.clone().sub(S);
    const d = Math.max(Math.abs(a - b) + 1e-3, Math.min(a + b - 1e-3, toT.length()));
    const dir = toT.normalize();
    const pole = E.clone().sub(S);
    pole.addScaledVector(dir, -pole.dot(dir));
    if (pole.lengthSq() < 1e-6) pole.set(0, -1, 0);
    pole.normalize();
    const cosA = (a * a + d * d - b * b) / (2 * a * d);
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    const E2 = S.clone().addScaledVector(dir, a * cosA).addScaledVector(pole, a * sinA);
    const Tc = S.clone().addScaledVector(dir, d);
    const d1 = new THREE.Quaternion().setFromUnitVectors(E.clone().sub(S).normalize(), E2.clone().sub(S).normalize());
    rotateBone(up, d1);
    const G1 = G.clone().sub(S).applyQuaternion(d1).add(S);
    const d2 = new THREE.Quaternion().setFromUnitVectors(G1.sub(E2).normalize(), Tc.sub(E2).normalize());
    rotateBone(lo, d2);
  }

  // advance springs and layer them onto the animated pose
  update(dt) {
    this.headSpring.step(dt);
    this.torsoSpring.step(dt);
    this.torsoSpring.apply(this.model, this.save);
    this.headSpring.apply(this.model, this.save);
  }
}

// ---------------- impact effects ----------------

function burstTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.translate(64, 64);
  g.fillStyle = '#ffffff';
  g.beginPath();
  const n = 9;
  for (let i = 0; i <= n * 2; i++) {
    const r = i % 2 ? 26 : 62;
    const a = (i / (n * 2)) * Math.PI * 2;
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Impacts {
  constructor(scene) {
    this.scene = scene;
    this.tex = burstTexture();
    this.bursts = [];
    const N = 160;
    this.N = N;
    this.pos = new Float32Array(N * 3);
    this.vel = new Float32Array(N * 3);
    this.life = new Float32Array(N);
    this.col = new Float32Array(N * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.035, vertexColors: true, transparent: true, depthWrite: false }));
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.next = 0;
    for (let i = 0; i < N; i++) this.pos[i * 3 + 1] = -99;
  }

  spawn(point, dir, kind, power = 1) {
    // star burst
    const color = kind === 'guard' ? '#9CC3FF' : kind === 'dust' ? '#B8AE9F' : '#FFF3C4';
    if (kind !== 'dust') {
      const m = new THREE.SpriteMaterial({ map: this.tex, color, transparent: true, depthTest: false, depthWrite: false });
      const s = new THREE.Sprite(m);
      s.position.copy(point);
      s.renderOrder = 10;
      const size = (kind === 'guard' ? 0.22 : 0.3) * (0.7 + power * 0.5);
      s.scale.setScalar(size * 0.4);
      s.material.rotation = Math.random() * Math.PI;
      this.scene.add(s);
      this.bursts.push({ s, t: 0, size });
    }
    // sweat / dust spray
    const n = kind === 'dust' ? 22 : Math.round(6 + power * 8);
    const c = new THREE.Color(kind === 'dust' ? '#8F8576' : kind === 'guard' ? '#DDE9FF' : '#FFFFFF');
    for (let k = 0; k < n; k++) {
      const i = this.next;
      this.next = (this.next + 1) % this.N;
      this.pos.set([point.x, point.y, point.z], i * 3);
      const sp = kind === 'dust' ? 0.8 + Math.random() : 1.2 + Math.random() * 2.2 * power;
      const vx = dir.x * sp + (Math.random() - 0.5) * 1.6;
      const vy = (kind === 'dust' ? 0.3 : 0.6) + Math.random() * 1.6;
      const vz = dir.z * sp + (Math.random() - 0.5) * 1.6;
      this.vel.set([vx, vy, vz], i * 3);
      this.life[i] = kind === 'dust' ? 0.7 : 0.45 + Math.random() * 0.25;
      this.col.set([c.r, c.g, c.b], i * 3);
    }
  }

  update(dt) {
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.t += dt;
      const k = b.t / 0.16;
      b.s.scale.setScalar(b.size * (0.4 + 0.8 * Math.min(1, k)));
      b.s.material.opacity = Math.max(0, 1 - k * k);
      if (k >= 1) {
        this.scene.remove(b.s);
        b.s.material.dispose();
        this.bursts.splice(i, 1);
      }
    }
    for (let i = 0; i < this.N; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const j = i * 3;
      this.vel[j + 1] -= 9.8 * dt;
      this.pos[j] += this.vel[j] * dt;
      this.pos[j + 1] += this.vel[j + 1] * dt;
      this.pos[j + 2] += this.vel[j + 2] * dt;
      if (this.pos[j + 1] < 0.01) {
        this.pos[j + 1] = 0.01;
        this.vel[j] *= 0.3;
        this.vel[j + 2] *= 0.3;
        this.vel[j + 1] = 0;
      }
      if (this.life[i] <= 0) this.pos[j + 1] = -99;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}
