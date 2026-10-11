// Story mode controller: route map, captioned scenes over the live fighters, chapter fights with their
// twists, and the chapter result. Everything a chapter changes goes through Match `rules`/`hooks` and a
// CPU tweak, so Quick Match never sees any of it.

import { CHAPTERS, EXTRA_FIGHTERS, BARKS, TUTORIAL } from './chapters.js';
import { save, askToPersist, isMemoryOnly, isInstalled } from './save.js';
import { FIGHTERS } from '../data.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// fighter data for a story id: Tunde is Dayo's body and moves under his own name and colours
export function storyFighter(id) {
  const extra = EXTRA_FIGHTERS[id];
  if (!extra) return { model: id, data: FIGHTERS[id] };
  const { base, colors, ...rest } = extra;
  const data = {
    ...FIGHTERS[base], ...rest, storyId: id,
    signature: { name: 'Double Levy', effect: FIGHTERS[base].signature.effect },
  };
  return { model: base, data, colors };
}

const who = (f) => f.data.storyId ?? f.data.id;
const nameOf = (f) => f.data.firstName.toUpperCase();

/**
 * @param g  what main.js lends the story: hud, isTouch, setupPair(a, b), startMatch(opts),
 *           setMode(m), setFocus(f), fighters (getter), match (getter), showModes()
 */
