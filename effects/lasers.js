import { TAU, rand, clamp, envelope, glow, drawGlow, faceOrDefault } from './lib.js';
import { zap, hum } from './sfx.js';

function lasers(env) {
  const C = env.C;
  let t = 0;
  const dur = 3.8;
  let sparks = [];
  return {
    sound(a) { zap(a); zap(a, 0.12, 0.22); hum(a, 0.15, 1.6); },
    get done() { return t > dur && !sparks.length; },
    update(dt, e) {
      t += dt;
      const f = faceOrDefault(e);
      const on = t > 0.35 && t < dur - 0.3;
      if (on) {
        for (const hit of this.hits(f)) {
          for (let i = 0; i < 4; i++) {
            const a = -Math.PI / 2 + rand(-1.1, 1.1);
            const s = C * rand(0.2, 0.7);
            sparks.push({ x: hit.x, y: hit.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.6), max: 0.6 });
          }
        }
      }
      for (const s of sparks) {
        s.vy += C * 1.4 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.life -= dt;
      }
      sparks = sparks.filter((s) => s.life > 0);
    },
    dir() {
      const k = clamp((t - 0.35) / (dur - 0.7), 0, 1);
      const tx = C * (0.5 + 0.42 * Math.sin(k * TAU * 1.25 - 0.6));
      return { tx, ty: C * 1.02 };
    },
    hits(f) {
      const { tx, ty } = this.dir();
      const mid = { x: (f.eyes[0].x + f.eyes[1].x) / 2, y: (f.eyes[0].y + f.eyes[1].y) / 2 };
      return f.eyes.map((e) => ({ x: e.x + (tx - mid.x), y: ty }));
    },
    draw(ctx, e) {
      const f = faceOrDefault(e);
      const ed = Math.hypot(f.eyes[1].x - f.eyes[0].x, f.eyes[1].y - f.eyes[0].y) || C * 0.16;
      const a = envelope(t, dur, 0.35, 0.3);
      ctx.save();
      ctx.fillStyle = `rgba(120,0,0,${0.22 * a})`;
      ctx.fillRect(0, 0, C, C);
      ctx.globalCompositeOperation = 'lighter';
      const beam = t > 0.35 && t < dur - 0.3;
      const hits = this.hits(f);
      f.eyes.forEach((eye, i) => {
        if (beam) {
          const w = ed * 0.11 * (1 + 0.18 * Math.sin(t * 45 + i));
          const h = hits[i];
          const dx = h.x - eye.x, dy = h.y - eye.y, L = Math.hypot(dx, dy);
          const ex = eye.x + (dx / L) * C * 1.6, ey = eye.y + (dy / L) * C * 1.6;
          ctx.lineCap = 'round';
          for (const [lw, col] of [[w * 3.2, 'rgba(255,0,30,0.22)'], [w * 1.7, 'rgba(255,30,50,0.6)'], [w * 0.55, 'rgba(255,235,235,1)']]) {
            ctx.globalAlpha = a;
            ctx.lineWidth = lw;
            ctx.strokeStyle = col;
            ctx.beginPath();
            ctx.moveTo(eye.x, eye.y);
            ctx.lineTo(ex, ey);
            ctx.stroke();
          }
          drawGlow(ctx, h.x, h.y, ed * 0.9, 20, a);
        }
        const fl = ed * (0.55 + 0.08 * Math.sin(t * 30 + i * 2)) * Math.min(1, t / 0.35);
        drawGlow(ctx, eye.x, eye.y, fl * 1.6, 355, a);
        drawGlow(ctx, eye.x, eye.y, fl * 0.5, 0, a, 100, 80);
        ctx.globalAlpha = 0.9 * a;
        ctx.drawImage(glow(355), eye.x - fl * 2.6, eye.y - fl * 0.09, fl * 5.2, fl * 0.18);
      });
      for (const s of sparks) {
        const k = s.life / s.max;
        ctx.globalAlpha = k;
        ctx.strokeStyle = `hsl(${30 + 20 * k},100%,${55 + 30 * k}%)`;
        ctx.lineWidth = C * 0.004;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - s.vx * 0.03, s.y - s.vy * 0.03);
        ctx.stroke();
      }
      ctx.restore();
    },
  };
}

export default { id: 'lasers', face: true, name: 'Лазеры', emoji: '🔴', make: lasers };
