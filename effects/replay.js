import { clamp, easeOutBack, faceOrDefault } from './lib.js';
import { sting, slowMo } from './sfx.js';

const CUT = 0.25;
const SWEEP = 0.5;
const SLOW = 0.5;
const BARS = [[0.76, 0.84, '#ffffff'], [-0.5, 0.72, '#e8202f'], [-0.9, -0.5, '#121a33'], [-0.99, -0.94, '#ffffff']];

const lerp = (a, b, k) => a + (b - a) * k;
function lerpFace(f, g, k) {
  if (!f || !g) return f || g;
  return {
    eyes: f.eyes.map((p, i) => ({ x: lerp(p.x, g.eyes[i].x, k), y: lerp(p.y, g.eyes[i].y, k) })),
    box: { x: lerp(f.box.x, g.box.x, k), y: lerp(f.box.y, g.box.y, k), w: lerp(f.box.w, g.box.w, k), h: lerp(f.box.h, g.box.h, k) },
  };
}

function replay(env) {
  const C = env.C;
  const clip = clamp(env.historySpan - 0.1, 0, 1.4);
  const play = clip > 0.3 ? clip / SLOW : 1.2;
  const out = CUT + play;
  const dur = out + SWEEP / 2 + 0.05;
  let t = 0;
  let mix = null, mg = null, vignette = null;

  const on = () => t >= CUT && t < out;

  function past(sec) {
    const a = env.history(sec + 0.03), b = env.history(sec - 0.03);
    if (!a) return null;
    if (!b || a.canvas === b.canvas || a.ago <= b.ago) return a;
    const k = clamp((a.ago - sec) / (a.ago - b.ago), 0, 1);
    if (!mix || mix.width !== a.canvas.width) {
      mix = document.createElement('canvas');
      mix.width = mix.height = a.canvas.width;
      mg = mix.getContext('2d');
    }
    mg.globalAlpha = 1;
    mg.drawImage(a.canvas, 0, 0);
    mg.globalAlpha = k;
    mg.drawImage(b.canvas, 0, 0);
    mg.globalAlpha = 1;
    return { canvas: mix, face: lerpFace(a.face, b.face, k) };
  }

  function stinger(ctx, p, dir) {
    if (p <= 0 || p >= 1) return;
    const u = 2 * p - 1;
    const X = (0.6 * u * u * u + 0.4 * u) * 1.75 * C * dir;
    ctx.save();
    ctx.translate(C / 2, C / 2);
    ctx.rotate(-0.42);
    let red = null;
    for (const [a, b, color] of BARS) {
      const x0 = X + Math.min(a * dir, b * dir) * C, x1 = X + Math.max(a * dir, b * dir) * C;
      ctx.fillStyle = color;
      ctx.fillRect(x0, -C, x1 - x0, 2 * C);
      if (color === '#e8202f') red = [x0, x1];
    }
    ctx.beginPath();
    ctx.rect(red[0], -C, red[1] - red[0], 2 * C);
    ctx.clip();
    ctx.translate(X * 0.3, 0);
    ctx.rotate(0.42);
    ctx.font = `italic 900 ${C * 0.14}px "Arial Black", Impact, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText('ПОВТОР', 0, 0);
    ctx.restore();
  }

  function badge(ctx) {
    const pin = clamp((t - CUT - 0.05) / 0.35, 0, 1), pout = clamp((t - out + 0.25) / 0.25, 0, 1);
    if (pin <= 0 || pout >= 1) return;
    const slide = (1 - easeOutBack(pin)) * -0.5 * C + pout * -0.5 * C;
    const h = C * 0.088, y = C * 0.15;
    ctx.save();
    ctx.font = `italic 900 ${h * 0.62}px "Arial Black", Impact, system-ui, sans-serif`;
    const tw = ctx.measureText('ПОВТОР').width;
    ctx.font = `700 ${h * 0.4}px system-ui, sans-serif`;
    const sw = ctx.measureText('0,5×').width;
    const w = h * 1.05 + tw + h * 0.35 + sw + h * 0.45;
    const x = (C - w) / 2 + slide;
    const sk = h * 0.28;
    ctx.beginPath();
    ctx.moveTo(x + sk, y);
    ctx.lineTo(x + w + sk, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fillStyle = 'rgba(12,16,32,0.82)';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + sk, y);
    ctx.lineTo(x + sk + h * 0.16, y);
    ctx.lineTo(x + h * 0.16, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fillStyle = '#e8202f';
    ctx.fill();
    const blink = Math.floor((t - CUT) * 3) % 2 === 0;
    ctx.fillStyle = blink ? '#ff2a3a' : 'rgba(255,42,58,0.25)';
    ctx.beginPath();
    ctx.arc(x + h * 0.62, y + h / 2, h * 0.17, 0, Math.PI * 2);
    ctx.fill();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    ctx.font = `italic 900 ${h * 0.62}px "Arial Black", Impact, system-ui, sans-serif`;
    ctx.fillText('ПОВТОР', x + h * 1.0, y + h * 0.53);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = `700 ${h * 0.4}px system-ui, sans-serif`;
    ctx.fillText('0,5×', x + h * 1.0 + tw + h * 0.35, y + h * 0.55);
    const prog = clamp((t - CUT) / play, 0, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(x + h * 0.2, y + h + C * 0.008, w - h * 0.2, C * 0.006);
    ctx.fillStyle = '#e8202f';
    ctx.fillRect(x + h * 0.2, y + h + C * 0.008, (w - h * 0.2) * prog, C * 0.006);
    ctx.restore();
  }

  return {
    sound(a) {
      sting(a, 0, CUT, true);
      slowMo(a, CUT + 0.06, 1.1);
      sting(a, out - CUT, CUT, false);
    },
    get done() { return t > dur; },
    update(dt) { t += dt; },
    source() {
      if (!on()) return null;
      return past(t + 0.1 + clip - (t - CUT) * SLOW);
    },
    zoom(e) {
      if (!on()) return null;
      const f = faceOrDefault(e);
      const p = clamp((t - CUT) / play, 0, 1);
      return { s: 1.04 + 0.1 * p, x: f.box.x + f.box.w / 2, y: f.box.y + f.box.h / 2 };
    },
    filter() {
      return on() ? 'contrast(1.12) saturate(0.78) sepia(0.12) brightness(1.03)' : '';
    },
    draw() {},
    overlay(ctx) {
      if (on()) {
        const bars = C * 0.075 * clamp((t - CUT) / 0.2, 0, 1) * clamp((out - t) / 0.15, 0, 1);
        if (!vignette) {
          vignette = ctx.createRadialGradient(C / 2, C / 2, C * 0.2, C / 2, C / 2, C * 0.72);
          vignette.addColorStop(0, 'rgba(0,0,0,0)');
          vignette.addColorStop(0.6, 'rgba(0,0,0,0.18)');
          vignette.addColorStop(1, 'rgba(0,0,0,0.7)');
        }
        ctx.save();
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, C, C);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, C, bars);
        ctx.fillRect(0, C - bars, C, bars);
        ctx.restore();
      }
      badge(ctx);
      stinger(ctx, (t - CUT + SWEEP / 2) / SWEEP, 1);
      stinger(ctx, (t - out + SWEEP / 2) / SWEEP, -1);
    },
  };
}

export default { id: 'replay', name: 'Повтор', emoji: '🔁', face: true, make: replay };
