// Keyboard and touch input, turned into the same set of fight intents.
//   intents: left/right held, block held, and one-shot presses jab / hook / upper / slip / duck / sig

const SIG_WINDOW = 0.09; // seconds to wait for the second key of J + L

export class Input {
  constructor() {
    this.held = { left: false, right: false, block: false };
    this.presses = [];
    this.pendingJab = null;
    this.pendingUpper = null;
    this.onAny = null; // called for every press (used for mash-to-get-up and pause)
    this.onPause = null;
    this._bindKeys();
    this._bindTouch();
  }

  _now() {
    return performance.now() / 1000;
  }

  _press(k) {
    const t = this._now();
    // J + L together fire the signature; hold back a lone J or L for a few frames to see if the other comes
    if (k === 'jab' || k === 'upper') {
      const other = k === 'jab' ? 'pendingUpper' : 'pendingJab';
      if (this[other] !== null && t - this[other] < SIG_WINDOW) {
        this[other] = null;
        this.presses.push('sig');
      } else {
        this[k === 'jab' ? 'pendingJab' : 'pendingUpper'] = t;
      }
    } else {
      this.presses.push(k);
    }
    this.onAny?.(k);
  }

  // called each frame; returns the one-shot presses ready this frame
  take() {
    const t = this._now();
    if (this.pendingJab !== null && t - this.pendingJab >= SIG_WINDOW) {
      this.presses.push('jab');
      this.pendingJab = null;
    }
    if (this.pendingUpper !== null && t - this.pendingUpper >= SIG_WINDOW) {
      this.presses.push('upper');
      this.pendingUpper = null;
    }
    const out = this.presses;
    this.presses = [];
    return out;
  }

  clear() {
    this.presses = [];
    this.pendingJab = this.pendingUpper = null;
  }

  get move() {
    return (this.held.right ? 1 : 0) - (this.held.left ? 1 : 0);
  }

  _bindKeys() {
    const map = {
      KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
      Space: 'block', KeyJ: 'jab', KeyK: 'hook', KeyL: 'upper', ShiftLeft: 'slip', ShiftRight: 'slip',
      KeyS: 'duck', ArrowDown: 'duck',
    };
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        this.onPause?.();
        return;
      }
      const k = map[e.code];
      if (!k) return;
      e.preventDefault();
      if (k in this.held) {
        if (!this.held[k]) this.onAny?.(k);
        this.held[k] = true;
      } else if (!e.repeat) {
        this._press(k);
      }
    });
    window.addEventListener('keyup', (e) => {
      const k = map[e.code];
      if (k && k in this.held) this.held[k] = false;
    });
    window.addEventListener('blur', () => {
      for (const k in this.held) this.held[k] = false;
    });
  }

  _bindTouch() {
    const root = document.getElementById('touch');
    const active = new Map(); // pointerId -> key
    const down = (e) => {
      const b = e.target.closest('[data-k]');
      if (!b) return;
      e.preventDefault();
      b.setPointerCapture?.(e.pointerId);
      const k = b.dataset.k;
      active.set(e.pointerId, { k, b });
      b.classList.add('down');
      if (navigator.vibrate) navigator.vibrate(8);
      if (k in this.held) {
        this.held[k] = true;
        this.onAny?.(k);
      } else {
        this._press(k);
      }
    };
    const up = (e) => {
      const a = active.get(e.pointerId);
      if (!a) return;
      active.delete(e.pointerId);
      a.b.classList.remove('down');
      if (a.k in this.held) {
        // another finger may still hold the same key
        const still = [...active.values()].some((v) => v.k === a.k);
        if (!still) this.held[a.k] = false;
      }
    };
    root.addEventListener('pointerdown', down);
    root.addEventListener('pointerup', up);
    root.addEventListener('pointercancel', up);
    root.addEventListener('contextmenu', (e) => e.preventDefault());
    // iOS Safari ignores user-scalable=no: stop its double-tap and pinch zoom, which
    // otherwise kick in when you hammer the punch buttons and push the HUD off screen
    root.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    let lastEnd = 0;
    document.addEventListener('touchend', (e) => {
      const now = performance.now();
      if (now - lastEnd < 350 && document.body.classList.contains('fighting')) e.preventDefault();
      lastEnd = now;
    }, { passive: false });
    document.addEventListener('touchmove', (e) => {
      if (e.touches.length > 1 || document.body.classList.contains('fighting')) e.preventDefault();
    }, { passive: false });
    for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) {
      document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
    }
    document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
  }
}
