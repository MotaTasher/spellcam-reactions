import { TAU, rand, clamp, easeOutBack, drawGlow, faceOrDefault } from './lib.js';
import { whoosh, sparkle } from './sfx.js';

function star4(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}

function vzhuh(env) {
  const C = env.C;
  const f = faceOrDefault(env);
  const cx = f.box.x + f.box.w / 2, cy = f.box.y + f.box.h / 2;
  const R = clamp(Math.max(f.box.w, f.box.h) * 0.95, C * 0.22, C * 0.42);
  const dur = 2.6, sweep = 0.7;
  const a0 = Math.PI * 0.85, a1 = Math.PI * 2.25;
  const at = (p) => {
    const a = a0 + (a1 - a0) * p;
    return { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R * 0.85 };
  };
  const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
  let t = 0;
  let stars = [];
  let trail = [];
  let burst = false;
  const end = at(1);
  const tx = clamp(cx, C * 0.3, C * 0.7), ty = clamp(f.box.y - C * 0.06, C * 0.14, C * 0.5);

  return {
    sound(a) { whoosh(a); sparkle(a, 0.22); },
    get done() { return t > dur && !stars.length; },
    update(dt) {
      t += dt;
      if (t < sweep) {
        const head = at(ease(t / sweep));
        trail.push(head);
        if (trail.length > 22) trail.shift();
        for (let i = 0; i < 7; i++) {
          const a = rand(0, TAU), s = C * rand(0.03, 0.18);
          stars.push({ x: head.x, y: head.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.5, 1.1), max: 1.1, hue: (t * 500 + i * 40) % 360, r: C * rand(0.006, 0.016) });
        }
      } else {
        if (trail.length) trail.shift();
        if (!burst) {
          burst = true;
          for (let i = 0; i < 46; i++) {
            const a = rand(0, TAU), s = C * rand(0.15, 0.6);
            stars.push({ x: end.x, y: end.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.6, 1.3), max: 1.3, hue: rand(0, 360), r: C * rand(0.008, 0.02) });
          }
        }
      }
      const k = Math.exp(-2.5 * dt);
      for (const s of stars) {
        s.vx *= k;
        s.vy = s.vy * k + C * 0.15 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.life -= dt;
      }
      stars = stars.filter((s) => s.life > 0);
    },
    draw(ctx) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (let i = 1; i < trail.length; i++) {
        const k = i / trail.length;
        ctx.strokeStyle = `hsla(${(t * 500 + i * 15) % 360},100%,70%,${0.7 * k})`;
        ctx.lineWidth = C * 0.03 * k;
        ctx.beginPath();
        ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
        ctx.lineTo(trail[i].x, trail[i].y);
        ctx.stroke();
      }
      if (t < sweep && trail.length) {
        const h = trail[trail.length - 1];
        drawGlow(ctx, h.x, h.y, C * 0.08, 50, 1);
      }
      for (const s of stars) {
        const a = s.life / s.max;
        drawGlow(ctx, s.x, s.y, s.r * 3, s.hue, a * 0.8);
        ctx.globalAlpha = a;
        ctx.fillStyle = '#fff';
        star4(ctx, s.x, s.y, s.r * 1.6);
      }
      ctx.restore();

      if (t > sweep * 0.6 && t < dur) {
        const p = clamp((t - sweep * 0.6) / 0.3, 0, 1);
        const a = clamp((dur - t) / 0.4, 0, 1);
        const sc = easeOutBack(p);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(tx, ty);
        ctx.rotate(-0.16);
        ctx.scale(sc, sc);
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        for (let i = 0; i < 6; i++) {
          const y = (i - 2.5) * C * 0.022, w = C * (0.08 + 0.05 * Math.sin(i * 2.1 + t * 9));
          ctx.fillRect(-C * 0.3 - w, y, w, C * 0.006);
        }
        ctx.font = `italic 900 ${C * 0.12}px "Arial Black", Impact, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.lineWidth = C * 0.022;
        ctx.strokeStyle = '#111';
        ctx.strokeText('ВЖУХ!', 0, 0);
        const g = ctx.createLinearGradient(-C * 0.25, 0, C * 0.25, 0);
        g.addColorStop(0, '#b46bff');
        g.addColorStop(0.5, '#ff6bd6');
        g.addColorStop(1, '#3bd5ff');
        ctx.fillStyle = g;
        ctx.fillText('ВЖУХ!', 0, 0);
        ctx.restore();
      }
    },
  };
}

export default { id: 'vzhuh', name: 'Вжух', emoji: '🪄', face: true, make: vzhuh };
