const EPS = 0.0001;

function envelope(g, t, dur, attack, release, peak) {
  const a = Math.min(Math.max(attack, 0.002), dur * 0.5);
  const p = Math.max(peak, EPS);
  g.gain.value = EPS;
  g.gain.setValueAtTime(EPS, t);
  g.gain.exponentialRampToValueAtTime(p, t + a);
  g.gain.setValueAtTime(p, Math.max(t + a, t + dur - release));
  g.gain.exponentialRampToValueAtTime(EPS, t + dur);
}

function shape(ac, t, dur, f) {
  const n = ac.createBiquadFilter();
  n.type = f.type || 'lowpass';
  n.Q.value = f.q ?? 1;
  if (f.curve) {
    n.frequency.setValueCurveAtTime(f.curve, t, f.glide ?? dur);
    return n;
  }
  n.frequency.setValueAtTime(f.from, t);
  if (f.to) n.frequency.exponentialRampToValueAtTime(f.to, t + (f.glide ?? dur));
  return n;
}

const drives = new Map();
function drive(k) {
  let c = drives.get(k);
  if (c) return c;
  c = new Float32Array(256);
  for (let i = 0; i < 256; i++) c[i] = Math.tanh((k * (i - 127.5)) / 127.5) / Math.tanh(k);
  drives.set(k, c);
  return c;
}

export function tone(a, o) {
  const { ac, out } = a;
  const t = ac.currentTime + (o.at || 0);
  const dur = o.dur ?? 0.3;
  const osc = ac.createOscillator();
  osc.type = o.type || 'sine';
  if (o.curve) osc.frequency.setValueCurveAtTime(o.curve, t, dur);
  else {
    osc.frequency.setValueAtTime(o.from, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide ?? dur));
  }
  if (o.detune) osc.detune.value = o.detune;
  if (o.vibrato) {
    const lfo = ac.createOscillator();
    lfo.frequency.value = o.vibrato.rate;
    const depth = ac.createGain();
    depth.gain.value = o.vibrato.cents;
    lfo.connect(depth).connect(osc.detune);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
  }
  let node = osc;
  if (o.drive) {
    const ws = ac.createWaveShaper();
    ws.curve = drive(o.drive);
    node = node.connect(ws);
  }
  if (o.filter) node = node.connect(shape(ac, t, dur, o.filter));
  const g = ac.createGain();
  envelope(g, t, dur, o.attack ?? 0.01, o.release ?? dur * 0.5, o.gain ?? 0.3);
  node.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

