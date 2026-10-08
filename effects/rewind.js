import { clamp, rand } from './lib.js';
import { clunk, whir, tapeStart } from './sfx.js';

const GLITCH = 0.12;
const SPEED = 2;

let grain = null;
function noiseTexture() {
  if (grain) return grain;
  grain = document.createElement('canvas');
  grain.width = 160;
  grain.height = 48;
  const g = grain.getContext('2d');
  const img = g.createImageData(grain.width, grain.height);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() < 0.6 ? Math.random() * 60 : 150 + Math.random() * 105;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return grain;
}

function canvas(S) {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  return [c, c.getContext('2d')];
}

function rewind(env) {
  const C = env.C;
  const S = Math.round(C / 2);
  const tape = clamp(env.historySpan - 0.05, 0, 1.6);
  const rewEnd = GLITCH + tape / SPEED;
  const holdEnd = rewEnd + 0.22;
  const snapEnd = holdEnd + 0.16;
  const dur = snapEnd + 0.75;
  const counter0 = 40 + Math.floor(Math.random() * 1500);
  let t = 0;
  let bufs = null, lines = null;

  const phase = () => (t < GLITCH ? 0 : t < rewEnd ? 1 : t < holdEnd ? 2 : t < snapEnd ? 3 : 4);
  const amount = () => [clamp(t / GLITCH, 0.3, 1), 1, 0.55, 1.3, 0][phase()];
  const ago = () => [t, t + SPEED * (t - GLITCH), t + tape][phase()];

  function vhs(src, amt) {
    if (!bufs) bufs = [canvas(S), canvas(S), canvas(S)];
    const [[A, ga], [R, gr], [O, go]] = bufs;
    const k = src.width / S;
    ga.fillStyle = '#000';
    ga.fillRect(0, 0, S, S);
    const n = 20, h = S / n;
    const band = ((t * 0.9) % 1.3 - 0.15) * S, bh = S * 0.14;
    for (let i = 0; i < n; i++) {
      const y = i * h;
      let dx = (Math.sin(t * 31 + i * 1.9) * 0.006 + rand(-0.004, 0.004)) * S * amt;
      if (y + h > band && y < band + bh) dx += rand(0.03, 0.09) * S * amt;
      if (i === n - 1) dx += 0.06 * S * amt;
      ga.drawImage(src, 0, y * k, src.width, h * k, dx, y, S, h + 1);
    }
    gr.globalCompositeOperation = 'copy';
    gr.drawImage(A, 0, 0);
    gr.globalCompositeOperation = 'multiply';
    gr.fillStyle = '#f00';
    gr.fillRect(0, 0, S, S);
    go.globalCompositeOperation = 'copy';
    go.drawImage(A, 0, 0);
    go.globalCompositeOperation = 'multiply';
    go.fillStyle = '#0ff';
    go.fillRect(0, 0, S, S);
    go.globalCompositeOperation = 'lighter';
    go.drawImage(R, -S * 0.012 * amt - 1, 0);
    go.globalCompositeOperation = 'screen';
    const tex = noiseTexture();
    go.globalAlpha = clamp(0.55 * amt, 0, 1);
    go.drawImage(tex, rand(0, 40), rand(0, 12), 120, 36, -S * 0.1, band, S * 1.2, bh * 0.6);
    go.globalAlpha = clamp(0.4 * amt, 0, 1);
    go.drawImage(tex, rand(0, 40), rand(0, 12), 120, 36, 0, S - h * 1.2, S, h * 1.2);
    go.globalAlpha = 0.8;
    go.fillStyle = '#fff';
    for (let i = 0; i < 6 * amt; i++) go.fillRect(rand(-S * 0.2, S), rand(0, S), rand(S * 0.05, S * 0.4), 1);
    go.globalAlpha = 1;
    go.globalCompositeOperation = 'source-over';
    return O;
  }

  function arrows(ctx, x, y, s, dir, n) {
    for (let i = 0; i < n; i++) {
      const ox = x + i * s * 0.9 * (dir < 0 ? 1 : 0);
      ctx.beginPath();
      ctx.moveTo(ox + (dir < 0 ? s : 0), y - s * 0.55);
      ctx.lineTo(ox + (dir < 0 ? 0 : s), y);
      ctx.lineTo(ox + (dir < 0 ? s : 0), y + s * 0.55);
      ctx.closePath();
      ctx.fill();
    }
  }

  function osd(ctx, draw) {
    ctx.fillStyle = 'rgba(255,40,80,0.8)';
    draw(-C * 0.004);
    ctx.fillStyle = 'rgba(40,220,255,0.8)';
    draw(C * 0.004);
    ctx.fillStyle = '#fff';
    draw(0);
  }

  return {
    sound(a) {
      clunk(a, 0, 0.6);
      whir(a, GLITCH, Math.max(0.35, rewEnd - GLITCH));
      clunk(a, Math.max(rewEnd, GLITCH + 0.35), 0.6);
      tapeStart(a, holdEnd);
    },
    get done() { return t > dur; },
    update(dt) { t += dt; },
    source(e) {
      const ph = phase();
      if (ph === 4) return null;
      const past = ph < 3 ? e.history(ago()) : null;
      return { canvas: vhs(past ? past.canvas : e.frame, amount()), face: past && past.face };
    },
    filter() {
      return phase() < 4 ? 'saturate(1.45) contrast(1.12) brightness(1.06)' : '';
    },
    draw() {},
    overlay(ctx) {
      const ph = phase();
      ctx.save();
      if (ph < 4) {
        if (!lines) {
          const [p, pg] = canvas(Math.max(3, Math.round(C / 160)));
          pg.fillStyle = 'rgba(0,0,0,0.42)';
          pg.fillRect(0, 0, p.width, Math.ceil(p.width / 3));
          lines = ctx.createPattern(p, 'repeat');
        }
        ctx.fillStyle = lines;
        ctx.fillRect(0, 0, C, C);
        const bar = ((t * 0.55) % 1.2 - 0.1) * C;
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(0, bar, C, C * 0.12);
        ctx.globalCompositeOperation = 'source-over';
      }
      const size = C * 0.075;
      const fade = ph === 4 ? clamp((dur - t) / 0.25, 0, 1) : 1;
      const show = ph !== 2 || Math.floor(t * 8) % 2 === 0;
      ctx.globalAlpha = fade;
      if (show) {
        if (ph < 3) osd(ctx, (o) => arrows(ctx, C * 0.17 + o, C * 0.25, size, -1, 2));
        else osd(ctx, (o) => arrows(ctx, C * 0.17 + o, C * 0.25, size, 1, 1));
      }
      const rew = ph === 0 ? 0 : ph === 1 ? (t - GLITCH) * SPEED : tape;
      const sec = Math.max(0, counter0 - Math.round(rew * 6) + (ph >= 3 ? Math.floor(t - holdEnd) : 0));
      const label = `${Math.floor(sec / 3600)}:${String(Math.floor(sec / 60) % 60).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
      ctx.font = `700 ${C * 0.056}px "VCR OSD Mono", ui-monospace, "Courier New", monospace`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      osd(ctx, (o) => ctx.fillText(label, C * 0.8 + o, C * 0.79));
      ctx.restore();
    },
  };
}

export default { id: 'rewind', name: 'Перемотка', emoji: '⏪', make: rewind };
