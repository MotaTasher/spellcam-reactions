import { TAU, rand, pick, clamp, drawGlow } from './lib.js';
import { tada } from './sfx.js';

const CONFETTI = [
  ['#ff3b5c', '#b81d3a'], ['#ffd23f', '#c99a00'], ['#3bceac', '#1d8a72'],
  ['#4d7cff', '#2647b8'], ['#b86bff', '#7a2fc4'], ['#ff8a3d', '#c25a12'], ['#ffffff', '#c8c8d0'],
];

function confetti(env) {
  const C = env.C;
  let t = 0;
  let pieces = [];
  let emitted = 0;
  const total = 320;
  const pops = [];
  return {
    sound(a) { tada(a); },
    get done() { return t > 0.5 && !pieces.length; },
    update(dt) {
      t += dt;
      const want = Math.min(total, Math.floor((t / 0.35) * total));
      while (emitted < want) {
        const side = emitted % 2 ? 1 : -1;
        const w = C * rand(0.022, 0.038);
        pieces.push({
          x: side < 0 ? -10 : C + 10, y: C + 10,
          vx: -side * C * rand(0.3, 1.05), vy: -C * rand(1.15, 1.85),
          w, h: w * rand(0.4, 0.65), rot: rand(0, TAU), vr: rand(-9, 9),
          flip: rand(0, TAU), vf: rand(6, 15), sway: rand(0, TAU),
          col: pick(CONFETTI), round: Math.random() < 0.2, life: rand(3.6, 5.2),
        });
        emitted++;
      }
      if (t < 0.4 && pops.length < 2) pops.push({ x: 0, y: C }, { x: C, y: C });
      for (const p of pieces) {
        const k = Math.exp(-2.6 * dt);
        p.vx *= k;
        p.vy = p.vy * k + C * 1.0 * dt;
        p.x += p.vx * dt + Math.sin(t * 3 + p.sway) * C * 0.06 * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        p.flip += p.vf * dt;
        p.life -= dt;
      }
      pieces = pieces.filter((p) => p.life > 0 && p.y < C + 40);
    },
    draw(ctx) {
      ctx.save();
      if (t < 0.45) {
        ctx.globalCompositeOperation = 'lighter';
        for (const p of pops) drawGlow(ctx, p.x, p.y, C * 0.35 * (1 - t / 0.45 * 0.5), 45, 1 - t / 0.45);
        ctx.globalCompositeOperation = 'source-over';
      }
      for (const p of pieces) {
        const cf = Math.cos(p.flip);
        ctx.globalAlpha = clamp(p.life / 0.6, 0, 1);
        ctx.setTransform(1, 0, 0, 1, p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, Math.abs(cf) < 0.08 ? 0.08 : cf);
        ctx.fillStyle = cf > 0 ? p.col[0] : p.col[1];
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.h * 0.7, 0, TAU);
          ctx.fill();
        } else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }
      ctx.restore();
    },
  };
}

export default { id: 'confetti', name: 'Конфетти', emoji: '🎉', make: confetti };
