// Match flow: round intro, fighting, knockdowns and the count, rest between rounds, the decision.
import { RULES } from './data.js';
import { sfx } from './audio.js';

const NEUTRAL_X = 2.4; // how far the standing fighter backs off during a count

export class Match {
  constructor({ p1, p2, ref, cpu, input, hud, onEnd }) {
    Object.assign(this, { p1, p2, ref, cpu, input, hud, onEnd });
    this.shake = 0;
    this.paused = false;
    input.onAny = (k) => this._mash(k);
  }

  start() {
    this.round = 1;
    this.cards = []; // per round: { d1, d2, kd1, kd2 }
    this.wins = [0, 0];
    this.result = null;
    this.p1.reset(true);
    this.p2.reset(true);
    this.ref.reset();
    this.cpu.reset();
    this.hud.dots(1, 0);
    this.hud.dots(2, 0);
    this._enter('intro');
  }

  _enter(phase) {
    this.phase = phase;
    this.t = 0;
    this.step = 0;
    if (phase === 'intro') {
      this.clockLeft = RULES.roundSeconds;
      this.p1.reset(false);
      this.p2.reset(false);
      this.p1.roundDamage = this.p2.roundDamage = 0;
      this.p1.kdRound = this.p2.kdRound = 0;
      this.p1.x = -1.75;
      this.p2.x = 1.75;
      this.ref.target.set(0, 0, -0.5);
      this.ref.targetYaw = 0;
      this.ref.idle();
      this.input.clear();
      this.hud.clock(this.round, this.clockLeft);
      this.hud.flash(this.round === RULES.rounds ? 'FINAL ROUND' : `ROUND ${this.round}`,
        `${this.p1.data.firstName} vs ${this.p2.data.firstName}`.toUpperCase(), 1300);
    }
  }

  // ---------- combat resolution ----------
  resolve(a, d, m) {
    const gap = Math.abs(a.x - d.x);
    const isP1 = a === this.p1;
    if (gap > m.reach || d.state === 'down' || d.state === 'getup' || this.phase !== 'fight') {
      return;
    }
    if (d.isSlipping) {
      d.sig = Math.min(3, d.sig + 0.3);
      this.hud.say('SLIPPED!', '', 650);
      return;
    }
    if (d.isBlocking) {
      const dmg = m.dmg * a.powerMul * m.chip * m.blockMul * d.defMul;
      d.hp = Math.max(1, d.hp - dmg);
      d.stamina = Math.max(0, d.stamina - m.stam * 0.9);
      d.vx += -d.facing * 0.6;
      a.sig = Math.min(3, a.sig + 0.04);
      sfx.block();
      this.shake = Math.max(this.shake, 0.02);
      return;
    }
    const counter = d.state === 'punch';
    let dmg = m.dmg * a.powerMul * m.dmgMul * d.defMul * (counter ? 1.25 : 1);
    const now = a.time;
    a.combo = now - a.lastLanded < 1.1 ? a.combo + 1 : 1;
    a.lastLanded = now;
    d.combo = 0;
    a.stats.landed++;
    a.stats.bestCombo = Math.max(a.stats.bestCombo, a.combo);
    a.stats.damage += dmg;
    a.roundDamage += dmg;
    if (!m.sig) a.sig = Math.min(3, a.sig + 0.15);
    d.sig = Math.min(3, d.sig + 0.05);
    this.lastBlow = { by: a, sig: m.sig };
    const res = d.takeHit(m, dmg, a);
    sfx.punch(dmg / 6);
    this.shake = Math.max(this.shake, 0.03 + dmg * 0.006);

    if (m.sig && (a.queue.length === 3 || m.stun)) this.hud.say(m.sig.toUpperCase() + '!', a.data.firstName.toUpperCase(), 1200);
    else if (res === 'stun') this.hud.say('STUNNED!', '', 1200);
    else if (counter && dmg > 4) this.hud.say('COUNTER!', isP1 ? 'P1' : 'CPU', 700);
    else if (a.combo >= 3) this.hud.say(`${a.combo} HIT COMBO`, isP1 ? 'P1' : 'CPU', 900);

    if (res === 'down') this._knockdown(d, a);
  }

  _knockdown(d, a) {
    d.knockDown();
    d.kdRound++;
    a.stats.knockdownsScored++;
    this.downed = d;
    this.standing = a;
    // later knockdowns are harder to beat; the count target is where the fighter rises
    this.getupAt = Math.min(10.5, 3.5 + d.knockdowns * 2.2 + Math.random() * 2.2 + (d.data.stats.stamina < 6 ? 1 : 0));
    this.mashed = 0;
    this.countN = 0;
    this.hud.say('KNOCKDOWN!', '', 1300);
    this._enter('down');
  }

