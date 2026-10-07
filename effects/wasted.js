import { clamp, envelope, easeOutCubic, faceOrDefault } from './lib.js';

function wasted(env) {
  const C = env.C;
  const dur = 4.6;
  let t = 0;

  return {
    get done() { return t > dur; },
    update(dt) { t += dt; },
    filter() {
      const a = envelope(t, dur, 0.25, 0.5);
      return `grayscale(${0.9 * a}) contrast(${1 + 0.2 * a}) brightness(${1 - 0.12 * a})`;
    },
    zoom(e) {
      const f = faceOrDefault(e);
      const a = envelope(t, dur, 0.25, 0.5);
      return { s: 1 + 0.14 * easeOutCubic(clamp(t / dur, 0, 1)) * a, x: f.box.x + f.box.w / 2, y: f.box.y + f.box.h / 2 };
    },
    draw() {},
    overlay(ctx) {
      const a = envelope(t, dur, 0.25, 0.5);
      ctx.save();
      ctx.fillStyle = `rgba(110,0,0,${0.16 * a})`;
      ctx.fillRect(0, 0, C, C);
      if (t > 0.55) {
        const p = clamp((t - 0.55) / 0.35, 0, 1);
        const ta = p * clamp((dur - t) / 0.5, 0, 1);
        const label = 'ПОТРАЧЕНО';
        let size = C * 0.12;
        ctx.font = `900 ${size}px "Pricedown", Impact, "Arial Black", system-ui, sans-serif`;
        const w = ctx.measureText(label).width;
        if (w > C * 0.86) size *= (C * 0.86) / w;
        const sc = 1.25 - 0.25 * easeOutCubic(p);
        ctx.globalAlpha = ta;
        ctx.translate(C / 2, C * 0.56);
        ctx.scale(sc, sc);
        ctx.font = `900 ${size}px "Pricedown", Impact, "Arial Black", system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = C * 0.02;
        ctx.lineWidth = size * 0.14;
        ctx.strokeStyle = '#000';
        ctx.strokeText(label, 0, 0);
        ctx.shadowBlur = 0;
        const g = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
        g.addColorStop(0, '#e8413c');
        g.addColorStop(1, '#8e0c0c');
        ctx.fillStyle = g;
        ctx.fillText(label, 0, 0);
      }
      ctx.restore();
    },
  };
}

export default { id: 'wasted', name: 'Потрачено', emoji: '💀', face: true, make: wasted };
