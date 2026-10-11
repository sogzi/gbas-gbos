// Synthesised sound: ring bell, punches, blocks and whooshes. No crowd yet.

let ctx = null;
let master = null;
let noiseBuf = null;

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
}

function env(g, t, a, peak, decay) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + decay);
}

function noise(t, dur, filterType, freq, q, peak, decay) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = filterType;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  env(g, t, 0.004, peak, decay);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.5, dur);
  return f;
}

function tone(t, type, f0, f1, peak, decay) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + decay);
  const g = ctx.createGain();
  env(g, t, 0.003, peak, decay);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + decay + 0.05);
}

export const sfx = {
  bell(times = 1) {
    if (!ctx) return;
    for (let k = 0; k < times; k++) {
      const t = ctx.currentTime + k * 0.32;
      // a struck boxing bell: inharmonic partials with a long ring
      [[880, 0.35], [1320 * 1.007, 0.18], [2210, 0.12], [3050, 0.06], [587, 0.1]].forEach(([f, a], i) => {
        tone(t, 'sine', f, 0, a * 0.55, 2.2 - i * 0.3);
      });
      noise(t, 0.05, 'highpass', 3000, 0.7, 0.25, 0.04);
    }
  },
  punch(power = 1) {
    if (!ctx) return;
    const t = ctx.currentTime;
    tone(t, 'sine', 140 + 40 * Math.random(), 45, 0.9 * Math.min(1.3, power), 0.16);
    noise(t, 0.12, 'lowpass', 900 + 500 * power, 0.8, 0.7 * Math.min(1.3, power), 0.09);
    noise(t, 0.03, 'highpass', 2500, 0.5, 0.18, 0.02);
  },
  block() {
    if (!ctx) return;
    const t = ctx.currentTime;
    noise(t, 0.08, 'bandpass', 700, 1.4, 0.45, 0.06);
    tone(t, 'triangle', 260, 160, 0.2, 0.07);
  },
  whoosh(speed = 1) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const f = noise(t, 0.2, 'bandpass', 600, 1.2, 0.09, 0.14 / speed);
    f.frequency.setValueAtTime(500, t);
    f.frequency.exponentialRampToValueAtTime(1800, t + 0.12 / speed);
  },
  fall() {
    if (!ctx) return;
    const t = ctx.currentTime;
    tone(t, 'sine', 90, 35, 1.0, 0.35);
    noise(t, 0.3, 'lowpass', 400, 0.7, 0.8, 0.25);
  },
  tick() {
    if (!ctx) return;
    tone(ctx.currentTime, 'square', 1100, 0, 0.08, 0.05);
  },
};
