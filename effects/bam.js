import { TAU, rand, pick, clamp, easeOutBack, easeOutCubic, faceOrDefault } from './lib.js';
import { boom, hit } from './sfx.js';

function burst(ctx, R, spikes, text) {
  ctx.beginPath();
  spikes.forEach((k, i) => {
    const a = (i / spikes.length) * TAU;
    const x = Math.cos(a) * R * k * 1.25, y = Math.sin(a) * R * k * 0.85;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.lineWidth = R * 0.11;
  ctx.strokeStyle = '#111';
  ctx.stroke();
  ctx.fillStyle = '#ffd400';
  ctx.fill();
  ctx.lineWidth = R * 0.04;
  ctx.strokeStyle = '#ff2a2a';
  ctx.stroke();
  ctx.font = `italic 900 ${(R * 0.62 * 4) / Math.max(4, text.length)}px "Arial Black", Impact, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = R * 0.12;
  ctx.strokeStyle = '#111';
  ctx.strokeText(text, 0, R * 0.04);
  ctx.fillStyle = '#ff2a2a';
  ctx.fillText(text, 0, R * 0.04);
}

function knock(env, hand) {
  const C = env.C;
  const n = clamp(hand.knock, 2, 5), k = 0.75 + 0.2 * (n - 2);
  const ox = hand.x, oy = hand.y;
  const cx = clamp(ox + rand(-0.06, 0.06) * C, C * 0.2, C * 0.8), cy = clamp(oy - C * 0.05, C * 0.18, C * 0.8);
  const tilt = rand(-0.3, 0.3), text = 'БАХ' + '!'.repeat(Math.min(n - 1, 3));
  let t = 0;
  const dur = 0.9;
  const spikes = Array.from({ length: 20 }, (_, i) => (i % 2 ? rand(0.55, 0.7) : rand(0.9, 1.1)));
  const debris = Array.from({ length: 8 + 4 * n }, () => {
    const a = rand(0, TAU), s = C * rand(0.3, 0.8) * k;
    return { x: ox, y: oy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: rand(0, TAU), vr: rand(-12, 12), s: C * rand(0.006, 0.014) * k, c: pick(['#111', '#ffd400', '#ff2a2a']) };
  });
  return {
    sound(a) { hit(a, 0, 0.4 + 0.06 * (n - 2)); boom(a, 0, 0.3 + 0.08 * (n - 2)); },
    get done() { return t > dur; },
    shake() {
      if (t > 0.3) return null;
      const amp = C * 0.014 * k * Math.exp(-12 * t);
      return { x: rand(-amp, amp), y: rand(-amp, amp) };
    },
    update(dt) {
      t += dt;
      for (const d of debris) {
        d.vy += C * 1.6 * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.r += d.vr * dt;
      }
    },
    draw(ctx) {
      ctx.save();
      const p = clamp(t / 0.35, 0, 1);
      if (p < 1) {
        ctx.globalAlpha = 1 - p;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = C * 0.025 * (1 - p);
        ctx.beginPath();
        ctx.arc(ox, oy, C * 0.4 * k * easeOutCubic(p), 0, TAU);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      for (const d of debris) {
        ctx.setTransform(1, 0, 0, 1, d.x, d.y);
        ctx.rotate(d.r);
        ctx.fillStyle = d.c;
        ctx.beginPath();
        ctx.moveTo(0, -d.s);
        ctx.lineTo(d.s, d.s);
        ctx.lineTo(-d.s, d.s * 0.6);
        ctx.fill();
      }
      const pop = t < 0.12 ? easeOutBack(t / 0.12) : t < 0.6 ? 1 : 1 - (t - 0.6) / (dur - 0.6);
      if (pop > 0) {
        ctx.globalAlpha = clamp(pop, 0, 1);
        ctx.setTransform(1, 0, 0, 1, cx, cy);
        ctx.rotate(tilt);
        burst(ctx, C * 0.14 * k * pop, spikes, text);
      }
      ctx.restore();
    },
    overlay(ctx) {
      if (t > 0.08) return;
      ctx.save();
      ctx.globalAlpha = 0.25 * k * (1 - t / 0.08);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, C, C);
      ctx.restore();
    },
  };
}

function bam(env, hand) {
  if (hand && hand.knock) return knock(env, hand);
  const C = env.C;
  const f = faceOrDefault(env);
  const ox = hand ? hand.x : f.box.x + f.box.w / 2;
  const oy = hand ? hand.y : clamp(f.box.y + f.box.h * 1.05, C * 0.3, C * 0.75);
  const cx = hand ? clamp(ox, C * 0.38, C * 0.62) : ox;
  const cy = hand ? clamp(oy, C * 0.32, C * 0.68) : oy;
  let t = 0;
  const dur = 2.1;
  const spikes = Array.from({ length: 28 }, (_, i) => (i % 2 ? rand(0.55, 0.68) : rand(0.92, 1.08)));
  const lines = Array.from({ length: 46 }, () => ({ a: rand(0, TAU), r0: rand(0.32, 0.5), w: rand(0.004, 0.012) }));
  let debris = Array.from({ length: 34 }, () => {
    const a = rand(0, TAU), s = C * rand(0.4, 1.1);
    return { x: ox, y: oy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: rand(0, TAU), vr: rand(-12, 12), s: C * rand(0.008, 0.02), c: pick(['#111', '#ffd400', '#ff2a2a']) };
  });
  return {
    sound(a) { boom(a); },
    get done() { return t > dur; },
    shake() {
      if (t > 0.6) return null;
      const amp = C * 0.04 * Math.exp(-6 * t);
      return { x: rand(-amp, amp), y: rand(-amp, amp) };
    },
    update(dt) {
      t += dt;
      for (const d of debris) {
        d.vy += C * 1.6 * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.r += d.vr * dt;
      }
    },
    draw(ctx) {
      ctx.save();
      for (let i = 0; i < 3; i++) {
        const p = clamp((t - i * 0.08) / 0.6, 0, 1);
        if (p <= 0 || p >= 1) continue;
        ctx.globalAlpha = 1 - p;
        ctx.strokeStyle = i === 1 ? '#ffd400' : '#ffffff';
        ctx.lineWidth = C * 0.045 * (1 - p);
        ctx.beginPath();
        ctx.arc(ox, oy, C * 1.1 * easeOutCubic(p), 0, TAU);
        ctx.stroke();
      }
      if (t < 0.75) {
        ctx.globalAlpha = 0.85 * (1 - t / 0.75);
        ctx.fillStyle = '#000';
        for (const l of lines) {
          const r0 = C * l.r0, r1 = C * 0.9;
          const ca = Math.cos(l.a), sa = Math.sin(l.a);
          ctx.beginPath();
          ctx.moveTo(ox + ca * r0, oy + sa * r0);
          ctx.lineTo(ox + Math.cos(l.a + l.w) * r1, oy + Math.sin(l.a + l.w) * r1);
          ctx.lineTo(ox + Math.cos(l.a - l.w) * r1, oy + Math.sin(l.a - l.w) * r1);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      for (const d of debris) {
        ctx.setTransform(1, 0, 0, 1, d.x, d.y);
        ctx.rotate(d.r);
        ctx.fillStyle = d.c;
        ctx.beginPath();
        ctx.moveTo(0, -d.s);
        ctx.lineTo(d.s, d.s);
        ctx.lineTo(-d.s, d.s * 0.6);
        ctx.fill();
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const pop = t < 0.25 ? easeOutBack(t / 0.25) : t < 1.6 ? 1 + 0.03 * Math.sin(t * 20) : 1 - (t - 1.6) / 0.5;
      if (pop > 0) {
        const R = C * 0.26 * pop;
        ctx.globalAlpha = clamp(pop, 0, 1);
        ctx.setTransform(1, 0, 0, 1, cx, cy);
        ctx.rotate(-0.12);
        burst(ctx, R, spikes, 'БАХ!');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
      ctx.restore();
    },
    overlay(ctx) {
      if (t > 0.16) return;
      ctx.save();
      ctx.globalAlpha = 0.9 * (1 - t / 0.16);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, C, C);
      ctx.restore();
    },
  };
}

export default { id: 'bam', face: true, name: 'БАХ!', emoji: '💥', gesture: ['Closed_Fist', 'Knock'], make: bam };
