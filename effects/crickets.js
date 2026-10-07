import { rand, clamp, envelope, emojiSprite, faceOrDefault } from './lib.js';
import { crickets } from './sfx.js';

function quiet(env) {
  const C = env.C;
  let t = 0;
  const dur = 3.4;
  const bugs = Array.from({ length: 3 }, (_, i) => ({ x: C * (0.15 + i * 0.32) + rand(-C * 0.04, C * 0.04), ph: rand(0, 2), dir: i % 2 ? -1 : 1, speed: rand(0.6, 1) }));
  return {
    sound(a) { crickets(a, 0, dur - 0.4); },
    get done() { return t > dur; },
    filter() {
      const a = envelope(t, dur, 0.5, 0.7);
      return `saturate(${1 - 0.5 * a}) brightness(${1 - 0.22 * a}) contrast(${1 + 0.06 * a})`;
    },
    update(dt) { t += dt; },
    draw(ctx, e) {
      const a = envelope(t, dur, 0.4, 0.5);
      const f = faceOrDefault(e);
      const s = C * 0.11;
      ctx.save();
      ctx.globalAlpha = a;
      for (const b of bugs) {
        const ph = (t * b.speed + b.ph) % 1.6;
        const hop = ph < 0.5 ? Math.sin((ph / 0.5) * Math.PI) : 0;
        const x = b.x + b.dir * Math.sin(t * 0.7 + b.ph) * C * 0.05;
        const y = C * 0.93 - hop * C * 0.06;
        ctx.setTransform(b.dir, 0, 0, 1, x, y);
        ctx.drawImage(emojiSprite('🦗'), -s / 2, -s, s, s);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const dots = 1 + Math.floor((t * 1.5) % 3);
      const tx = clamp(f.box.x + f.box.w * 1.05, C * 0.1, C * 0.82);
      const ty = clamp(f.box.y - f.box.h * 0.05, C * 0.12, C * 0.8);
      ctx.font = `700 ${C * 0.11}px system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = C * 0.012;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText('.'.repeat(dots), tx, ty);
      ctx.fillStyle = '#e8e8f0';
      ctx.fillText('.'.repeat(dots), tx, ty);
      ctx.restore();
    },
  };
}

export default { id: 'crickets', face: true, name: 'Сверчки', emoji: '🦗', make: quiet };
