import { TAU, rand, pick, clamp, easeOutBack, drawGlow, emojiSprite, heart } from './lib.js';
import { chime } from './sfx.js';

function hearts(env) {
  const C = env.C;
  let t = 0;
  let items = [];
  let emitted = 0;
  const total = 70;
  const dur = 2.6;
  const emojis = ['💖', '💗', '💕', '❤️'];
  return {
    sound(a) { chime(a); },
    get done() { return t > dur && !items.length; },
    update(dt) {
      t += dt;
      const want = Math.min(total, Math.floor((t / dur) * total));
      while (emitted < want) {
        const s = C * rand(0.035, 0.09);
        items.push({
          x: rand(0.05, 0.95) * C, y: C + s, vy: -C * rand(0.22, 0.45),
          s, hue: rand(330, 365) % 360, ph: rand(0, TAU), amp: C * rand(0.01, 0.04),
          rot: rand(-0.3, 0.3), age: 0, emoji: Math.random() < 0.25 ? pick(emojis) : null,
        });
        emitted++;
      }
      for (const h of items) {
        h.age += dt;
        h.y += h.vy * dt;
        h.vy *= Math.exp(-0.2 * dt);
      }
      items = items.filter((h) => h.y > -h.s * 2 && h.age < 3.6);
    },
    draw(ctx) {
      ctx.save();
      const bp = clamp(t / 1.4, 0, 1);
      if (bp < 1) {
        const sc = C * 0.55 * easeOutBack(clamp(t / 0.45, 0, 1)) * (1 + 0.04 * Math.sin(t * 18));
        ctx.globalAlpha = 0.55 * (1 - bp);
        ctx.globalCompositeOperation = 'lighter';
        drawGlow(ctx, C / 2, C / 2, sc * 1.1, 340, 0.6 * (1 - bp));
        ctx.setTransform(sc, 0, 0, sc, C / 2, C / 2);
        ctx.fillStyle = 'rgba(255,60,120,0.55)';
        ctx.globalAlpha = 0.55 * (1 - bp);
        ctx.fill(heart());
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
      }
      for (const h of items) {
        const x = h.x + Math.sin(h.age * 3 + h.ph) * h.amp;
        const sc = h.s * Math.min(1, h.age * 3) * (1 + 0.06 * Math.sin(h.age * 9 + h.ph));
        const a = clamp(h.y / (C * 0.25), 0, 1) * clamp((3.6 - h.age) / 0.8, 0, 1);
        ctx.globalCompositeOperation = 'lighter';
        drawGlow(ctx, x, h.y, sc * 1.3, h.hue, 0.45 * a);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = a;
        if (h.emoji) {
          ctx.drawImage(emojiSprite(h.emoji), x - sc * 0.6, h.y - sc * 0.6, sc * 1.2, sc * 1.2);
          continue;
        }
        ctx.setTransform(sc, 0, 0, sc, x, h.y);
        ctx.rotate(h.rot + Math.sin(h.age * 2 + h.ph) * 0.15);
        const g = ctx.createLinearGradient(0, -0.5, 0, 0.5);
        g.addColorStop(0, `hsl(${h.hue},100%,74%)`);
        g.addColorStop(1, `hsl(${h.hue},92%,48%)`);
        ctx.fillStyle = g;
        ctx.fill(heart());
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath();
        ctx.ellipse(-0.24, -0.2, 0.09, 0.05, -0.6, 0, TAU);
        ctx.fill();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
      ctx.restore();
    },
  };
}

export default { id: 'hearts', name: 'Сердечки', emoji: '💖', make: hearts };