let noiseBuf = null;
function noiseBuffer(ac) {
  if (noiseBuf && noiseBuf.sampleRate === ac.sampleRate) return noiseBuf;
  const n = ac.sampleRate * 2;
  noiseBuf = ac.createBuffer(1, n, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

export function noise(a, o) {
  const { ac, out } = a;
  const t = ac.currentTime + (o.at || 0);
  const dur = o.dur ?? 0.3;
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac);
  src.loop = true;
  let node = src;
  if (o.filter) node = node.connect(shape(ac, t, dur, o.filter));
  const g = ac.createGain();
  envelope(g, t, dur, o.attack ?? 0.005, o.release ?? dur * 0.6, o.gain ?? 0.3);
  node.connect(g).connect(out);
  src.start(t, Math.random());
  src.stop(t + dur + 0.05);
}

export function boom(a, at = 0, k = 1) {
  noise(a, { at, dur: 0.6, gain: 0.3 * k, attack: 0.003, release: 0.5, filter: { type: 'lowpass', from: 3500, to: 60, q: 0.7 } });
  tone(a, { at, type: 'sine', from: 170, to: 32, glide: 0.45, dur: 0.6, gain: 0.45 * k, attack: 0.003, release: 0.45 });
  noise(a, { at, dur: 0.03, gain: 0.18 * k, filter: { type: 'highpass', from: 2000 } });
}

export function hit(a, at = 0, gain = 0.5) {
  noise(a, { at, dur: 0.12, gain: gain * 0.8, attack: 0.002, release: 0.1, filter: { type: 'lowpass', from: 900, to: 150 } });
  tone(a, { at, type: 'sine', from: 140, to: 45, glide: 0.12, dur: 0.2, gain, attack: 0.002, release: 0.15 });
}

export function pop(a, at = 0, gain = 0.6) {
  noise(a, { at, dur: 0.07, gain, attack: 0.002, release: 0.05, filter: { type: 'lowpass', from: 4000, to: 500 } });
  tone(a, { at, type: 'sine', from: 600, to: 150, glide: 0.06, dur: 0.08, gain: 0.5, attack: 0.002 });
}

export function whoosh(a, at = 0, dur = 0.4) {
  noise(a, { at, dur, gain: 0.55, attack: dur * 0.3, release: dur * 0.4, filter: { type: 'bandpass', from: 350, to: 3500, q: 1.2 } });
}

export function sparkle(a, at = 0, n = 7, gain = 0.14) {
  for (let i = 0; i < n; i++) {
    const f = 1200 * Math.pow(2, Math.random() * 1.6);
    tone(a, { at: at + i * 0.055 + Math.random() * 0.02, type: 'triangle', from: f, to: f * 1.5, dur: 0.16, gain, attack: 0.004, release: 0.1 });
  }
}

export function chime(a, at = 0) {
  [[1046.5, 0], [1318.5, 0.12], [1568, 0.24]].forEach(([f, s]) => tone(a, { at: at + s, type: 'sine', from: f, dur: 0.9, gain: 0.12, attack: 0.01, release: 0.7 }));
  sparkle(a, at + 0.1, 5, 0.07);
}

export function tada(a, at = 0) {
  pop(a, at);
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(a, {
    at: at + 0.05 + i * 0.09, type: 'square', from: f, dur: 0.9 - i * 0.1, gain: 0.13, attack: 0.01, release: 0.5,
    filter: { type: 'lowpass', from: 2600, q: 0.8 },
  }));
  tone(a, { at: at + 0.42, type: 'triangle', from: 2093, dur: 0.6, gain: 0.08, attack: 0.02, release: 0.5 });
}

export function fireworks(a, at = 0) {
  tone(a, { at, type: 'sine', from: 450, to: 1900, glide: 0.7, dur: 0.72, gain: 0.12, attack: 0.05, release: 0.2, vibrato: { rate: 30, cents: 40 } });
  boom(a, at + 0.75, 0.55);
  for (let i = 0; i < 16; i++) {
    noise(a, { at: at + 0.8 + Math.random() * 1.1, dur: 0.03, gain: 0.3, attack: 0.002, release: 0.02, filter: { type: 'highpass', from: 1800 + Math.random() * 2000 } });
  }
  sparkle(a, at + 0.85, 6, 0.08);
}

export function cash(a, at = 0) {
  noise(a, { at, dur: 0.04, gain: 0.35, filter: { type: 'highpass', from: 3500 } });
  for (const [f, s] of [[2637, 0], [3136, 0.085]]) {
    tone(a, { at: at + s, type: 'sine', from: f, dur: 0.35, gain: 0.25, attack: 0.002, release: 0.3 });
    tone(a, { at: at + s, type: 'triangle', from: f * 1.98, dur: 0.25, gain: 0.08, attack: 0.002, release: 0.2 });
  }
  tone(a, { at: at + 0.17, type: 'sine', from: 4186, dur: 0.9, gain: 0.1, attack: 0.002, release: 0.8 });
}

export function zap(a, at = 0, gain = 0.3) {
  tone(a, { at, type: 'sawtooth', from: 2200, to: 180, glide: 0.14, dur: 0.17, gain, attack: 0.003, release: 0.08, filter: { type: 'lowpass', from: 4000, to: 800 } });
  noise(a, { at, dur: 0.05, gain: gain * 0.5, filter: { type: 'highpass', from: 3000 } });
}

