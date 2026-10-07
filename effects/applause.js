import { TAU, rand, clamp, easeOutBack, envelope, drawGlow, emojiSprite, faceOrDefault } from './lib.js';
import { applause } from './sfx.js';

function bravo(env) {
  const C = env.C;
  let t = 0;
  const dur = 3.2;
  const hands = Array.from({ length: 16 }, (_, i) => ({ x: (i % 2 ? rand(0.02, 0.22) : rand(0.78, 0.98)) * C, y0: C * rand(1.0, 1.25), v: C * rand(0.22, 0.4), s: C * rand(0.08, 0.13), ph: rand(0, TAU), delay: rand(0, 1.4) }));
  const bits = Array.from({ length: 40 }, () => ({ x: rand(0, C), y: -rand(0, C * 0.5), v: C * rand(0.25, 0.45), hue: rand(0, 360), r: C * rand(0.006, 0.012) }));
  return {
    sound(a) { applause(a, 0, dur - 0.5); },
    get done() { return t > dur; },
    update(dt) {
      t += dt;
      for (const b of bits) b.y += b.v * dt;
    },
    draw(ctx, e) {
      const a = envelope(t, dur, 0.2, 0.6);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const b of bits) if (b.y > 0 && b.y < C) drawGlow(ctx, b.x, b.y, b.r * 3, b.hue, 0.8 * a);
      ctx.restore();
      ctx.save();
      for (const h of hands) {
        const k = t - h.delay;
        if (k < 0) continue;
        const y = h.y0 - h.v * k;
        if (y < -h.s) continue;
        const wob = Math.sin(k * 14 + h.ph) * 0.25;
        ctx.globalAlpha = a * clamp(1.6 - k / 1.8, 0, 1);
        ctx.setTransform(1, 0, 0, 1, h.x + Math.sin(k * 2 + h.ph) * C * 0.02, y);
        ctx.rotate(wob);
        ctx.drawImage(emojiSprite('👏'), -h.s / 2, -h.s / 2, h.s, h.s);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const f = faceOrDefault(e);
      const R = clamp(f.box.w * 0.8, C * 0.16, C * 0.34);
      const sp = easeOutBack(clamp((t - 0.5) / 0.3, 0, 1));
      if (sp > 0) {
        ctx.globalAlpha = a;
        ctx.translate(C / 2, Math.min(f.box.y + f.box.h + R * 0.9, C * 0.9));
        ctx.scale(sp, sp);
        ctx.rotate(0.05);
        ctx.font = `italic 900 ${R * 0.5}px "Arial Black", Impact, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = R * 0.1;
        ctx.strokeStyle = '#2a1030';
        ctx.strokeText('БРАВО!', 0, 0);
        ctx.fillStyle = '#ff7ad9';
        ctx.fillText('БРАВО!', 0, 0);
      }
      ctx.restore();
    },
  };
}

export default { id: 'applause', face: true, name: 'Браво', emoji: '👏', make: bravo };
