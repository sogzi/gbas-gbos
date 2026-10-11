// CPU opponent. Produces the same intents a player would, with human-ish reaction times.
import { MOVES } from './data.js';

const LEVELS = {
  easy:   { react: 0.38, defend: 0.22, think: [0.7, 1.4], aggro: 0.45, combo: 0.15 },
  normal: { react: 0.24, defend: 0.45, think: [0.4, 0.95], aggro: 0.62, combo: 0.35 },
  hard:   { react: 0.15, defend: 0.68, think: [0.25, 0.6], aggro: 0.78, combo: 0.55 },
};

const STYLE = {
  // swarmer: works inside, lots of jabs and hooks
  dayo: { jab: 0.42, hook: 0.3, upper: 0.18, slipBias: 0.55 },
  // slugger: fewer, heavier shots
  bisi: { jab: 0.3, hook: 0.38, upper: 0.32, slipBias: 0.2 },
};

export class CPU {
  constructor(me, opp, level = 'normal') {
    this.me = me;
    this.opp = opp;
    this.lv = LEVELS[level] ?? LEVELS.normal;
    this.style = STYLE[me.data.id] ?? STYLE.dayo;
    this.reset();
  }

  reset() {
    this.thinkT = 0.8;
    this.seenPunch = null;
    this.defendAt = null;
    this.defendKind = null;
    this.blockUntil = 0;
    this.combo = [];
    this.drift = 0;
    this.driftT = 0;
    this.t = 0;
  }

  pick() {
    const r = Math.random();
    const s = this.style;
    if (r < s.jab) return 'jab';
    if (r < s.jab + s.hook) return 'hook';
    return 'uppercut';
  }

  // returns { move, block, presses[] }
  update(dt) {
    const me = this.me;
    const opp = this.opp;
    this.t += dt;
    const out = { move: 0, block: false, presses: [] };
    if (me.state === 'down' || me.state === 'getup' || me.state === 'victory') return out;

    const gap = Math.abs(opp.x - me.x);
    const toward = Math.sign(opp.x - me.x) || 1;

    // ---- defence: see a punch coming, react after a delay ----
    if (opp.state === 'punch' && opp.move !== this.seenPunch) {
      this.seenPunch = opp.move;
      if (gap < opp.move.reach + 0.15 && Math.random() < this.lv.defend * (opp.move.sig ? 0.8 : 1)) {
        this.defendAt = this.t + this.lv.react * (0.8 + Math.random() * 0.4);
        this.defendKind = Math.random() < this.style.slipBias * 0.6 && me.stamina > 20 ? 'slip' : 'block';
      }
    }
    if (this.defendAt !== null && this.t >= this.defendAt) {
      if (this.defendKind === 'slip') out.presses.push('slip');
      else this.blockUntil = this.t + 0.45 + Math.random() * 0.4;
      this.defendAt = null;
    }
    // tired: cover up more
    if (me.stamina < 18 && opp.state === 'punch' && gap < 1.4 && Math.random() < 0.5 * dt * 10) {
      this.blockUntil = this.t + 0.5;
    }
    out.block = this.t < this.blockUntil;

    // ---- footwork ----
    const want = me.data.range + (me.stamina < 25 ? 0.5 : 0);
    this.driftT -= dt;
    if (this.driftT <= 0) {
      this.drift = (Math.random() - 0.5) * 0.3;
      this.driftT = 0.6 + Math.random() * 0.8;
    }
    const err = gap - (want + this.drift);
    if (Math.abs(err) > 0.08) out.move = Math.sign(err) * toward * Math.min(1, Math.abs(err) * 3);
    if (opp.state === 'stun' || opp.state === 'hit') out.move = gap > MOVES.hook.reach - 0.05 ? toward : 0;

    // ---- offence ----
    if (this.combo.length && me.canAct && !out.block) {
      out.presses.push(this.combo.shift());
      return out;
    }
    this.thinkT -= dt;
    if (this.thinkT > 0 || out.block) return out;
    const [a, b] = this.lv.think;
    this.thinkT = a + Math.random() * (b - a);
    if (me.stamina < 14) return out;

    if (me.sig >= 3 && gap < (me.data.id === 'dayo' ? 1.3 : 1.35) && Math.random() < 0.7) {
      out.presses.push('sig');
      return out;
    }
    const pressing = opp.state === 'stun' || opp.state === 'hit' || opp.tired;
    if (Math.random() > this.lv.aggro + (pressing ? 0.25 : 0)) return out;
    const kind = this.pick();
    if (gap > MOVES[kind].reach) {
      // out of range for that punch: step in and jab instead if it reaches
      if (gap <= MOVES.jab.reach) out.presses.push('jab');
      return out;
    }
    out.presses.push(kind === 'uppercut' ? 'upper' : kind);
    if (Math.random() < this.lv.combo) {
      const n = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < n; i++) {
        const k = this.pick();
        this.combo.push(k === 'uppercut' ? 'upper' : k);
      }
    }
    return out;
  }
}
