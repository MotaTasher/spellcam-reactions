import { TAU, rand, pick, clamp, easeOutBack, emojiSprite, faceOrDefault } from './lib.js';
import { laugh } from './sfx.js';

const COLORS = ['#ffd23f', '#ff8a3d', '#ff3b5c', '#7ce0ff', '#b6ff5c'];

function haha(env) {
  const C = env.C;
  const dur = 3;
  let t = 0;
  let words = [];
  let emojis = [];
  let spawned = 0;
  const total = 13;

  return {
    sound(a) { laugh(a); },
    get done() { return t > dur && !words.length && !emojis.length; },
    shake() {
      if (t > dur - 0.3) return null;
      return { x: Math.sin(t * 21) * C * 0.003, y: Math.abs(Math.sin(t * 28)) * C * 0.01 };
    },
    update(dt, e) {
      t += dt;
      const f = faceOrDefault(e);
      const cx = f.box.x + f.box.w / 2, cy = f.box.y + f.box.h / 2;
      const R = Math.max(f.box.w, f.box.h);
      while (spawned < total && t > spawned * 0.17) {
        const a = rand(0, TAU), r = R * rand(0.75, 1.1);
        words.push({
          x: clamp(cx + Math.cos(a) * r, C * 0.12, C * 0.88),
          y: clamp(cy + Math.sin(a) * r * 0.85, C * 0.1, C * 0.9),
          s: C * rand(0.06, 0.11), rot: rand(-0.5, 0.5), col: pick(COLORS),
          text: Math.random() < 0.3 ? 'ХА!' : 'ХА', age: 0, life: 1.1,
        });
        if (spawned % 2 === 0) {
          const side = spawned % 4 === 0 ? -1 : 1;
          emojis.push({ x: cx + side * f.box.w * 0.5, y: cy, vx: side * C * rand(0.25, 0.5), vy: -C * rand(0.4, 0.7), rot: 0, vr: rand(-6, 6), s: C * rand(0.06, 0.09), life: 1.4 });
        }
        spawned++;
      }
      for (const w of words) w.age += dt;
      words = words.filter((w) => w.age < w.life);
      for (const m of emojis) {
        m.vy += C * 1.4 * dt;
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        m.rot += m.vr * dt;
        m.life -= dt;
      }
      emojis = emojis.filter((m) => m.life > 0 && m.y < C + m.s);
    },
    draw(ctx) {
      ctx.save();
      for (const m of emojis) {
        ctx.setTransform(1, 0, 0, 1, m.x, m.y);
        ctx.rotate(m.rot);
        ctx.globalAlpha = clamp(m.life / 0.3, 0, 1);
        ctx.drawImage(emojiSprite('😂'), -m.s / 2, -m.s / 2, m.s, m.s);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      for (const w of words) {
        const p = easeOutBack(clamp(w.age / 0.2, 0, 1));
        const a = clamp((w.life - w.age) / 0.3, 0, 1);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(w.x + rand(-1, 1) * C * 0.004, w.y + rand(-1, 1) * C * 0.004);
        ctx.rotate(w.rot);
        ctx.scale(p, p);
        ctx.font = `900 ${w.s}px "Arial Black", Impact, system-ui, sans-serif`;
        ctx.lineWidth = w.s * 0.2;
        ctx.strokeStyle = '#111';
        ctx.strokeText(w.text, 0, 0);
        ctx.fillStyle = w.col;
        ctx.fillText(w.text, 0, 0);
        ctx.restore();
      }
      ctx.restore();
    },
  };
}

export default { id: 'haha', name: 'ХА-ХА', emoji: '😂', face: true, make: haha };
