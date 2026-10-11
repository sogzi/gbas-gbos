// A boxer: the 3D model, its animation mixer and the combat state machine.
import * as THREE from 'three';
import { MOVES, RULES } from './data.js';
import { sfx } from './audio.js';

const FADE = 0.09;

export class Fighter {
  /**
   * @param gltf  loaded model with clips Idle, Jab, Cross, Hook, Block, Victory, Uppercut, Slip, Hit, HitBody, Down
   * @param data  entry from FIGHTERS
   * @param side  -1 = red corner on the left (faces +x), +1 = blue corner on the right (faces -x)
   */
  constructor(gltf, data, side) {
    this.data = data;
    this.side = side;
    this.root = new THREE.Group();
    this.model = gltf.scene;
    this.model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = false; // skinned bounds don't follow the knockdown
      }
    });
    // the blue corner is mirrored into a southpaw stance so both fighters open their chests to the camera
    this.model.scale.x = side > 0 ? -1 : 1;
    this.root.add(this.model);
    this.root.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;

    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = {};
    for (const clip of gltf.animations) {
      this.actions[clip.name] = this.mixer.clipAction(clip);
    }
    this.mixer.addEventListener('finished', (e) => this._onFinished(e.action));

    const s = data.stats;
    this.powerMul = 0.55 + s.power * 0.09;
    this.defMul = 1.2 - s.defence * 0.05;
    this.walkSpeed = 1.05 + s.speed * 0.07;
    this.staminaRegen = 9 + s.stamina * 1.4;
    this.reset(true);
  }

  reset(full) {
    this.time = this.time ?? 0;
    this.x = this.side * 1.6;
    this.vx = 0;
    this.hp = 100;
    this.shownHp = 100;
    this.stamina = 100;
    if (full) {
      this.sig = 0;
      this.knockdowns = 0;
      this.stats = { thrown: 0, landed: 0, bestCombo: 0, knockdownsScored: 0, damage: 0 };
      this.roundDamage = 0;
    }
    this.combo = 0;
    this.lastLanded = -10;
    this.state = 'idle';
    this.stateT = 0;
    this.move = null;
    this.queue = [];
    this.buffered = null;
    this.blockHeld = false;
    this.moveIntent = 0;
    this.lastMoveKind = null;
    this.lastMoveEnd = -10;
    this.root.position.set(this.x, 0, 0);
    this.mixer.stopAllAction();
    this.cur = null;
    this.play('Idle', { loop: true, fade: 0 });
  }

  // ---------- animation ----------
  play(name, { loop = false, timeScale = 1, fade = FADE, from = 0 } = {}) {
    const a = this.actions[name];
    if (!a) return null;
    a.enabled = true;
    a.paused = false;
    a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    a.clampWhenFinished = !loop;
    a.reset();
    a.time = from;
    a.setEffectiveTimeScale(timeScale);
    a.setEffectiveWeight(1);
    a.play();
    if (this.cur && this.cur !== a && fade > 0) {
      this.cur.crossFadeTo(a, fade, false);
    } else if (this.cur && this.cur !== a) {
      this.cur.stop();
    }
    this.cur = a;
    return a;
  }

  clipLen(name) {
    return this.actions[name]?.getClip().duration ?? 0.5;
  }

  _onFinished(action) {
    if (action !== this.cur) return;
    if (this.state === 'getup') {
      this.toIdle();
    }
  }

  toIdle(fade = 0.12) {
    this.state = 'idle';
    this.stateT = 0;
    this.move = null;
    this.play('Idle', { loop: true, fade });
    if (this.blockHeld) this.startBlock();
  }

  // ---------- queries ----------
  get busy() {
    return !['idle', 'block'].includes(this.state);
  }

  get tired() {
    return this.stamina < 12;
  }

  get isBlocking() {
    return this.state === 'block' && this.stateT > 0.06;
  }

  get isSlipping() {
    if (this.state !== 'slip') return false;
    return this.stateT > 0.04 && this.stateT < this.slipDur * 0.7;
  }

  get canAct() {
    return this.state === 'idle' || this.state === 'block';
  }

  // ---------- commands ----------
  punch(kind, opts = {}) {
    if (this.state === 'punch' && !opts.force) {
      // buffer the next punch late in the current one so combos flow
      if (this.stateT > this.move.dur * 0.45) this.buffered = kind;
      return false;
    }
    if (!this.canAct && !opts.force) return false;
    const now = this.time;
    // a jab straight after a jab becomes the one-two (cross)
    if (kind === 'jab' && !opts.sig && this.lastMoveKind === 'jab' && now - this.lastMoveEnd < 0.35) kind = 'cross';
    const base = MOVES[kind];
    const cost = opts.sig ? 0 : base.stam;
    if (!opts.sig && this.stamina < 3) return false;
    this.stamina = Math.max(0, this.stamina - cost);
    let ts = (opts.timeScale ?? 1) * (this.tired ? 0.78 : 1);
    const clip = opts.clip ?? base.clip;
    const dur = this.clipLen(clip) / ts;
    this.move = {
      kind, ...base, clip, dur, hitAt: base.hit * dur, done: false,
      dmgMul: (opts.dmgMul ?? 1) * (this.tired ? 0.6 : 1), stun: opts.stun ?? 0, blockMul: opts.blockMul ?? 1,
      sig: opts.sig ?? null, reach: base.reach + (opts.reachAdd ?? 0),
    };
    this.state = 'punch';
    this.stateT = 0;
    this.stats.thrown++;
    this.play(clip, { timeScale: ts, fade: 0.06 });
    sfx.whoosh(ts);
    return true;
  }

  signature() {
    if (this.sig < 3 || !this.canAct) return false;
    this.sig = 0;
    if (this.data.id === 'dayo') {
      // Last Stop: jab, cross, jab, cross, hook
      const seq = ['jab', 'cross', 'jab', 'cross', 'hook'];
      this.queue = seq.slice(1).map((k, i) => ({ kind: k, opts: { sig: 'Last Stop', timeScale: 1.55, dmgMul: i === 3 ? 1.5 : 0.85, blockMul: 3, reachAdd: 0.06 } }));
      this.punch(seq[0], { sig: 'Last Stop', timeScale: 1.55, dmgMul: 0.85, blockMul: 3, reachAdd: 0.06, force: true });
    } else {
      // Pepper Soup: a slow overhand right that stuns for two seconds
      this.punch('cross', { sig: 'Pepper Soup', timeScale: 0.62, dmgMul: 2.6, stun: 2.0, blockMul: 2, reachAdd: 0.08, force: true });
    }
    return true;
  }

  startBlock() {
    this.blockHeld = true;
    if (this.state !== 'idle') return;
    this.state = 'block';
    this.stateT = 0;
    const a = this.play('Block', { timeScale: 1.8, fade: 0.06 });
    this.blockPeak = this.clipLen('Block') * 0.5;
    this.blockAction = a;
  }

  endBlock() {
    this.blockHeld = false;
    if (this.state === 'block') this.toIdle(0.12);
  }

  slip() {
    if (!this.canAct || this.stamina < 6) return false;
    this.stamina -= 6;
    this.state = 'slip';
    this.stateT = 0;
    this.slipDur = this.clipLen('Slip') / 1.15;
    this.play('Slip', { timeScale: 1.15, fade: 0.05 });
    sfx.whoosh(1.3);
    return true;
  }

  // ---------- being hit ----------
  takeHit(move, dmg, attacker) {
    this.hp = Math.max(0, this.hp - dmg);
    this.queue = [];
    this.buffered = null;
    this.vx += -this.facing * (0.5 + dmg * 0.09);
    if (this.hp <= 0) return 'down';
    if (move.stun) {
      this.state = 'stun';
      this.stateT = 0;
      this.stunFor = move.stun;
      this.play(move.react, { fade: 0.04 });
      return 'stun';
    }
    this.state = 'hit';
    this.stateT = 0;
    this.hitFor = this.clipLen(move.react) * 0.85;
    this.play(move.react, { fade: 0.04 });
    return 'hit';
  }

  knockDown() {
    this.state = 'down';
    this.stateT = 0;
    this.knockdowns++;
    this.queue = [];
    this.buffered = null;
    this.blockHeld = false;
    this.play('Down', { fade: 0.06 });
    setTimeout(() => sfx.fall(), 650);
  }

  getUp() {
    this.state = 'getup';
    this.stateT = 0;
    const len = this.clipLen('Down');
    const a = this.play('Down', { timeScale: -1.25, fade: 0.0, from: len });
    a.time = len;
    this.hp = Math.max(this.hp, 46 + (this.data.stats.stamina - 5) * 3 - (this.knockdowns - 1) * 12);
    this.shownHp = this.hp;
    this.stamina = Math.max(this.stamina, 55);
  }

  win() {
    this.state = 'victory';
    this.stateT = 0;
    this.play('Victory', { fade: 0.2 });
  }

  get facing() {
    return -this.side; // +1 faces +x
  }

  // ---------- per frame ----------
  update(dt, opp, match) {
    this.time += dt;
    this.stateT += dt;
    const moving = this.canAct && Math.abs(this.moveIntent) > 0.05;

    switch (this.state) {
      case 'punch': {
        const m = this.move;
        if (!m.done && this.stateT >= m.hitAt) {
          m.done = true;
          match.resolve(this, opp, m);
        }
        // step into straight punches a touch
        if (this.stateT < m.hitAt) this.x += this.facing * 0.35 * dt;
        if (this.stateT >= m.dur * 0.82) {
          this.lastMoveKind = m.kind;
          this.lastMoveEnd = this.time;
          if (this.queue.length) {
            const n = this.queue.shift();
            this.punch(n.kind, { ...n.opts, force: true });
          } else if (this.buffered) {
            const k = this.buffered;
            this.buffered = null;
            this.state = 'idle';
            if (!this.punch(k)) this.toIdle(0.1);
          } else {
            this.toIdle(0.14);
          }
        }
        break;
      }
      case 'block':
        if (this.blockAction && this.blockAction.time >= this.blockPeak) this.blockAction.paused = true;
        break;
      case 'slip':
        if (this.stateT >= this.slipDur * 0.9) this.toIdle(0.1);
        break;
      case 'hit':
        if (this.stateT >= this.hitFor) this.toIdle(0.12);
        break;
      case 'stun':
        if (this.stateT > 0.4 && this.cur !== this.actions.Idle) {
          this.play('Idle', { loop: true, timeScale: 0.35, fade: 0.25 });
        }
        // wobble on the spot while dazed
        this.model.rotation.z = Math.sin(this.stateT * 7) * 0.05 * Math.max(0, 1 - this.stateT / this.stunFor);
        if (this.stateT >= this.stunFor) {
          this.model.rotation.z = 0;
          this.toIdle(0.2);
        }
        break;
      default:
        break;
    }

    // footwork
    if (moving) {
      const sp = this.walkSpeed * (this.state === 'block' ? 0.45 : 1) * (this.tired ? 0.7 : 1);
      this.x += this.moveIntent * sp * dt;
      if (this.state === 'idle' && this.cur) this.cur.setEffectiveTimeScale(1.7);
    } else if (this.state === 'idle' && this.cur && this.cur === this.actions.Idle) {
      this.cur.setEffectiveTimeScale(1);
    }
    this.x += this.vx * dt;
    this.vx *= Math.exp(-dt * 9);

    // stamina
    if (this.state !== 'punch' && this.state !== 'down') {
      const k = this.state === 'block' ? 0.4 : moving ? 0.8 : 1;
      this.stamina = Math.min(100, this.stamina + this.staminaRegen * k * dt);
    }
    this.shownHp += (this.hp - this.shownHp) * Math.min(1, dt * 1.6);

    this.root.position.x = this.x;
    this.mixer.update(dt);
  }

  clamp() {
    this.x = THREE.MathUtils.clamp(this.x, -RULES.ringHalf, RULES.ringHalf);
  }
}
