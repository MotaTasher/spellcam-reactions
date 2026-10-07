import { TAU, rand, clamp, easeOutBack, envelope, faceOrDefault } from './lib.js';
import { buzzer } from './sfx.js';

function no(env) {
  const C = env.C;
  let t = 0;
  const dur = 1.7;
  const f = faceOrDefault(env);
  const cx = f.box.x + f.box.w / 2, cy = f.box.y + f.box.h / 2;
  const R = clamp(f.box.w * 0.85, C * 0.18, C * 0.36);
  const ty = Math.min(cy + R * 1.45, C * 0.9);
  return {
    sound(a) { buzzer(a); },
    get done() { return t > dur; },
    shake() {
      if (t > 0.35) return null;
      const amp = C * 0.02 * (1 - t / 0.35);
      return { x: rand(-amp, amp), y: 0 };
    },
    filter() {
      const a = envelope(t, dur, 0.1, 0.5);
      return `saturate(${1 - 0.5 * a}) sepia(${0.2 * a}) hue-rotate(${-20 * a}deg)`;
    },
    update(dt) { t += dt; },
    draw(ctx) {
      const s = easeOutBack(clamp(t / 0.22, 0, 1));
      const a = envelope(t, dur, 0.05, 0.4);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(cx, cy);
      ctx.rotate(-0.08);
      ctx.scale(s, s);
      ctx.lineCap = 'round';
      for (const [w, col] of [[0.22, '#111'], [0.14, '#ff2a2a']]) {
        ctx.lineWidth = R * w;
        ctx.strokeStyle = col;
        ctx.beginPath();
        ctx.arc(0, 0, R, 0, TAU);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-R * 0.7, -R * 0.7);
        ctx.lineTo(R * 0.7, R * 0.7);
        ctx.stroke();
      }
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = `italic 900 ${R * 0.55}px "Arial Black", Impact, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = R * 0.1;
      ctx.strokeStyle = '#111';
      ctx.strokeText('НЕТ!', cx, ty);
      ctx.fillStyle = '#ff2a2a';
      ctx.fillText('НЕТ!', cx, ty);
      ctx.restore();
    },
  };
}

export default { id: 'no', face: true, name: 'Нет!', emoji: '🚫', make: no };
