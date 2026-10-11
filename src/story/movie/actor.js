// A movie actor: a fighter model posed by hand (two-bone IK on arms and legs, a little spine and head),
// with bare hands instead of gloves. Only Story's cold-open movies use this; fights never do.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _t = new THREE.Vector3();
const _p = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3(), _n = new THREE.Vector3();
const _q = new THREE.Quaternion(), _w = new THREE.Quaternion(), _pw = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);

const wpos = (o, v) => v.setFromMatrixPosition(o.matrixWorld);

// turn `bone` so the point `from` (world, moved with the bone) ends up pointing at `to`
function aim(bone, from, to) {
  wpos(bone, _p);
  _d.copy(from).sub(_p).normalize();
  _e.copy(to).sub(_p).normalize();
  if (_d.lengthSq() < 1e-8 || _e.lengthSq() < 1e-8) return;
  _q.setFromUnitVectors(_d, _e);
  rotateWorld(bone, _q);
}

// apply a world-space rotation to a bone, keeping its parent where it is
function rotateWorld(bone, q) {
  bone.getWorldQuaternion(_w);
  bone.parent.getWorldQuaternion(_pw);
  bone.quaternion.copy(_pw.invert().multiply(q.clone().multiply(_w)));
  bone.updateMatrixWorld(true);
}

