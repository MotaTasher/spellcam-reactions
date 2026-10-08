import { clamp, easeOutCubic, faceOrDefault } from './lib.js';
import { scratch } from './sfx.js';

const HOLD = 2.6;
const BACK = 0.3;

function freeze(env) {
  const C = env.C;
  const dur = HOLD + BACK + 0.1;
  const live = env.history(0);
  let snap = null, face = null;
  if (live) {
    snap = document.createElement('canvas');
    snap.width = snap.height = C;
    snap.getContext('2d').drawImage(env.frame, 0, 0, C, C);
    const f = live.face || env.face;
    face = f && { eyes: f.eyes.map((p) => ({ x: p.x, y: p.y })), box: { ...f.box } };
  }
  let t = 0;
  let vignette = null;

  const amount = () => (t < HOLD ? clamp(t / 0.12, 0, 1) : clamp(1 - (t - HOLD) / BACK, 0, 1));
  const push = () => {
    if (t < HOLD) {
      const p = t / HOLD;
      return 0.32 * (0.5 - 0.5 * Math.cos(Math.PI * p)) + 0.05 * Math.exp(-t * 14);
    }
    return 0.32 * (1 - easeOutCubic(clamp((t - HOLD) / BACK, 0, 1)));
  };

  return {
    sound(a) {
      scratch(a);
      scratch(a, HOLD - 0.06, true);
    },
    get done() { return t > dur; },
    update(dt) { t += dt; },
    source() {
      return snap && t < HOLD ? { canvas: snap, face } : null;
    },
    zoom(e) {
      const f = faceOrDefault(e);
      const s = 1 + push();
      const x = f.box.x + f.box.w / 2, y = f.box.y + f.box.h * 0.45;
      const k = (s - 1) / 0.37;
      return { s, x, y, tx: x + (C / 2 - x) * 0.8 * k, ty: y + (C * 0.42 - y) * 0.8 * k };
    },
    filter() {
      const k = amount();
      if (!k) return '';
      return `sepia(${0.5 * k}) saturate(${1 - 0.3 * k}) contrast(${1 - 0.12 * k}) brightness(${1 + 0.08 * k})`;
    },
    draw() {},
    overlay(ctx) {
      const k = amount();
      ctx.save();
      if (k > 0) {
        ctx.globalCompositeOperation = 'soft-light';
        ctx.fillStyle = `rgba(255,170,90,${0.45 * k})`;
        ctx.fillRect(0, 0, C, C);
        ctx.globalCompositeOperation = 'source-over';
        if (!vignette) {
          vignette = ctx.createRadialGradient(C / 2, C / 2, C * 0.25, C / 2, C / 2, C * 0.75);
          vignette.addColorStop(0, 'rgba(40,20,0,0)');
          vignette.addColorStop(1, 'rgba(40,20,0,0.55)');
        }
        ctx.globalAlpha = k;
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, C, C);
        ctx.globalAlpha = 1;
      }
      if (t < 0.1) {
        ctx.fillStyle = `rgba(255,255,255,${0.4 * (1 - t / 0.1)})`;
        ctx.fillRect(0, 0, C, C);
      }
      if (t > 0.4 && t < HOLD + 0.05) {
        const size = C * 0.078;
        ctx.globalAlpha = clamp((t - 0.4) / 0.08, 0, 1);
        ctx.font = `600 ${size}px -apple-system, "Helvetica Neue", Arial, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.lineWidth = size * 0.2;
        ctx.strokeStyle = '#000';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = size * 0.25;
        ctx.strokeText('Да, это я.', C / 2, C * 0.82);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.fillText('Да, это я.', C / 2, C * 0.82);
      }
      ctx.restore();
    },
  };
}

export default { id: 'freeze', name: 'Стоп-кадр', emoji: '📸', face: true, make: freeze };
