// A boxer: the 3D model, its animation mixer and the combat state machine.
import * as THREE from 'three';
import { MOVES, RULES } from './data.js';
import { sfx } from './audio.js';
import { Body } from './physics.js';

const FADE = 0.09;

export class Fighter {
  /**
   * @param gltf  loaded model with clips Idle, Jab, Cross, Hook, Block, Victory, Uppercut, Slip, Duck, Hit, HitBody, Down
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
    // a physics body on the skeleton; heavier builds are thicker through the middle
    this.body = new Body(this.model, data.torso ?? 0.16);
    // mass in kg: heavier fighters push lighter ones and get knocked about less
    this.mass = 62 + s.power * 2 + s.stamina * 1.2;
    this.accel = 6 + s.speed * 0.9;
    this.powerMul = 0.55 + s.power * 0.09;
    this.defMul = 1.2 - s.defence * 0.05;
    this.walkSpeed = 1.05 + s.speed * 0.07;
    this.staminaRegen = 9 + s.stamina * 1.4;
    this.reset(true);
  }

  reset(full) {
    this.time = this.time ?? 0;
    this.x = this.side * 1.6;
    this.vx = 0; // impulses: knockback, rope rebound, being shoved
    this.v = 0; // footwork velocity
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
    this.after = null; // a punch to throw when the current dodge ends (Express Lane)
    this.ironUntil = -1; // No Shaking: no hit-stun until this time
    this.moveIntent = 0;
    this.lastMoveKind = null;
    this.lastMoveEnd = -10;
    this.root.position.set(this.x, 0, 0);
    for (const sp of [this.body.headSpring, this.body.torsoSpring]) {
      sp.a.set(0, 0, 0);
      sp.v.set(0, 0, 0);
    }
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
    // Express Lane is clear from its first frame
    return this.stateT > (this.after ? 0 : 0.04) && this.stateT < this.slipDur * (this.after ? 0.85 : 0.7);
  }

  // low enough that straights and hooks to the head go over
  get isDucking() {
    return this.state === 'duck' && this.stateT > 0.03 && this.stateT < this.duckDur * 0.7;
  }

  get isParrying() {
    return this.state === 'parry';
  }

  get iron() {
    return this.time < this.ironUntil;
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
      sig: opts.sig ?? null, hand: base.hand,
    };
    this.state = 'punch';
    this.stateT = 0;
    this.stats.thrown++;
    // step into the shot: straights carry the body forward, hooks and uppercuts rotate in place
    this.vx += this.facing * (kind === 'jab' || kind === 'cross' ? 0.55 : 0.25) * (opts.sig ? 1.2 : 1);
    // and lean the torso into it, which is where the last few centimetres of reach come from
    this.body.nudge('torso', kind === 'uppercut' ? 0.8 : kind === 'hook' ? 2.0 : 3.4, 0, 0);
    this.play(clip, { timeScale: ts, fade: 0.06 });
    sfx.whoosh(ts);
    return true;
  }

  // returns the signature's name when it fires, or false
  signature() {
    if (this.sig < 3 || !this.canAct) return false;
    this.sig = 0;
    const name = this.data.signature.name;
    switch (this.data.id) {
      case 'dayo': {
        // Last Stop: jab, cross, jab, cross, hook
        const seq = ['jab', 'cross', 'jab', 'cross', 'hook'];
        this.queue = seq.slice(1).map((k, i) => ({ kind: k, opts: { sig: name, timeScale: 1.55, dmgMul: i === 3 ? 1.5 : 0.85, blockMul: 3 } }));
        this.punch(seq[0], { sig: name, timeScale: 1.55, dmgMul: 0.85, blockMul: 3, force: true });
        break;
      }
      case 'bisi':
        // Pepper Soup: a slow overhand right that stuns for two seconds
        this.punch('cross', { sig: name, timeScale: 0.62, dmgMul: 2.6, stun: 2.0, blockMul: 2, force: true });
        break;
      case 'emeka':
        // Express Lane: a long slip that nothing can touch, carrying him in, then a hook and a cross from the side
        this.slip({ free: true, timeScale: 0.9, dash: 0.9 });
        this.after = { kind: 'hook', opts: { sig: name, timeScale: 1.25, dmgMul: 1.7, blockMul: 2.5 } };
        this.queue = [{ kind: 'cross', opts: { sig: name, timeScale: 1.25, dmgMul: 1.3, blockMul: 2 } }];
        break;
      case 'femi':
        // Hotfix: hold a parry for 1.2 s; whatever lands in it is turned away and answered (see Match.resolve)
        this.state = 'parry';
        this.stateT = 0;
        this.parryFor = 1.2;
        this.blockAction = this.play('Block', { timeScale: 2.2, fade: 0.05 });
        this.blockPeak = this.clipLen('Block') * 0.5;
        sfx.whoosh(0.8);
        break;
      case 'kola':
        // No Shaking: three seconds of no hit-stun while stamina pours back in
        this.ironUntil = this.time + 3;
        sfx.block();
        break;
      case 'chief':
        // Quit Notice: a heavy overhand right; the instant KO is decided in Match.resolve
        this.punch('cross', { sig: name, timeScale: 0.75, dmgMul: 2.0, blockMul: 2, force: true });
        break;
      default:
        return false;
    }
    // punch signatures get their callout when they land; the rest announce themselves now
    this.sigFresh = this.state === 'punch';
    return name;
  }

  // Hotfix landed: drop the parry and fire the counter
  counter() {
    this.state = 'idle';
    this.punch('cross', { sig: this.data.signature.name, timeScale: 1.35, dmgMul: 2.0, blockMul: 2, force: true });
  }

  // knocked off balance without damage (a parried punch)
  stagger(t) {
    this.queue = [];
    this.buffered = null;
    this.after = null;
    this.state = 'stun';
    this.stateT = 0;
    this.stunFor = t;
    this.play('Hit', { fade: 0.04 });
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

  slip({ free = false, timeScale = 1.15, dash = 0 } = {}) {
    if (!free && (!this.canAct || this.stamina < 6)) return false;
    if (!free) this.stamina -= 6;
    this.after = null;
    this.state = 'slip';
    this.stateT = 0;
    this.slipDur = this.clipLen('Slip') / timeScale;
    this.play('Slip', { timeScale, fade: 0.05 });
    if (dash) this.vx += this.facing * dash;
    sfx.whoosh(1.3);
    return true;
  }

  // bend at the waist and drop under the punch. While low (isDucking) head shots from jabs, crosses
  // and hooks go over (Match.resolve); uppercuts and body shots still land, and an uppercut hurts more
  duck() {
    if (!this.canAct || this.stamina < 5) return false;
    this.stamina -= 5;
    this.state = 'duck';
    this.stateT = 0;
    this.duckDur = this.clipLen('Duck') / 1.1;
    this.play('Duck', { timeScale: 1.1, fade: 0.05 });
    sfx.whoosh(1.1);
    return true;
  }

  // ---------- being hit ----------
  takeHit(move, dmg, attacker) {
    // minHp: Story's tutorial keeps the player standing; everywhere else it's unset
    this.hp = Math.max(this.minHp ?? 0, this.hp - dmg);
    this.vx += -this.facing * (0.45 + dmg * 0.11) * (78 / this.mass);
    if (this.hp <= 0) return 'down';
    // No Shaking: it hurts, but nothing stops him
    if (this.iron) return 'absorbed';
    // sluggers and tanks walk through light shots: they hurt, but don't stop the punch
    const arm = this.data.armour;
    if (arm && !move.stun && (dmg < arm.light || (this.state === 'punch' && dmg < arm.punching))) return 'absorbed';
    this.queue = [];
    this.buffered = null;
    this.after = null;
    if (move.stun) {
      this.state = 'stun';
      this.stateT = 0;
      this.stunFor = move.stun;
      this.play(move.react, { fade: 0.04 });
      return 'stun';
    }
    this.state = 'hit';
    this.stateT = 0;
    this.hitFor = this.clipLen(move.react) * (arm ? arm.recover : 0.85);
    this.play(move.react, { fade: 0.04 });
    return 'hit';
  }

  knockDown() {
    this.state = 'down';
    this.stateT = 0;
    this.knockdowns++;
    this.queue = [];
    this.buffered = null;
    this.after = null;
    this.ironUntil = -1;
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
    this.opp = opp;
    this.time += dt;
    this.stateT += dt;
    const moving = this.canAct && Math.abs(this.moveIntent) > 0.05;

    switch (this.state) {
      case 'punch': {
        const m = this.move;
        // the glove has to actually reach something: swept against the opponent each frame
        if (!m.done && this.stateT >= m.hitAt * 0.45) match.contact(this, opp, m);
        if (this.stateT >= m.dur * 0.82) {
          this.lastMoveKind = m.kind;
          this.lastMoveEnd = this.time;
          if (!m.landed) match.whiff?.(this, opp, m);
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
        if (this.stateT >= this.slipDur * 0.9) {
          if (this.after) {
            const n = this.after;
            this.after = null;
            this.state = 'idle';
            this.punch(n.kind, { ...n.opts, force: true });
          } else this.toIdle(0.1);
        }
        break;
      case 'duck':
        if (this.stateT >= this.duckDur * 0.9) this.toIdle(0.12);
        break;
      case 'parry':
        if (this.blockAction && this.blockAction.time >= this.blockPeak) this.blockAction.paused = true;
        if (this.stateT >= this.parryFor) this.toIdle(0.12);
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
    const sp = this.walkSpeed * (this.state === 'block' ? 0.45 : 1) * (this.tired ? 0.7 : 1);
    const want = moving ? this.moveIntent * sp : 0;
    const prevV = this.v;
    const dv = want - this.v;
    const a = (moving ? this.accel : this.accel * 1.6) * dt;
    this.v += Math.max(-a, Math.min(a, dv));
    if (!this.canAct && this.state !== 'punch') this.v *= Math.exp(-dt * 12);
    if (moving && this.state === 'idle' && this.cur) this.cur.setEffectiveTimeScale(1 + Math.abs(this.v) / sp * 0.7);
    else if (this.state === 'idle' && this.cur && this.cur === this.actions.Idle) this.cur.setEffectiveTimeScale(1);
    // the ropes: a stiff spring past the ring edge sends you back in
    const over = Math.abs(this.x) - RULES.ringHalf;
    if (over > 0 && this.state !== 'down') {
      const sgn = Math.sign(this.x);
      this.vx -= sgn * (over * 260 * (75 / this.mass)) * dt;
      if (Math.sign(this.vx) === sgn) this.vx *= Math.exp(-dt * 4);
      if (Math.sign(this.v) === sgn) this.v *= Math.exp(-dt * 14);
    }
    this.x += (this.v + this.vx) * dt;
    this.vx *= Math.exp(-dt * (this.state === 'down' ? 6 : 5.5));
    // head lags behind sudden changes of speed
    const acc = (this.v - prevV) / Math.max(dt, 1e-3);
    this.body.nudge('head', -acc * this.facing * 0.004, 0, 0);

    // stamina
    if (this.state !== 'punch' && this.state !== 'down') {
      const k = this.state === 'block' ? 0.4 : moving ? 0.8 : 1;
      this.stamina = Math.min(100, this.stamina + this.staminaRegen * k * dt);
    }
    if (this.iron) this.stamina = Math.min(100, this.stamina + 22 * dt);
    this.shownHp += (this.hp - this.shownHp) * Math.min(1, dt * 1.6);

    this.root.position.x = this.x;
    this.animate(dt);
  }

  // pose: animation first, then the physics springs on top, then refresh the hit volumes
  animate(dt) {
    this.body.restore();
    this.mixer.update(dt);
    this.body.update(dt);
    const m = this.move;
    if (this.state === 'punch' && m && this.opp) {
      // punches are thrown at the opponent's head: tracked until the fighter commits,
      // then locked, so a slip or a step back makes it miss
      const target = () => {
        const t = this.opp.body.headC.clone();
        if (m.kind === 'uppercut') t.y -= 0.07; // under the chin
        if (m.kind === 'hook') t.y -= 0.02;
        return t;
      };
      if (!m.lock && this.stateT >= m.hitAt * 0.55) m.lock = target();
      const tgt = m.lock ?? target();
      const k = this.stateT;
      const rise = THREE.MathUtils.smoothstep(k, 0, m.hitAt);
      const fall = 1 - THREE.MathUtils.smoothstep(k, m.hitAt + 0.04, m.dur * 0.85);
      this.body.aim(m.hand, tgt, rise * fall * (m.aimW ?? 1));
    }
    this.body.sample(dt);
  }

  clamp() {
    this.x = THREE.MathUtils.clamp(this.x, -RULES.ringHalf - 0.3, RULES.ringHalf + 0.3);
  }
}