export function hum(a, at = 0, dur = 1.6, f = 110) {
  tone(a, { at, type: 'sawtooth', from: f, dur, gain: 0.12, attack: 0.1, release: 0.6, filter: { type: 'lowpass', from: 500, q: 3 }, vibrato: { rate: 7, cents: 30 } });
  tone(a, { at, type: 'sine', from: f * 8, dur, gain: 0.05, attack: 0.1, release: 0.6, vibrato: { rate: 11, cents: 60 } });
}

export function boing(a, at = 0) {
  const n = 64, curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1);
    curve[i] = 260 * (1 + 0.9 * Math.exp(-3.5 * x) * Math.sin(x * Math.PI * 14)) + 160 * x;
  }
  tone(a, { at, type: 'triangle', curve, dur: 0.7, gain: 0.3, attack: 0.005, release: 0.4, filter: { type: 'lowpass', from: 2500, q: 1 } });
}

export function laugh(a, at = 0) {
  [430, 405, 380, 355, 335].forEach((f, i) => {
    const s = at + i * 0.16;
    noise(a, { at: s, dur: 0.07, gain: 0.22, attack: 0.01, release: 0.04, filter: { type: 'bandpass', from: 1500, q: 1.5 } });
    tone(a, { at: s + 0.02, type: 'square', from: f * 1.06, to: f, glide: 0.1, dur: 0.12, gain: 0.1, attack: 0.01, release: 0.06, filter: { type: 'lowpass', from: 1400, q: 2 } });
  });
}

export function sadTrombone(a, at = 0) {
  for (const [f, s, d] of [[369.99, 0, 0.34], [349.23, 0.4, 0.34], [329.63, 0.8, 0.34]]) {
    tone(a, { at: at + s, type: 'sawtooth', from: f, dur: d, gain: 0.3, attack: 0.03, release: 0.12, filter: { type: 'lowpass', from: 450, to: 1500, glide: d * 0.6, q: 2.5 } });
  }
  tone(a, {
    at: at + 1.2, type: 'sawtooth', from: 311.13, to: 277.18, glide: 1.0, dur: 1.25, gain: 0.3, attack: 0.03, release: 0.6,
    vibrato: { rate: 5.5, cents: 35 }, filter: { type: 'lowpass', from: 450, to: 1400, glide: 0.6, q: 2.5 },
  });
}

export function dunDunDun(a, at = 0) {
  for (const [f, s, d] of [[98, 0, 0.3], [98, 0.38, 0.3], [82.41, 0.76, 1.4]]) {
    hit(a, at + s, 0.55);
    tone(a, { at: at + s, type: 'sawtooth', from: f, dur: d, gain: 0.33, attack: 0.02, release: d * 0.5, filter: { type: 'lowpass', from: 700, q: 1.2 } });
    tone(a, { at: at + s, type: 'square', from: f / 2, dur: d, gain: 0.12, attack: 0.02, release: d * 0.5, filter: { type: 'lowpass', from: 300 } });
  }
}

export function riff(a, at = 0) {
  hit(a, at, 0.35);
  [[164.81, 0], [196, 0.13], [246.94, 0.26]].forEach(([f, s], i) => tone(a, {
    at: at + s, type: 'sawtooth', from: f, dur: i === 2 ? 0.7 : 0.3, gain: 0.22, attack: 0.005, release: 0.2, drive: 4,
    filter: { type: 'lowpass', from: 2200, q: 1 },
  }));
}

export function wasted(a, at = 0) {
  hit(a, at, 0.5);
  noise(a, { at, dur: 0.7, gain: 0.4, attack: 0.003, release: 0.6, filter: { type: 'lowpass', from: 1500, to: 50 } });
  tone(a, { at: at + 0.05, type: 'sawtooth', from: 220, to: 110, glide: 0.9, dur: 1.0, gain: 0.14, attack: 0.05, release: 0.5, filter: { type: 'lowpass', from: 900, to: 200 } });
  tone(a, { at: at + 0.1, type: 'square', from: 55, dur: 1.9, gain: 0.2, attack: 0.1, release: 1.2, filter: { type: 'lowpass', from: 180 } });
}