export class Actor {
  /**
   * @param gltf    loaded fighter or referee GLB
   * @param colors  optional kit colours by material key (Tunde)
   * @param skin    hex colour for the bare hands
   */
  constructor(gltf, { model, colors, hands = true } = {}) {
    this.root = new THREE.Group();
    this.body = SkeletonUtils.clone(gltf.scene);
    this.root.add(this.body);
    let skinMat = null;
    this.body.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;
      const name = o.material.name;
      if (hands && /glove|gcuff/.test(name)) o.visible = false;
      if (/_skin$/.test(name)) skinMat = o.material;
      const key = name.replace(`${model}_`, '').replace(/\.\d+$/, '');
      if (colors?.[key]) {
        o.material = o.material.clone();
        o.material.color.set(colors[key]);
      }
    });
    this.bones = {};
    this.body.traverse((o) => {
      if (o.isBone) this.bones[o.name] = o;
    });
    this.rest = Object.values(this.bones).map((b) => [b, b.quaternion.clone(), b.position.clone()]);
    this.root.updateMatrixWorld(true);
    if (hands && skinMat && this.bones.hand_l) for (const s of ['l', 'r']) this._mitten(this.bones[`hand_${s}`], skinMat, s);
    // measured once from the rest pose
    const B = this.bones;
    const y = (n) => wpos(B[n], _a).y;
    this.hipY = y('pelvis');
    this.shoulderY = y('upperarm_l');
    this.armLen = wpos(B.upperarm_l, _a).distanceTo(wpos(B.lowerarm_l, _b)) + _b.distanceTo(wpos(B.hand_l, _c));
    this.pose = {};
    this.walkPhase = 0;
  }

  // a cartoon bare hand: palm and thumb, sized in world units whatever the bone's scale
  _mitten(bone, mat, side) {
    const s = new THREE.Vector3();
    bone.getWorldScale(s);
    const k = 1 / (s.x || 1);
    const g = new THREE.Group();
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.048, 14, 10), mat);
    palm.scale.set(1.05, 1.5, 0.62);
    palm.position.y = 0.07;
    const thumb = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), mat);
    thumb.scale.set(1, 1.9, 1);
    thumb.position.set(side === 'l' ? 0.035 : -0.035, 0.05, 0.03);
    thumb.rotation.z = side === 'l' ? -0.5 : 0.5;
    for (const m of [palm, thumb]) {
      m.castShadow = true;
      g.add(m);
    }
    g.scale.setScalar(k);
    bone.add(g);
  }

  // body frame: R to the actor's right, U up, F forward (the model faces +Z, so its right is -X)
  _local(v, out) {
    return this.body.localToWorld(out.set(-v[0], v[1], v[2]));
  }

  _limb(upper, lower, end, target, pole) {
    const B = this.bones;
    const a = B[upper], b = B[lower], c = B[end];
    wpos(a, _a);
    wpos(b, _b);
    wpos(c, _c);
    const l1 = _a.distanceTo(_b), l2 = _b.distanceTo(_c);
    _d.copy(target).sub(_a);
    const dist = THREE.MathUtils.clamp(_d.length(), Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
    _d.normalize();
    const x = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
    const h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
    _n.copy(pole).sub(_a);
    _n.addScaledVector(_d, -_n.dot(_d)).normalize();
    const elbow = _a.clone().addScaledVector(_d, x).addScaledVector(_n, h); // the elbow or knee
    const reach = _a.clone().addScaledVector(_d, dist);
    aim(a, _b.clone(), elbow);
    aim(b, wpos(c, _c).clone(), reach);
  }

  /**
   * Pose fields (all optional), in the body frame [right, up, forward] metres from the feet:
   *   drop: lower the hips (crouch), lean: forward bend (rad), tilt: sideways bend to the right (rad),
   *   twist: turn the chest right (rad), headYaw/headPitch (rad), bob: whole-body lift,
   *   l/r: hand targets, lf/rf: foot targets (default: standing where they are)
   */
  update() {
    for (const [b, q, p] of this.rest) {
      b.quaternion.copy(q);
      b.position.copy(p);
    }
    const P = this.pose;
    this.body.position.y = (P.bob ?? 0) - (P.drop ?? 0);
    this.root.updateMatrixWorld(true);
    const B = this.bones;
    // feet first, planted unless told otherwise
    const feet = { l: P.lf ?? [-0.14, 0.07, 0.02], r: P.rf ?? [0.14, 0.07, 0.02] };
    // the feet are planted in the root's frame, not the bobbing body's
    for (const s of ['l', 'r']) {
      const v = feet[s];
      const tgt = this.root.localToWorld(new THREE.Vector3(-v[0], v[1], v[2]));
      const knee = this.root.localToWorld(new THREE.Vector3(-v[0] * 1.2, 0.5, 1.5));
      this._limb(`thigh_${s}`, `calf_${s}`, `foot_${s}`, tgt, knee);
    }
    // spine: lean, tilt and twist share out over the three spine bones
    const fwd = new THREE.Vector3(0, 0, 1).transformDirection(this.root.matrixWorld);
    const right = new THREE.Vector3(-1, 0, 0).transformDirection(this.root.matrixWorld);
    const up = UP;
    for (const n of ['spine_01', 'spine_02', 'spine_03']) {
      const q = new THREE.Quaternion();
      if (P.lean) q.multiply(new THREE.Quaternion().setFromAxisAngle(right, P.lean / 3));
      if (P.tilt) q.multiply(new THREE.Quaternion().setFromAxisAngle(fwd, -P.tilt / 3));
      if (P.twist) q.multiply(new THREE.Quaternion().setFromAxisAngle(up, -P.twist / 3));
      rotateWorld(B[n], q);
    }
    if (P.headYaw || P.headPitch) {
      const q = new THREE.Quaternion().setFromAxisAngle(up, -(P.headYaw ?? 0));
      q.multiply(new THREE.Quaternion().setFromAxisAngle(right, P.headPitch ?? 0));
      rotateWorld(B.neck_01, q);
    }
    // arms: hanging by the sides unless given a target
    for (const s of ['l', 'r']) {
      const side = s === 'r' ? 1 : -1;
      const tgt = this._local(P[s] ?? [side * 0.24, this.hipY - 0.08, 0.04], new THREE.Vector3());
      const elbow = this._local([side * 0.9, this.shoulderY - 0.5, -0.8], new THREE.Vector3());
      this._limb(`upperarm_${s}`, `lowerarm_${s}`, `hand_${s}`, tgt, elbow);
    }
  }

  // a world point in the body frame [right, up, forward], for gripping things
  toBody(v) {
    this.root.updateMatrixWorld(true);
    const l = this.body.worldToLocal(v.clone());
    return [-l.x, l.y, l.z];
  }

  // stand at a spot facing a point (or a yaw), feet planted
  place(pos, face) {
    this.root.position.copy(pos);
    if (typeof face === 'number') this.root.rotation.y = face;
    else if (face) this.root.rotation.y = Math.atan2(face.x - pos.x, face.z - pos.z);
  }

  // a walk cycle at a given distance along the path (so it's the same pose whenever you seek to it)
  walk(dist, speed = 1.2) {
    const stride = Math.min(0.32, 0.18 + speed * 0.1);
    const ph = (dist / (4 * stride)) * Math.PI * 2, P = this.pose;
    const foot = (o) => [0, Math.max(0, Math.sin(ph + o)) * 0.13 + 0.07, Math.cos(ph + o) * stride];
    const l = foot(0), r = foot(Math.PI);
    P.lf = [-0.12, l[1], l[2]];
    P.rf = [0.12, r[1], r[2]];
    P.bob = Math.abs(Math.sin(ph)) * 0.035 - 0.03;
    P.l = [-0.22, this.hipY - 0.1, -Math.cos(ph) * 0.16 + 0.04];
    P.r = [0.22, this.hipY - 0.1, Math.cos(ph) * 0.16 + 0.04];
    P.lean = 0.05;
  }
}