  _mash(k) {
    if (this.phase === 'down' && this.downed === this.p1 && !['left', 'right', 'block'].includes(k)) {
      this.mashed++;
      this.getupAt = Math.max(3.2, this.getupAt - 0.22);
    }
  }

  // ---------- per frame ----------
  update(dt) {
    if (this.paused) return;
    this._dt = dt;
    this.t += dt;
    const { p1, p2, ref, hud } = this;

    // player intents
    const presses = this.input.take();
    const cpuOut = this.cpu.update(dt);
    const auto = this.autoP1?.update(dt);
    if (this.phase === 'fight') {
      if (auto) this._drive(p1, auto.move, auto.block, auto.presses);
      else this._drive(p1, this.input.move, this.input.held.block, presses);
      this._drive(p2, cpuOut.move, cpuOut.block, cpuOut.presses);
    } else {
      p1.moveIntent = p2.moveIntent = 0;
    }

    p1.update(dt, p2, this);
    p2.update(dt, p1, this);
    this._separate();
    ref.update(dt);

    switch (this.phase) {
      case 'intro':
        if (this.step === 0 && this.t > 1.4) {
          this.step = 1;
          ref.signalFight();
        }
        if (this.step === 1 && this.t > 2.2) {
          this.step = 2;
          sfx.bell(1);
          hud.flash('FIGHT!', '', 700);
          ref.target.set(0, 0, -1.6);
          this._enter('fight');
        }
        break;
      case 'fight': {
        this.clockLeft -= dt;
        hud.clock(this.round, this.clockLeft);
        // referee hovers behind the action
        ref.target.set((p1.x + p2.x) / 2 * 0.8, 0, -1.55);
        ref.targetYaw = 0;
        if (this.clockLeft <= 0) this._endRound();
        break;
      }
      case 'down':
        this._updateCount(dt);
        break;
      case 'resume':
        if (this.t > 1.2) {
          hud.count(null);
          hud.say('FIGHT ON!', '', 700);
          ref.signalFight();
          this._enter('fight');
        }
        break;
      case 'roundEnd':
        if (this.step === 0) {
          this.step = 1;
          sfx.bell(2);
          for (const f of [p1, p2]) if (f.state !== 'down') f.toIdle(0.2);
          hud.flash(`END OF ROUND ${this.round}`, '', 1800);
          ref.target.set(0, 0, -0.4);
        }
        if (this.t > 2.4) {
          if (this.round >= RULES.rounds) this._decision();
          else {
            this.round++;
            p1.hp = Math.min(100, p1.hp + 12);
            p2.hp = Math.min(100, p2.hp + 12);
            const h1 = p1.hp, h2 = p2.hp;
            this._enter('intro');
            p1.hp = p1.shownHp = h1;
            p2.hp = p2.shownHp = h2;
          }
        }
        break;
      case 'end':
        if (this.step === 0 && this.t > 1.0) {
          this.step = 1;
          this.result.winner?.win();
          if (this.result.winner) {
            ref.target.set(this.result.winner.x * 0.35, 0, -0.35);
            ref.targetYaw = 0;
            ref.raise(this.result.winner.side);
          }
        }
        if (this.step === 1 && this.t > 3.6) {
          this.step = 2;
          this.onEnd(this.result);
        }
        break;
      default:
        break;
    }

    hud.side(1, p1);
    hud.side(2, p2);
    this.shake *= Math.exp(-dt * 10);
  }

  _drive(f, move, block, presses) {
    f.moveIntent = move;
    if (block && !f.blockHeld) f.startBlock();
    else if (!block && f.blockHeld) f.endBlock();
    else if (block && f.state === 'idle') f.startBlock();
    for (const p of presses) {
      if (p === 'jab') f.punch('jab');
      else if (p === 'hook') f.punch('hook');
      else if (p === 'upper') f.punch('uppercut');
      else if (p === 'slip') f.slip();
      else if (p === 'sig') {
        if (!f.signature()) f.punch('jab');
      }
    }
  }