export function powerUp(a, at = 0, dur = 1.8) {
  for (const detune of [-9, 9]) {
    tone(a, {
      at, type: 'sawtooth', from: 110, to: 440, glide: dur * 0.7, dur, gain: 0.14, attack: dur * 0.35, release: dur * 0.35, detune,
      filter: { type: 'lowpass', from: 300, to: 3500, glide: dur * 0.7, q: 1.5 },
    });
  }
  tone(a, { at: at + dur * 0.3, type: 'sine', from: 880, to: 1760, glide: dur * 0.5, dur: dur * 0.7, gain: 0.07, attack: 0.2, release: 0.4, vibrato: { rate: 6, cents: 30 } });
}

export function buzzer(a, at = 0) {
  for (const f of [140, 146]) {
    tone(a, { at, type: 'square', from: f, dur: 0.6, gain: 0.16, attack: 0.01, release: 0.15, filter: { type: 'lowpass', from: 700, q: 1 } });
  }
  tone(a, { at, type: 'sawtooth', from: 70, dur: 0.6, gain: 0.12, attack: 0.01, release: 0.15, filter: { type: 'lowpass', from: 300 } });
}

export function ding(a, at = 0) {
  tone(a, { at, type: 'sine', from: 880, dur: 0.5, gain: 0.25, attack: 0.003, release: 0.4 });
  tone(a, { at: at + 0.12, type: 'sine', from: 1318.5, dur: 0.7, gain: 0.22, attack: 0.003, release: 0.6 });
  tone(a, { at: at + 0.12, type: 'triangle', from: 2637, dur: 0.8, gain: 0.07, attack: 0.003, release: 0.7 });
}

export function cymbal(a, at = 0) {
  hit(a, at, 0.3);
  noise(a, { at, dur: 1.5, gain: 0.28, attack: 0.002, release: 1.4, filter: { type: 'highpass', from: 5000 } });
  noise(a, { at, dur: 1.0, gain: 0.12, attack: 0.002, release: 0.9, filter: { type: 'bandpass', from: 8000, q: 2 } });
}

export function drumroll(a, at = 0, dur = 1.6) {
  let t = 0;
  while (t < dur) {
    const p = t / dur;
    noise(a, { at: at + t, dur: 0.05, gain: 0.22 + 0.1 * p, attack: 0.002, release: 0.04, filter: { type: 'lowpass', from: 1200, to: 300 } });
    tone(a, { at: at + t, type: 'sine', from: 180, to: 90, glide: 0.05, dur: 0.06, gain: 0.22, attack: 0.002, release: 0.04 });
    t += 0.095 - 0.05 * p;
  }
}

export function crickets(a, at = 0, dur = 3) {
  for (let s = 0; s < dur; s += 0.55 + Math.random() * 0.15) {
    const f = 4200 + Math.random() * 300;
    for (let i = 0; i < 3; i++) {
      tone(a, { at: at + s + i * 0.045, type: 'sine', from: f, dur: 0.03, gain: 0.22, attack: 0.005, release: 0.015 });
    }
  }
}

export function applause(a, at = 0, dur = 2.6) {
  noise(a, { at, dur, gain: 0.07, attack: 0.3, release: 0.8, filter: { type: 'lowpass', from: 500 } });
  for (let i = 0; i < 110; i++) {
    const s = Math.random() * dur;
    const w = Math.sin((s / dur) * Math.PI);
    noise(a, { at: at + s, dur: 0.02 + Math.random() * 0.02, gain: 0.08 + 0.16 * w, attack: 0.002, release: 0.015, filter: { type: 'bandpass', from: 1500 + Math.random() * 2000, q: 1.5 } });
  }
}

