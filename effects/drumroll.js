import { TAU, rand, clamp, easeOutCubic, drawGlow, faceOrDefault } from './lib.js';
import { drumroll, cymbal } from './sfx.js';

function roll(env) {
  const C = env.C;
  let t = 0;
  const roll = 1.6, dur = 3.1;
  const f = faceOrDefault(env);
  const cx = f.box.x + f.box.w / 2, cy = f.box.y + f.box.h / 2;
  const R = clamp(f.box.w * 0.9, C * 0.2, C * 0.4);
  const rays = Array.from({ length: 18 }, (_, i) => ({ a: (i / 18) * TAU + rand(-0.05, 0.05), l: rand(0.6, 1) }));
  return {
    sound(a) { drumroll(a, 0, roll); cymbal(a, roll); },
    get done() { return t > dur; },
    shake() {
      if (t < roll) { const amp = C * 0.004 * (t / roll); return { x: rand(-amp, amp), y: rand(-amp, amp) }; }
      if (t < roll + 0.3) { const amp = C * 0.03 * (1 - (t - roll) / 0.3); return { x: rand(-amp, amp), y: rand(-amp, amp) }; }
      return null;
    },
    update(dt) { t += dt; },
    draw(ctx) {
      if (t < roll + 0.15) {
        const p = clamp(t / roll, 0, 1);
        const r = C * 0.6 - (C * 0.6 - R * 0.8) * easeOutCubic(p);
        const g = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r * 1.15);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, `rgba(0,0,0,${0.88 * Math.min(1, t * 3)})`);
        ctx.save();
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, C, C);
        ctx.restore();
        return;
      }
      const k = clamp((t - roll) / (dur - roll), 0, 1);
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.globalCompositeOperation = 'lighter';
      for (const ray of rays) {
        const len = C * ray.l * (0.3 + 0.7 * easeOutCubic(Math.min(1, k * 2)));
        ctx.strokeStyle = 'rgba(255,220,90,0.55)';
        ctx.lineWidth = C * 0.012;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ray.a) * R * 1.05, cy + Math.sin(ray.a) * R * 1.05);
        ctx.lineTo(cx + Math.cos(ray.a) * (R + len), cy + Math.sin(ray.a) * (R + len));
        ctx.stroke();
      }
      drawGlow(ctx, cx, cy, R * 1.6, 45, 0.5 * (1 - k));
      ctx.restore();
      const sp = 1 + 0.12 * Math.sin(Math.min(k * 10, Math.PI));
      ctx.save();
      ctx.globalAlpha = 1 - Math.max(0, (k - 0.6) / 0.4);
      ctx.translate(cx, Math.min(cy + R * 1.4, C * 0.82));
      ctx.scale(sp, sp);
      ctx.rotate(-0.06);
      ctx.font = `italic 900 ${R * 0.5}px "Arial Black", Impact, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = R * 0.1;
      ctx.strokeStyle = '#3a2600';
      ctx.strokeText('ТА-ДАМ!', 0, 0);
      ctx.fillStyle = '#ffd23f';
      ctx.fillText('ТА-ДАМ!', 0, 0);
      ctx.restore();
    },
    overlay(ctx) {
      if (t < roll || t > roll + 0.18) return;
      ctx.save();
      ctx.globalAlpha = 0.85 * (1 - (t - roll) / 0.18);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, C, C);
      ctx.restore();
    },
  };
}

export default { id: 'drumroll', face: true, name: 'Та-дам', emoji: '🥁', gesture: 'Pointing_Up', make: roll };
