export const TAU = Math.PI * 2;
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const easeOutBack = (p) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
};
export const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3);
export const envelope = (t, dur, fin, fout) => clamp(Math.min(t / fin, (dur - t) / fout), 0, 1);

const glowCache = new Map();
export function glow(hue, sat = 100, light = 60) {
  const key = `${hue | 0}|${sat}|${light}`;
  let c = glowCache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.18, `hsla(${hue},${sat}%,${light + 15}%,0.95)`);
  gr.addColorStop(0.45, `hsla(${hue},${sat}%,${light}%,0.35)`);
  gr.addColorStop(1, `hsla(${hue},${sat}%,${light}%,0)`);
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  glowCache.set(key, c);
  return c;
}

export function drawGlow(ctx, x, y, r, hue, alpha = 1, sat, light) {
  ctx.globalAlpha = alpha;
  ctx.drawImage(glow(hue, sat, light), x - r, y - r, r * 2, r * 2);
}

const emojiCache = new Map();
export function emojiSprite(ch) {
  let c = emojiCache.get(ch);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.font = '100px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(ch, 64, 70);
  emojiCache.set(ch, c);
  return c;
}

let heartPath = null;
export function heart() {
  if (heartPath) return heartPath;
  const p = new Path2D();
  for (let i = 0; i <= 64; i++) {
    const t = (i / 64) * TAU;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    if (i === 0) p.moveTo(x / 32, y / 32 + 0.05);
    else p.lineTo(x / 32, y / 32 + 0.05);
  }
  p.closePath();
  heartPath = p;
  return p;
}

export function faceOrDefault(env) {
  const C = env.C;
  if (env.face) return env.face;
  return {
    eyes: [{ x: C * 0.42, y: C * 0.42 }, { x: C * 0.58, y: C * 0.42 }],
    box: { x: C * 0.3, y: C * 0.25, w: C * 0.4, h: C * 0.45 },
  };
}