export function sting(a, at = 0, cut = 0.22, up = true) {
  noise(a, { at, dur: cut + 0.06, gain: 0.42, attack: up ? cut * 0.9 : 0.01, release: up ? 0.05 : cut, filter: { type: 'bandpass', from: up ? 300 : 4500, to: up ? 4500 : 300, q: 1.3 } });
  const s = at + cut;
  hit(a, s, 0.42);
  const root = up ? 293.66 : 329.63;
  [1, 1.26, 1.5, 2].forEach((k) => tone(a, {
    at: s, type: 'sawtooth', from: root * k, dur: 0.45, gain: 0.055, attack: 0.004, release: 0.35,
    filter: { type: 'lowpass', from: 4200, to: 700, glide: 0.4, q: 1.2 },
  }));
  noise(a, { at: s, dur: 0.5, gain: 0.1, attack: 0.002, release: 0.45, filter: { type: 'highpass', from: 6500 } });
}

export function slowMo(a, at = 0, dur = 1.1) {
  tone(a, { at, type: 'sine', from: 190, to: 42, glide: dur * 0.8, dur, gain: 0.34, attack: 0.01, release: dur * 0.7 });
  tone(a, { at, type: 'triangle', from: 380, to: 84, glide: dur * 0.8, dur: dur * 0.8, gain: 0.08, attack: 0.01, release: dur * 0.5 });
  noise(a, { at, dur, gain: 0.16, attack: 0.01, release: dur * 0.8, filter: { type: 'lowpass', from: 1600, to: 90, glide: dur * 0.8 } });
}

export function scratch(a, at = 0, back = false) {
  const n = 64, pitch = new Float32Array(n), band = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1);
    const v = back ? Math.pow(x, 1.6) : Math.abs(Math.sin(Math.PI * 2 * x * 0.95)) * (1 - 0.35 * x);
    pitch[i] = 70 + 820 * v;
    band[i] = 400 + 3800 * v;
  }
  const dur = back ? 0.2 : 0.36;
  tone(a, { at, type: 'sawtooth', curve: pitch, dur, gain: 0.34, attack: 0.004, release: back ? 0.04 : 0.06, filter: { type: 'bandpass', curve: band, q: 1.6 } });
  noise(a, { at, dur, gain: 0.8, attack: 0.004, release: back ? 0.04 : 0.06, filter: { type: 'bandpass', curve: band, q: 2.2 } });
  if (!back) hit(a, at + dur - 0.02, 0.32);
}

export function clunk(a, at = 0, gain = 0.45) {
  noise(a, { at, dur: 0.05, gain, attack: 0.001, release: 0.04, filter: { type: 'bandpass', from: 1600, q: 2.5 } });
  tone(a, { at, type: 'square', from: 210, to: 80, glide: 0.06, dur: 0.08, gain: gain * 0.35, attack: 0.001, release: 0.06, filter: { type: 'lowpass', from: 1100 } });
}

export function whir(a, at = 0, dur = 0.8) {
  tone(a, { at, type: 'sawtooth', from: 150, to: 820, glide: dur, dur, gain: 0.18, attack: 0.05, release: 0.08, vibrato: { rate: 23, cents: 60 }, filter: { type: 'bandpass', from: 600, to: 2400, q: 2 } });
  noise(a, { at, dur, gain: 0.24, attack: 0.06, release: 0.08, filter: { type: 'bandpass', from: 2000, to: 5200, q: 0.9 } });
  const n = 40, curve = new Float32Array(n);
  for (let i = 0; i < n; i++) curve[i] = 900 + 1500 * (i / n) + Math.sin(i * 2.7) * 380 + Math.sin(i * 1.3) * 260;
  tone(a, { at, type: 'square', curve, dur, gain: 0.08, attack: 0.05, release: 0.08, filter: { type: 'bandpass', from: 1800, q: 1.5 } });
}

export function tapeStart(a, at = 0) {
  clunk(a, at, 0.5);
  tone(a, { at: at + 0.05, type: 'sine', from: 70, to: 260, glide: 0.18, dur: 0.24, gain: 0.16, attack: 0.02, release: 0.1 });
  noise(a, { at: at + 0.04, dur: 0.35, gain: 0.06, attack: 0.02, release: 0.3, filter: { type: 'highpass', from: 3000 } });
}
