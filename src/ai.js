// CPU opponent. Produces the same intents a player would, with human-ish reaction times.

// parry: share of blocks that are timed into a parry. dash: chance to dash in to land a punch from range.
// react is a little quicker than before punches got faster, so defence keeps the same feel.
const LEVELS = {
  easy:   { react: 0.33, defend: 0.22, think: [0.7, 1.4], aggro: 0.45, combo: 0.15, parry: 0.04, dash: 0 },
  normal: { react: 0.2, defend: 0.45, think: [0.4, 0.95], aggro: 0.62, combo: 0.35, parry: 0.16, dash: 0.25 },
  hard:   { react: 0.13, defend: 0.68, think: [0.25, 0.6], aggro: 0.78, combo: 0.55, parry: 0.3, dash: 0.45 },
};

// jab/hook/upper: how often each punch is picked. slip/duck: how often a read punch is dodged
// rather than blocked. sig: when the signature gets used. body: how often a jab or hook goes to the body
// (more against a high guard or a tiring opponent).
const STYLE = {
  // swarmer: works inside, lots of jabs and hooks
  dayo: { jab: 0.42, hook: 0.3, upper: 0.18, slip: 0.33, duck: 0.2, sig: 'attack', body: 0.2 },
  // slugger: fewer, heavier shots
  bisi: { jab: 0.3, hook: 0.38, upper: 0.32, slip: 0.12, duck: 0.1, sig: 'attack', body: 0.3 },
  // out-boxer: pumps the jab from range and makes you miss
  emeka: { jab: 0.5, hook: 0.26, upper: 0.24, slip: 0.3, duck: 0.25, sig: 'dodge', body: 0.12 },
  // counter-puncher: waits for you, then makes you pay
  femi: { jab: 0.4, hook: 0.3, upper: 0.3, slip: 0.3, duck: 0.4, sig: 'parry', counter: 0.85, body: 0.15, parry: 1.6 },
  // tank: walks forward behind a high guard
  kola: { jab: 0.3, hook: 0.4, upper: 0.3, slip: 0.05, duck: 0.08, sig: 'buff', body: 0.35 },
  // champion: a bit of everything, keeps the finisher for the end
  chief: { jab: 0.4, hook: 0.32, upper: 0.28, slip: 0.25, duck: 0.25, sig: 'finish', body: 0.22 },
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
    this.pending = null; // a punch we've decided on and are stepping in to land
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

  // the press for a punch: jabs and hooks sometimes dig to the body, more so against a high guard
  press(kind) {
    if (kind === 'uppercut') return 'upper';
    const opp = this.opp;
    const want = (this.style.body ?? 0.2) * (opp.state === 'block' ? 2.2 : opp.stamina < 35 ? 1.5 : 1);
    return Math.random() < want ? (kind === 'jab' ? 'bodyjab' : 'bodyhook') : kind;
  }

  wantsSig(gap) {
    const { me, opp } = this;
    const close = gap < me.data.reach.jab - 0.05;
    switch (this.style.sig) {
      case 'attack': return close && Math.random() < 0.7;
      case 'buff': return gap < 1.6 && Math.random() < 0.6;
      case 'finish': return close && (opp.hp < 15 || (me.hp < 30 && Math.random() < 0.4));
      default: return false; // dodge and parry signatures fire from the defence above
    }
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
      const inReach = gap < (opp.data.reach[opp.move.kind] ?? 1.1) + 0.15;
      const s = this.style;
      if (inReach && me.sig >= 3 && (s.sig === 'parry' || s.sig === 'dodge') && Math.random() < this.lv.defend + 0.2) {
        // Hotfix and Express Lane are answers to a punch
        this.defendAt = this.t + this.lv.react * 0.6;
        this.defendKind = 'sig';
      } else if (inReach && Math.random() < this.lv.defend * (opp.move.sig ? 0.8 : 1)) {
        this.defendAt = this.t + this.lv.react * (0.8 + Math.random() * 0.4);
        const r = Math.random();
        // ducking under an uppercut is walking into it; ducking a body shot doesn't help
        const duckOk = opp.move.kind !== 'uppercut' && !opp.move.body;
        this.defendKind = me.stamina < 20 ? 'block' : r < s.slip ? 'slip' : r < s.slip + s.duck && duckOk ? 'duck' : 'block';
        // a read on the timing: start the block just before it lands, for a parry
        // gloves connect before the clip's hit frame, earlier the closer the fighters are
        const near = gap / (opp.data.reach[opp.move.kind] ?? 1.1);
        const toLand = opp.move.hitAt * (near > 0.85 ? 0.75 : 0.52) - opp.stateT;
        if (this.defendKind === 'block' && me.state !== 'block' && Math.random() < this.lv.parry * (s.parry ?? 1) && toLand > this.lv.react * 0.7) {
          this.defendKind = 'parry';
          this.defendAt = this.t + Math.max(this.lv.react * 0.7, toLand - 0.07);
        }
      }
    }
    if (this.defendAt !== null && this.t >= this.defendAt) {
      if (this.defendKind === 'parry') {
        this.blockUntil = this.t + 0.3;
      } else if (this.defendKind === 'slip' || this.defendKind === 'duck' || this.defendKind === 'sig') {
        out.presses.push(this.defendKind);
        // a counter-puncher fires straight back once the punch has gone by
        if (this.defendKind !== 'sig' && Math.random() < (this.style.counter ?? 0)) this.pending = { kind: Math.random() < 0.5 ? 'hook' : 'uppercut', until: this.t + 0.9 };
      } else this.blockUntil = this.t + 0.45 + Math.random() * 0.4;
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
    if (opp.state === 'stun' || opp.state === 'hit') out.move = gap > me.data.reach.hook - 0.08 ? toward : 0;

    // ---- offence ----
    // turned a punch away: make the free shot count
    if (me.countering && !this.pending && me.canAct) this.pending = { kind: Math.random() < 0.6 ? 'hook' : 'uppercut', until: me.counterUntil - me.time + this.t };
    if (this.pending) {
      if (this.t > this.pending.until || out.block) this.pending = null;
      else if (gap <= this.reach(this.pending.kind) - 0.04) {
        if (me.canAct) {
          out.presses.push(this.pending.press ?? this.press(this.pending.kind));
          this.pending = null;
        }
        return out;
      } else {
        out.move = toward; // step in to land it
        // a long way out: burst in
        if (!this.pending.dashed && gap > this.reach(this.pending.kind) + 0.35 && me.stamina > 40 && Math.random() < this.lv.dash) {
          out.presses.push(toward > 0 ? 'dashR' : 'dashL');
          this.pending.dashed = true;
        }
        return out;
      }
    }
    if (this.combo.length && me.canAct && !out.block) {
      out.presses.push(this.combo.shift());
      return out;
    }
    // hurt and trapped close in: dash out (not possible with the ropes at your back)
    if (me.hp < 35 && gap < 1.0 && !me.pinned && me.canAct && me.stamina > 30 && Math.random() < this.lv.dash * dt * 2) {
      out.presses.push(toward > 0 ? 'dashL' : 'dashR');
      return out;
    }
    this.thinkT -= dt;
    if (this.thinkT > 0 || out.block) return out;
    const [a, b] = this.lv.think;
    this.thinkT = a + Math.random() * (b - a);
    if (me.stamina < 14) return out;

    if (me.sig >= 3 && this.wantsSig(gap)) {
      out.presses.push('sig');
      return out;
    }
    const pressing = opp.state === 'stun' || opp.state === 'hit' || opp.tired;
    if (Math.random() > this.lv.aggro + (pressing ? 0.25 : 0)) return out;
    const kind = this.pick();
    const press = this.press(kind);
    const reach = this.reach(kind);
    if (gap > reach - 0.04) {
      // out of range for that punch: commit to stepping in and throwing it
      if (gap < reach + (this.lv.dash ? 1.2 : 0.6)) this.pending = { kind, press, until: this.t + 0.8 };
      return out;
    }
    out.presses.push(press);
    if (Math.random() < this.lv.combo) {
      const n = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < n; i++) this.combo.push(this.press(this.pick()));
    }
    return out;
  }

  // measured: body shots land from at least as far as the same punch to the head, so one table serves both
  reach(kind) {
    return this.me.data.reach[kind];
  }
}
