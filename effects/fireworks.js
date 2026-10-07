import { TAU, rand, drawGlow } from './lib.js';
import { fireworks as launch } from './sfx.js';

function fireworks(env) {
  const C = env.C;
  let t = 0;
  let rockets = [];
  let sparks = [];
  const launches = Array.from({ length: 8 }, (_, i) => ({ at: i * 0.34 + rand(0, 0.15), fired: false }));

  function explode(r) {
    const hue2 = r.hue + rand(40, 120);
    const ring = Math.random() < 0.35;
    const n = 120;
    sparks.push({ x: r.x, y: r.y, vx: 0, vy: 0, life: 0.25, max: 0.25, hue: r.hue, size: C * 0.09, flash: true });
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const s = ring ? C * rand(0.36, 0.4) : C * Math.sqrt(Math.random()) * 0.45;
      const life = rand(1.1, 1.9);
      sparks.push({
        x: r.x, y: r.y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life, max: life,
        hue: i % 3 ? r.hue : hue2,
        size: C * rand(0.005, 0.009),
        crackle: Math.random() < 0.25,
      });
    }
  }

  return {
    sound(a) { launch(a); },
    get done() { return t > 1 && launches.every((l) => l.fired) && !rockets.length && !sparks.length; },
    update(dt) {
      t += dt;
      for (const l of launches) {
        if (!l.fired && t >= l.at) {
          l.fired = true;
          rockets.push({ x: rand(0.18, 0.82) * C, y: C + 10, vx: rand(-0.06, 0.06) * C, vy: -rand(1.0, 1.3) * C, hue: rand(0, 360) });
        }
      }
      for (const r of rockets) {
        r.vy += C * 0.8 * dt;
        r.x += r.vx * dt;
        r.y += r.vy * dt;
        sparks.push({ x: r.x + rand(-2, 2), y: r.y, vx: rand(-20, 20), vy: rand(20, 80), life: 0.35, max: 0.35, hue: 38, size: C * 0.005, trail: true });
        if (r.vy > -C * 0.12) { r.dead = true; explode(r); }
      }
      rockets = rockets.filter((r) => !r.dead);
      const drag = Math.exp(-1.7 * dt);
      for (const s of sparks) {
        s.vx *= drag;
        s.vy = s.vy * drag + C * 0.28 * dt;
        s.px = s.x; s.py = s.y;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.life -= dt;
      }
      sparks = sparks.filter((s) => s.life > 0);
    },
    draw(ctx) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const r of rockets) drawGlow(ctx, r.x, r.y, C * 0.03, 40, 1);
      for (const s of sparks) {
        let a = s.life / s.max;
        if (s.flash) { drawGlow(ctx, s.x, s.y, s.size * (1.5 - a), s.hue, a); continue; }
        if (s.crackle && a < 0.6) a *= Math.random() < 0.5 ? 1 : 0.15;
        ctx.globalAlpha = a;
        ctx.strokeStyle = `hsl(${s.hue},100%,70%)`;
        ctx.lineWidth = s.size * 0.8;
        ctx.beginPath();
        ctx.moveTo(s.x - s.vx * 0.05, s.y - s.vy * 0.05);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
        drawGlow(ctx, s.x, s.y, s.size * 3.2, s.hue, a);
      }
      ctx.restore();
    },
  };
}

export default { id: 'fireworks', name: 'Салют', emoji: '🎆', make: fireworks };