export function createStory(g) {
  let ch = null; // the chapter being played
  let active = false;
  let scene = null; // { panels, i, done }
  let fx = null; // per-fight UI state
  let resetArmed = false;

  // ---------- mode card and map ----------
  function progressText() {
    const next = save.next();
    const c = CHAPTERS.find((x) => x.n === next);
    const where = c ? `DISTRICT ${c.n} OF ${CHAPTERS.length} · ${c.district.toUpperCase()}` : 'STORY COMPLETE';
    const done = CHAPTERS.filter((x) => save.cleared(x.n)?.won).length;
    return { where, done, next };
  }

  function renderModeCard() {
    const { where, done } = progressText();
    $('mc-where').textContent = where;
    $('mc-rep').textContent = `${save.rep()} REP`;
    $('mc-bar').style.width = `${(100 * done) / CHAPTERS.length}%`;
    const chip = $('save-chip');
    const anything = Object.keys(save.get().cleared).length > 0;
    chip.classList.toggle('warn', isMemoryOnly());
    chip.querySelector('span').textContent = isMemoryOnly() ? 'Not saving on this browser' : anything ? 'Saved on this device' : 'Saves on this device';
  }

  function renderMap() {
    const next = save.next();
    const route = $('route');
    route.innerHTML = '';
    for (const c of CHAPTERS) {
      const open = save.unlocked(c.n);
      const cl = save.cleared(c.n);
      const won = !!cl?.won;
      const opp = storyFighter(c.opp);
      const b = document.createElement('button');
      b.className = 'stop' + (won ? ' done' : c.n === next ? ' next' : open ? '' : ' locked');
      b.disabled = !open;
      const badge = won ? (cl.best ?? 'CLEARED') : c.n === next ? 'NEXT' : open ? 'OPEN' : 'LOCKED';
      b.setAttribute('aria-label', `Chapter ${c.n}, ${c.district}, ${c.title}, against ${opp.data.firstName}. ${badge}`);
      b.innerHTML = `
        <div class="ph${opp.colors ? ' recolor' : ''}" style="background-image:url(/img/${opp.model}.jpg)">
          <span class="n">${c.n}</span>${cl?.bonus ? '<span class="star" title="Bonus goal met">★</span>' : ''}
          <span class="badge">${esc(badge)}</span>
        </div>
        <div class="dist">${esc(c.district.toUpperCase())}</div>
        <div class="ttl">${esc(c.title.toUpperCase())}</div>
        <div class="vs-l">vs ${open ? esc(`${opp.data.firstName} “${opp.data.nickname}”`) : '???'}</div>`;
      if (open) b.addEventListener('click', () => play(c.n));
      route.appendChild(b);
    }
    $('rep-n').textContent = save.rep();
    const [w, l] = save.record();
    $('rep-r').textContent = `${w}–${l}`;
    const c = CHAPTERS.find((x) => x.n === next);
    $('story-go').textContent = c ? (save.cleared(c.n) || c.n > 1 ? `CONTINUE · ${c.district.toUpperCase()}` : 'START') : 'REPLAY FINALE';
    const notes = [];
    const items = save.items();
    if (items.length) notes.push(`<div><b>COLLECTED</b> · ${items.map(esc).join(' · ')}</div>`);
    if (!next) notes.push(`<div>${esc(CHAPTERS[CHAPTERS.length - 1].end)}</div>`);
    if (isMemoryOnly()) notes.push('<div class="warn">This browser isn’t letting the game save (private browsing?). Progress lasts until you close the tab, so grab a SAVE CODE before you go.</div>');
    else if (isIOS() && !isInstalled()) notes.push('<div>On iPhone, add Gbas Gbos to your Home Screen (Share ▸ Add to Home Screen) so Safari keeps your progress.</div>');
    else notes.push('<div>Progress saves on this device after every fight. Use SAVE CODE to back it up or move it to another phone.</div>');
    $('story-note').innerHTML = notes.join('');
  }

  function showMap() {
    active = false;
    endFightUI();
    hideScene();
    $('chapter-end').classList.add('hidden');
    g.setMode('story');
    $('story').classList.remove('hidden');
    renderMap();
    askToPersist();
  }

  // ---------- scenes ----------
  function poseFor(side, clip) {
    const f = g.fighters[side === 'p1' ? 0 : 1];
    if (!f || !clip) return;
    if (clip === 'Idle') f.play('Idle', { loop: true, fade: 0.35 });
    else f.play(clip, { fade: 0.25 });
  }

  function placeForScene() {
    const [p1, p2] = g.fighters;
    p1.x = -1.0;
    p2.x = 1.0;
    for (const f of [p1, p2]) {
      f.vx = f.v = 0;
      f.root.position.x = f.x;
    }
  }

  function showPanel() {
    const p = scene.panels[scene.i];
    const panel = $('scene-panel');
    panel.className = 'scene-panel ' + (p.focus ?? 'both');
    // restart the slide-in
    void panel.offsetWidth;
    const cap = $('scene-cap');
    if (p.title) {
      cap.className = 'scene-cap title';
      cap.innerHTML = `<b>${esc(p.title)}</b>${esc(p.cap)}`;
    } else {
      cap.className = 'scene-cap' + (p.who ? '' : ' big');
      cap.textContent = p.cap ?? '';
    }
    $('scene-who').textContent = p.who ?? '';
    $('scene-line').textContent = p.line ?? '';
    g.setFocus(p.focus ?? 'both');
    if (p.pose) for (const side in p.pose) poseFor(side, p.pose[side]);
  }

  function runScene(panels, tag, done) {
    if (!panels.length) return done();
    scene = { panels, i: 0, done };
    g.setMode('scene');
    $('scene-tag').textContent = tag;
    $('scene').classList.remove('hidden');
    showPanel();
  }

  function advance() {
    if (!scene) return;
    scene.i++;
    if (scene.i >= scene.panels.length) skip();
    else showPanel();
  }

  function skip() {
    if (!scene) return;
    const { done } = scene;
    // the last panel's poses still hold, so skipping can't leave a fighter standing who should be down
    for (let i = scene.i + 1; i < scene.panels.length; i++) {
      const p = scene.panels[i];
      if (p.pose) for (const side in p.pose) poseFor(side, p.pose[side]);
    }
    hideScene();
    done();
  }

  function hideScene() {
    scene = null;
    $('scene').classList.add('hidden');
  }

  $('scene').addEventListener('click', (e) => {
    if (e.target.closest('#scene-skip')) return;
    advance();
  });
  $('scene-skip').addEventListener('click', (e) => {
    e.stopPropagation();
    skip();
  });
  window.addEventListener('keydown', (e) => {
    if (!scene || e.repeat) return;
    if (e.code === 'Escape') skip();
    else if (['Enter', 'Space', 'KeyJ', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
      advance();
    }
  });

  // ---------- a chapter ----------
  let playId = 0;
  async function play(n) {
    const id = ++playId;
    ch = CHAPTERS.find((c) => c.n === n);
    if (!ch || !save.unlocked(n)) return;
    active = true;
    $('story').classList.add('hidden');
    $('chapter-end').classList.add('hidden');
    $('scene-tag').textContent = 'LOADING…';
    $('scene-cap').className = 'scene-cap title';
    $('scene-cap').innerHTML = `<b>${esc(ch.title.toUpperCase())}</b>CHAPTER ${ch.n} · ${esc(ch.district.toUpperCase())}`;
    $('scene-who').textContent = $('scene-line').textContent = '';
    $('scene').classList.remove('hidden');
    const ok = await g.setupPair(storyFighter('dayo'), storyFighter(ch.opp));
    if (id !== playId) return;
    if (!ok) {
      $('scene-tag').textContent = 'COULD NOT LOAD THE FIGHTERS';
      setTimeout(showMap, 1500);
      return;
    }
    placeForScene();
    const tag = `CHAPTER ${ch.n} · ${ch.district.toUpperCase()}`;
    const title = { title: ch.title.toUpperCase(), cap: tag, focus: 'both' };
    // a retry goes straight to the face-off
    const panels = save.seen(ch.n) ? [title, ...ch.faceoff] : [title, ...ch.open, ...ch.faceoff];
    runScene(panels, tag, () => {
      save.markSeen(ch.n);
      fight();
    });
  }

  function fight() {
    const [p1, p2] = g.fighters;
    p1.reset(true);
    p2.reset(true);
    const tutorial = ch.tutorial && !save.cleared(ch.n)?.won;
    // in the first Oshodi fight Dayo can't be knocked out, so a beginner can only lose on the cards
    if (tutorial) p1.minHp = 1;
    fx = {
      t: 0, count: 0, lines: [], line: null, tipsDone: new Set(), tipShown: null,
      s: { p1Landed: 0, p1Crosses: 0, p1Blocked: 0, p1Ducks: 0, p1Sigs: 0, oppHook: false, oppStraight: false, p1SigReady: false },
      oppHookT: -9, oppStraightT: -9, duckEnd: -9, prevP1: 'idle', prevP2: 'idle', dodges: 0,
      coached: {}, absorbedT: -99, absorbedN: 0, pendingIron: false, tutorial,
    };
    $('hp1').parentElement.classList.toggle('quit', !!ch.quitLine);
    renderGoal();
    g.startMatch({ rules: ch.rules, level: ch.level, hooks: hooks(), cpuTweak, onEnd: finished });
    $('quit-btn').textContent = 'ROUTE MAP';
  }

  function cpuTweak(cpu) {
    if (!ch.cpu) return;
    const { defend, ...style } = ch.cpu;
    cpu.style = { ...cpu.style, ...style };
    if (defend) cpu.lv = { ...cpu.lv, defend: Math.min(0.9, cpu.lv.defend + defend) };
  }

  // a line in the corner of the screen: a bark from a fighter or a word from the corner
  function say(side, name, text, delay = 0, dur = 2.6) {
    fx.lines.push({ at: fx.t + delay, side, name, text, dur });
  }
  const bark = (f, kind, delay) => {
    const b = BARKS[who(f)]?.[kind];
    if (b) say(f === g.fighters[0] ? 'p1' : 'p2', nameOf(f), b, delay);
  };
  const coach = (key, text) => {
    if (fx.coached[key]) return;
    fx.coached[key] = true;
    say('coach', 'CORNER', text, 0.4, 3.6);
  };

  function hooks() {
    const [p1, p2] = g.fighters;
    const goal = ch.goal;
    return {
      land(a, d, m, hit, res) {
        if (a === p1) {
          fx.s.p1Landed++;
          if (m.kind === 'cross') fx.s.p1Crosses++;
          // hooks are the body punch (they land as HitBody), plus anything else that finds the torso
          if (goal?.kind === 'body' && m.react === 'HitBody') bump();
          if (goal?.kind === 'duckCounter' && (p1.state === 'duck' || fx.t - fx.duckEnd <= 1.0)) bump();
          if (res === 'absorbed' && ch.coach?.absorbed && fx.t - fx.absorbedT > 15 && fx.absorbedN++ < 3) {
            fx.absorbedT = fx.t;
            fx.coached.absorbed = false;
            coach('absorbed', ch.coach.absorbed);
          }
        }
      },
      blocked(a, d) {
        if (d === p1) fx.s.p1Blocked++;
      },
      parry(a, d) {
        if (a === p1 && d === p2) {
          if (goal?.kind === 'hotfixedMax') bump();
          if (ch.coach?.hotfix) coach('hotfix', ch.coach.hotfix);
        }
      },
      knockdown(d, a) {
        if (d === p2 && goal?.kind === 'knockdown') bump();
        if (d === p2 && ch.quickGetUp) {
          // Kola is up fast: he beats the count unless it's the third time down
          const m = g.match;
          m.getupAt = Math.min(m.getupAt, 3.5 + Math.random());
        }
        bark(a, 'scores', 0.2);
        bark(d, 'floored', 1.9);
      },
      sig(f, name) {
        if (f === p1) fx.s.p1Sigs++;
        bark(f, 'sig', 0);
        if (f === p2 && name === 'No Shaking' && ch.coach?.iron) coach('iron', ch.coach.iron);
      },
      round(r) {
        if (ch.ironEachRound) fx.pendingIron = true;
        if (ch.corner && r === ch.corner.round) say('coach', ch.corner.who, ch.corner.line, 0.3, 4.5);
      },
      tick: (dt) => tick(dt, p1, p2),
    };
  }

  function bump() {
    fx.count++;
    renderGoal();
  }

  function goalMet() {
    const goal = ch.goal;
    if (!goal) return false;
    return goal.kind === 'hotfixedMax' ? fx.count <= goal.target : fx.count >= goal.target;
  }

  function renderGoal() {
    const el = $('story-goal');
    const goal = ch.goal;
    if (!goal) return el.classList.add('hidden');
    el.classList.remove('hidden');
    el.textContent = goal.kind === 'hotfixedMax'
      ? `BONUS · ${goal.label} ${fx.count} (MAX ${goal.target})`
      : `BONUS · ${goal.label} ${Math.min(fx.count, goal.target)}/${goal.target}`;
    el.classList.toggle('met', goal.kind !== 'hotfixedMax' && goalMet());
  }

  function tick(dt, p1, p2) {
    const m = g.match;
    if (fx.over || !m) return; // the fight's over: Match finishes its frame after calling onEnd
    fx.t += dt;
    const fighting = m.phase === 'fight';

    // what the two fighters are doing, for the tutorial and the goals
    if (p2.state === 'punch' && p2.move) {
      if (p2.move.kind === 'hook') fx.oppHookT = fx.t;
      else if (p2.move.kind === 'jab' || p2.move.kind === 'cross') fx.oppStraightT = fx.t;
    }
    if (p1.state === 'duck' && fx.prevP1 !== 'duck') fx.s.p1Ducks++;
    if (p1.state !== 'duck' && fx.prevP1 === 'duck') fx.duckEnd = fx.t;
    if ((p2.state === 'slip' || p2.state === 'duck') && p2.state !== fx.prevP2 && p1.state === 'punch') {
      fx.dodges++;
      if (fx.dodges >= 3 && ch.coach?.slips) coach('slips', ch.coach.slips);
    }
    fx.prevP1 = p1.state;
    fx.prevP2 = p2.state;
    fx.s.oppHook = fx.t - fx.oppHookT < 1.2;
    fx.s.oppStraight = fx.t - fx.oppStraightT < 1.2;
    fx.s.p1SigReady = p1.sig >= 3;

    // chapter twists
    if (fighting && ch.sigRefill) p2.sig = Math.min(3, p2.sig + ch.sigRefill * dt);
    if (fx.pendingIron && fighting && p2.canAct) {
      fx.pendingIron = false;
      p2.sig = 3;
      const name = p2.signature();
      if (name) {
        m.hud.say(name.toUpperCase() + '!', nameOf(p2), 1000);
        m.hooks.sig?.(p2, name);
      }
    }

    // tips: the tutorial, then the warnings any chapter can raise
    let tip = null;
    let warn = false;
    if (fx.tutorial && fighting) {
      for (const t of TUTORIAL) if (!fx.tipsDone.has(t.key) && t.done(fx.s)) fx.tipsDone.add(t.key);
      // reactive tips (block, duck, signature) jump the queue while they apply
      const order = ['block', 'duck', 'sig', 'move', 'onetwo'];
      const next = order.map((k) => TUTORIAL.find((t) => t.key === k)).find((t) => !fx.tipsDone.has(t.key) && t.when(fx.s));
      if (next) tip = g.isTouch ? next.touch : next.keys;
    }
    if (fighting && ch.sigRefill && p2.isParrying) tip = 'PARRY UP! Wait for it to drop.';
    if (fighting && ch.quitLine && p2.sig >= 3 && p1.hp < 15) {
      tip = 'QUIT NOTICE ARMED! One more hit ends it.';
      warn = true;
    }
    const tipEl = $('story-tip');
    if (tip !== fx.tipShown) {
      fx.tipShown = tip;
      tipEl.classList.toggle('hidden', !tip);
      tipEl.classList.toggle('warn', warn);
      if (tip) tipEl.textContent = tip;
    }

    // lines: one at a time, in order
    if (fx.line && fx.t > fx.line.until) {
      fx.line = null;
      $('story-line').classList.add('hidden');
    }
    if (!fx.line && fx.lines.length && fx.t >= fx.lines[0].at) {
      const l = fx.lines.shift();
      fx.line = { until: fx.t + l.dur };
      const el = $('story-line');
      el.className = 'story-line ' + l.side;
      el.querySelector('b').textContent = l.name;
      el.querySelector('span').textContent = l.text;
    }
  }

  function endFightUI() {
    $('story-goal').classList.add('hidden');
    $('story-tip').classList.add('hidden');
    $('story-line').classList.add('hidden');
    $('hp1').parentElement.classList.remove('quit');
    $('quit-btn').textContent = 'MAIN MENU';
  }

  // ---------- after the fight ----------
  function finished(r) {
    const [p1, p2] = g.fighters;
    fx.over = true;
    const won = r.winner === p1;
    const bonus = won && goalMet();
    const earned = save.result(ch.n, { won, method: r.method, bonus });
    const stats = { landed: p1.stats.landed, combo: p1.stats.bestCombo };
    endFightUI();
    g.endMatch();
    p1.minHp = undefined;
    placeForScene();
    if (won) {
      // stand both up for the talk; the panels put anyone back down who should be
      poseFor('p1', 'Idle');
      poseFor('p2', 'Idle');
    }
    const tag = `CHAPTER ${ch.n} · ${ch.district.toUpperCase()}`;
    runScene(won ? ch.win : ch.loss, tag, () => showChapterEnd(r, won, bonus, earned, stats));
  }

  function showChapterEnd(r, won, bonus, earned, stats) {
    g.setMode('scene');
    g.setFocus('both');
    const how = r.method === 'DECISION'
      ? (r.winner ? `${won ? 'Won' : 'Lost'} on the judges’ cards (${r.kind.toLowerCase()})` : 'A draw on the cards, and a draw doesn’t clear the stop')
      : `${won ? 'Won' : 'Lost'} by ${r.method === 'TKO' ? 'T.K.O.' : 'K.O.'} in round ${r.round}`;
    $('ch-kicker').textContent = `CHAPTER ${ch.n} · ${ch.district.toUpperCase()}`;
    $('ch-title').textContent = won ? (ch.n === CHAPTERS.length ? 'LAST STOP' : 'STOP CLEARED') : 'NOT TODAY';
    const rows = [`<p>${esc(how)}. You landed ${stats.landed}, best combo ${stats.combo}.</p>`];
    if (won) {
      rows.push(earned.rep
        ? `<div class="reward"><span>Street Rep</span><b>+${earned.rep}</b></div>`
        : '<div class="reward dim"><span>Street Rep</span><span>already earned here</span></div>');
      if (ch.goal) {
        const label = ch.goal.kind === 'hotfixedMax' ? `${ch.goal.label} ${ch.goal.target} OR FEWER` : `${ch.goal.target} ${ch.goal.label}`;
        rows.push(bonus
          ? `<div class="reward"><span>★ Bonus: ${esc(label.toLowerCase())}</span><b>${earned.bonus ? `+${ch.goal.rep}` : 'done'}</b></div>`
          : `<div class="reward dim"><span>Bonus: ${esc(label.toLowerCase())}</span><span>missed (+${ch.goal.rep} on a replay)</span></div>`);
      }
      if (earned.item) rows.push(`<div class="reward"><span>Collected</span><b>${esc(earned.item)}</b></div>`);
      if (earned.unlock) {
        const u = FIGHTERS[earned.unlock];
        rows.push(`<div class="reward"><span>Unlocked</span><b>${esc(`${u.firstName} “${u.nickname}”`)}</b></div>`);
        rows.push('<p>All six fighters stay open in Quick Match for the demo.</p>');
      }
      if (ch.end) rows.push(`<p class="end">${esc(ch.end)}</p>`);
    } else {
      rows.push(`<p class="end">${esc(ch.retry)}</p>`);
    }
    $('ch-body').innerHTML = rows.join('');
    const last = ch.n === CHAPTERS.length;
    const nb = $('ch-next');
    nb.textContent = won ? (last ? 'FINISH' : 'NEXT STOP') : 'RETRY';
    nb.onclick = () => (won ? (last ? showMap() : play(ch.n + 1)) : play(ch.n));
    $('ch-map').classList.toggle('hidden', won && last);
    $('chapter-end').classList.remove('hidden');
  }

  $('ch-map').addEventListener('click', showMap);
  $('story-back').addEventListener('click', () => {
    $('story').classList.add('hidden');
    g.showModes();
  });
  $('story-go').addEventListener('click', () => play(save.next() ?? CHAPTERS.length));

  // ---------- save code ----------
  function openSave() {
    $('save-out').value = save.exportCode();
    $('save-in').value = '';
    $('save-msg').textContent = '';
    $('save-msg').className = 'save-msg';
    resetArmed = false;
    $('save-reset').textContent = 'RESET STORY';
    $('save-dialog').classList.remove('hidden');
  }
  const msg = (text, ok) => {
    $('save-msg').textContent = text;
    $('save-msg').className = 'save-msg ' + (ok ? 'ok' : 'bad');
  };
  $('story-save').addEventListener('click', openSave);
  $('save-close').addEventListener('click', () => {
    $('save-dialog').classList.add('hidden');
    renderMap();
  });
  $('save-copy').addEventListener('click', async () => {
    const code = $('save-out').value;
    try {
      await navigator.clipboard.writeText(code);
      msg('Copied. Keep it somewhere safe.', true);
    } catch {
      $('save-out').select();
      msg('Select the code above and copy it.', false);
    }
  });
  $('save-load').addEventListener('click', () => {
    const code = $('save-in').value.trim();
    if (!code) return msg('Paste a save code first.', false);
    if (save.importCode(code)) {
      msg('Loaded. Welcome back.', true);
      $('save-out').value = save.exportCode();
      renderMap();
      renderModeCard();
    } else msg('That code doesn’t look right. Check for a missing piece.', false);
  });
  $('save-reset').addEventListener('click', () => {
    if (!resetArmed) {
      resetArmed = true;
      $('save-reset').textContent = 'TAP AGAIN TO RESET';
      return msg('This wipes the story progress on this device.', false);
    }
    save.reset();
    resetArmed = false;
    $('save-reset').textContent = 'RESET STORY';
    $('save-out').value = save.exportCode();
    msg('Story reset.', true);
    renderMap();
    renderModeCard();
  });

  // left mid-fight from the pause menu
  function quit() {
    playId++;
    if (fx) fx.over = true;
    endFightUI();
    g.endMatch();
    showMap();
  }

  return {
    showMap, play, quit, skip, renderModeCard,
    get active() { return active; },
    get scene() { return scene && { i: scene.i, n: scene.panels.length, panel: scene.panels[scene.i] }; },
    get chapter() { return ch?.n ?? null; },
    get fx() { return fx; },
    save,
  };
}
