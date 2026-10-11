// The referee: stays out of the way, starts the fight, counts knockdowns, raises the winner's hand.
import * as THREE from 'three';

export class Referee {
  constructor(gltf) {
    this.root = new THREE.Group();
    this.model = gltf.scene;
    this.model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = false;
      }
    });
    this.root.add(this.model);
    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = {};
    for (const c of gltf.animations) this.actions[c.name] = this.mixer.clipAction(c);
    this.cur = null;
    this.target = new THREE.Vector3(0, 0, -1.4);
    this.yaw = 0;
    this.targetYaw = 0;
    this.reset();
  }

  reset() {
    this.root.position.set(0, 0, -1.6);
    this.target.set(0, 0, -1.6);
    this.mixer.stopAllAction();
    this.cur = null;
    this.play('Idle', true);
  }

  play(name, loop = false, timeScale = 1) {
    const a = this.actions[name];
    if (!a) return;
    a.reset();
    a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    a.clampWhenFinished = !loop;
    a.setEffectiveTimeScale(timeScale);
    a.setEffectiveWeight(1);
    a.play();
    if (this.cur && this.cur !== a) this.cur.crossFadeTo(a, 0.2, false);
    this.cur = a;
  }

  signalFight() {
    this.play('Fight');
    clearTimeout(this._t);
    this._t = setTimeout(() => this.play('Idle', true), 1300);
  }

  countOnce() {
    this.play('Count', false, 1.05);
  }

  // `winnerSide` is the fighter's side: -1 on the left of the screen, +1 on the right
  raise(winnerSide) {
    clearTimeout(this._t);
    // the referee faces the camera, so his right hand is on the left of the screen
    this.play(winnerSide < 0 ? 'WinRight' : 'WinLeft');
  }

  idle() {
    clearTimeout(this._t);
    this.play('Idle', true);
  }

  update(dt) {
    const p = this.root.position;
    const d = this.target.clone().sub(p);
    const dist = d.length();
    if (dist > 0.01) p.addScaledVector(d, Math.min(1, dt * 2.2));
    this.yaw += (this.targetYaw - this.yaw) * Math.min(1, dt * 4);
    this.root.rotation.y = this.yaw;
    this.mixer.update(dt);
  }
}
