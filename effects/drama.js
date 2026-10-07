import { clamp, easeOutCubic, faceOrDefault } from './lib.js';

function drama(env) {
  const C = env.C;
  const dur = 3;
  let t = 0;

  const amount = () => {
    if (t < 0.18) return easeOutCubic(t / 0.18);
    if (t > dur - 0.45) return clamp((dur - t) / 0.45, 0, 1);
    return 1;
  };

  return {
    get done() { return t > dur; },
    update(dt) { t += dt; },
    zoom(e) {
      const f = faceOrDefault(e);
      const k = amount();
      const s = 1 + (0.55 + 0.04 * Math.sin(t * 2)) * k;
      const x = f.box.x + f.box.w / 2, y = f.box.y + f.box.h * 0.45;
      return { s, x, y, tx: x + (C / 2 - x) * 0.85 * k, ty: y + (C * 0.45 - y) * 0.85 * k, rot: -0.07 * k };
    },
    filter() {
      const k = amount();
      return `contrast(${1 + 0.25 * k}) saturate(${1 - 0.35 * k})`;
    },
    draw() {},
    overlay(ctx) {
      const k = amount();
      ctx.save();
      const g = ctx.createRadialGradient(C / 2, C / 2, C * 0.18, C / 2, C / 2, C * 0.72);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.55, `rgba(0,0,0,${0.25 * k})`);
      g.addColorStop(1, `rgba(0,0,0,${0.92 * k})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, C, C);
      const bar = C * 0.13 * k;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, C, bar);
      ctx.fillRect(0, C - bar, C, bar);
      if (t < 0.1) {
        ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - t / 0.1)})`;
        ctx.fillRect(0, 0, C, C);
      }
      if (t > 0.35) {
        const words = ['дун', 'дун', 'ДУУУН'];
        const shown = Math.min(words.length, Math.floor((t - 0.35) / 0.35) + 1);
        ctx.globalAlpha = k;
        ctx.font = `italic 700 ${C * 0.055}px Georgia, "Times New Roman", serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = C * 0.015;
        ctx.fillText(words.slice(0, shown).join('… '), C / 2, C * 0.8);
      }
      ctx.restore();
    },
  };
}

export default { id: 'drama', name: 'Драма', emoji: '🎭', face: true, make: drama };
