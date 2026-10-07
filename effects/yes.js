import { TAU, rand, clamp, easeOutBack, envelope, drawGlow, faceOrDefault } from './lib.js';
import { ding } from './sfx.js';

function yes(env) {
  const C = env.C;
  let t = 0;
  const dur = 1.8;
  const f = faceOrDefault(env);
  const cx = f.box.x + f.box.w / 2, cy = f.box.y + f.box.h / 2;
  const R = clamp(f.box.w * 0.8, C * 0.16, C * 0.34);
  const pts = [[-0.55, 0.02], [-0.15, 0.42], [0.62, -0.5]];
  const sparks = Array.from({ length: 14 }, () => ({ a: rand(0, TAU), r: rand(0.9, 1.5), s: rand(0.3, 0.8), ph: rand(0, 1) }));
  const ty = Math.min(cy + R * 1.4, C * 0.82);
  const seg = (p) => {
    const path = [pts[0]];
    if (p < 0.4) path.push([pts[0][0] + (pts[1][0] - pts[0][0]) * (p / 0.4), pts[0][1] + (pts[1][1] - pts[0][1]) * (p / 0.4)]);
    else {
      const q = (p - 0.4) / 0.6;
      path.push(pts[1], [pts[1][0] + (pts[2][0] - pts[1][0]) * q, pts[1][1] + (pts[2][1] - pts[1][1]) * q]);
    }
    return path;
  };
  return {
    sound(a) { ding(a); },
    get done() { return t > dur; },
    zoom() { return { s: 1 + 0.05 * envelope(t, dur, 0.3, 0.6), x: cx, y: cy }; },
    update(dt) { t += dt; },
    draw(ctx) {
      const p = clamp(t / 0.35, 0, 1);
      const a = envelope(t, dur, 0.05, 0.4);
      const path = seg(p);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(cx, cy);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const [w, col] of [[0.26, '#0b3d1e'], [0.16, '#2ee36b']]) {
        ctx.lineWidth = R * w;
        ctx.strokeStyle = col;
        ctx.beginPath();
        path.forEach(([x, y], i) => (i ? ctx.lineTo(x * R, y * R) : ctx.moveTo(x * R, y * R)));
        ctx.stroke();
      }
      ctx.restore();
      if (t > 0.3) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const s of sparks) {
          const k = clamp((t - 0.3 - s.ph * 0.5) / 0.9, 0, 1);
          if (k <= 0 || k >= 1) continue;
          const r = R * s.r * (0.6 + 0.6 * k);
          drawGlow(ctx, cx + Math.cos(s.a) * r, cy + Math.sin(s.a) * r, R * 0.14 * s.s * (1 - k), 135, (1 - k) * a);
        }
        ctx.restore();
      }
      const sp = easeOutBack(clamp((t - 0.25) / 0.25, 0, 1));
      if (sp > 0) {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(cx, ty);
        ctx.scale(sp, sp);
        ctx.font = `italic 900 ${R * 0.55}px "Arial Black", Impact, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = R * 0.1;
        ctx.strokeStyle = '#0b3d1e';
        ctx.strokeText('ДА!', 0, 0);
        ctx.fillStyle = '#2ee36b';
        ctx.fillText('ДА!', 0, 0);
        ctx.restore();
      }
    },
  };
}

export default { id: 'yes', face: true, name: 'Да!', emoji: '✅', make: yes };