  _separate() {
    const { p1, p2 } = this;
    for (const f of [p1, p2]) f.clamp();
    const down = p1.state === 'down' || p2.state === 'down' || p1.state === 'getup' || p2.state === 'getup';
    if (down) return;
    const gap = p2.x - p1.x;
    if (gap < RULES.minGap) {
      const push = (RULES.minGap - gap) / 2;
      p1.x -= push;
      p2.x += push;
      for (const f of [p1, p2]) f.clamp();
      if (p2.x - p1.x < RULES.minGap) {
        // pinned on the ropes: move the free fighter instead
        if (p1.x <= -RULES.ringHalf + 0.01) p2.x = p1.x + RULES.minGap;
        else p1.x = p2.x - RULES.minGap;
      }
    }
    p1.root.position.x = p1.x;
    p2.root.position.x = p2.x;
  }

  _updateCount() {
    const { downed, standing, ref, hud } = this;
    // the standing fighter goes to a neutral corner, the referee to the downed fighter
    const away = Math.sign(standing.x - downed.x) || 1;
    standing.moveIntent = 0;
    const corner = Math.max(-RULES.ringHalf, Math.min(RULES.ringHalf, downed.x + away * NEUTRAL_X));
    standing.x += (corner - standing.x) * Math.min(1, 2.5 * this._dt);
    ref.target.set(downed.x + away * 0.35, 0, -1.05);
    ref.targetYaw = -away * Math.PI / 2 * 0.6;

    // three knockdowns end it on the spot
    if (downed.knockdowns >= RULES.knockdownsForKO) {
      if (this.t > 2.0) this._finish(standing, 'TKO');
      return;
    }
    const n = Math.floor((this.t - 0.9) / 1.0) + 1;
    if (this.t > 0.9 && n > this.countN && n <= 10) {
      this.countN = n;
      ref.countOnce();
      sfx.tick();
      hud.count(n, downed === this.p1 ? 'MASH ANY PUNCH TO GET UP' : '');
      if (n >= 10) {
        this._finish(standing, 'KO');
        return;
      }
      if (n >= Math.floor(this.getupAt) && this.getupAt < 10) {
        downed.getUp();
        this._enter('resume');
        ref.target.set((this.p1.x + this.p2.x) / 2, 0, -1.4);
        ref.targetYaw = 0;
        hud.count(n, 'UP AT ' + n);
      }
    }
  }

  _endRound() {
    const { p1, p2 } = this;
    this.cards.push({ d1: p1.roundDamage, d2: p2.roundDamage, kd1: p1.kdRound, kd2: p2.kdRound });
    this._enter('roundEnd');
  }

  _decision() {
    // three judges score each round 10-9 on damage dealt, a point off for each knockdown suffered
    const judges = [0, 1, 2].map(() => {
      let s1 = 0, s2 = 0;
      for (const c of this.cards) {
        const a = c.d1 * (1 + (Math.random() - 0.5) * 0.3);
        const b = c.d2 * (1 + (Math.random() - 0.5) * 0.3);
        let r1 = 10, r2 = 10;
        if (Math.abs(a - b) > 1.5) (a > b ? (r2 = 9) : (r1 = 9));
        r1 -= c.kd1;
        r2 -= c.kd2;
        s1 += r1;
        s2 += r2;
      }
      return [s1, s2];
    });
    const w1 = judges.filter(([a, b]) => a > b).length;
    const w2 = judges.filter(([a, b]) => b > a).length;
    let winner = null;
    let kind = 'DRAW';
    if (w1 > w2) winner = this.p1;
    if (w2 > w1) winner = this.p2;
    if (winner) {
      const n = Math.max(w1, w2);
      kind = n === 3 ? 'UNANIMOUS DECISION' : judges.some(([a, b]) => a === b) ? 'MAJORITY DECISION' : 'SPLIT DECISION';
    }
    this.result = { winner, loser: winner ? (winner === this.p1 ? this.p2 : this.p1) : null, method: 'DECISION', kind, judges, round: this.round, clock: 0 };
    this._enter('end');
  }

  _finish(winner, method) {
    this.cards.push({ d1: this.p1.roundDamage, d2: this.p2.roundDamage, kd1: this.p1.kdRound, kd2: this.p2.kdRound });
    const loser = winner === this.p1 ? this.p2 : this.p1;
    this.hud.count(null);
    sfx.bell(3);
    this.hud.flash(method === 'TKO' ? 'T.K.O.!' : 'K.O.!', `${winner.data.firstName} wins`.toUpperCase(), 2200);
    this.result = {
      winner, loser, method, kind: method === 'TKO' ? 'THREE KNOCKDOWNS' : 'COUNTED OUT',
      round: this.round, clock: RULES.roundSeconds - Math.max(0, this.clockLeft), lastSig: this.lastBlow?.by === winner ? this.lastBlow.sig : null,
    };
    this._enter('end');
  }
}
