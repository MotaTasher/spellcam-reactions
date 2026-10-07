import { TAU, rand, envelope, drawGlow, faceOrDefault } from './lib.js';
import { pop } from './sfx.js';

function template(env) {
  const C = env.C;
  const dur = 3;
  let t = 0;
  let dots = [];

  return {
    sound(a) { pop(a); },
    get done() { return t > dur && !dots.length; },

    update(dt, env) {
      t += dt;
      if (t < dur) {
        const f = faceOrDefault(env);
        const x = f.box.x + f.box.w / 2, y = f.box.y + f.box.h / 2;
        const a = rand(0, TAU), s = C * rand(0.2, 0.5);
        dots.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1 });
      }
      for (const d of dots) {
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.life -= dt;
      }
      dots = dots.filter((d) => d.life > 0);
    },

    draw(ctx) {
      const a = envelope(t, dur, 0.3, 0.3);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const d of dots) drawGlow(ctx, d.x, d.y, C * 0.03, 190, d.life * a);
      ctx.restore();
    },
  };
}

export default { id: 'template', name: 'Шаблон', emoji: '✨', make: template };
