import { clamp, faceOrDefault } from './lib.js';
import { riff } from './sfx.js';

const GLASSES = (() => {
  const W = 25, rows = [];
  for (let y = 0; y < 6; y++) rows.push(new Array(W).fill('.'));
  for (let x = 0; x < W; x++) rows[0][x] = '#';
  const lens = (x0) => {
    for (let x = x0; x < x0 + 10; x++) rows[1][x] = rows[2][x] = '#';
    for (let x = x0 + 1; x < x0 + 9; x++) rows[3][x] = '#';
    for (let x = x0 + 2; x < x0 + 8; x++) rows[4][x] = '#';
    rows[1][x0 + 2] = rows[1][x0 + 3] = rows[2][x0 + 3] = 'w';
    rows[2][x0 + 4] = 'w';
  };
  lens(1);
  lens(14);
  rows[1][11] = rows[1][12] = rows[1][13] = '#';
  return rows;
})();

function dealWithIt(env) {
  const C = env.C;
  let t = 0;
  const dur = 4.6;
  const drop = 1.4;
  return {
    sound(a) { riff(a); },
    get done() { return t > dur; },
    update(dt) { t += dt; },
    draw(ctx, e) {
      const f = faceOrDefault(e);
      const [l, r] = [...f.eyes].sort((p, q) => p.x - q.x);
      const ed = Math.hypot(r.x - l.x, r.y - l.y) || C * 0.16;
      const ang = Math.atan2(r.y - l.y, r.x - l.x);
      const mx = (l.x + r.x) / 2, my = (l.y + r.y) / 2;
      const p = clamp(t / drop, 0, 1);
      const y = -C * 0.15 + (my - -C * 0.15) * p;
      const a = clamp((dur - t) / 0.35, 0, 1);
      const W = Math.max(ed * 3.3, f.box.w * 1.05), cell = W / GLASSES[0].length;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.setTransform(1, 0, 0, 1, mx, y);
      ctx.rotate(p < 1 ? 0 : ang);
      ctx.translate(-W / 2, -cell * 1.6);
      GLASSES.forEach((row, yy) => row.forEach((c, xx) => {
        if (c === '.') return;
        ctx.fillStyle = c === 'w' ? '#fff' : '#000';
        ctx.fillRect(xx * cell, yy * cell, cell + 0.6, cell + 0.6);
      }));
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (t > drop + 0.15) {
        ctx.font = `900 ${C * 0.085}px "Courier New", ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.lineJoin = 'round';
        ctx.lineWidth = C * 0.018;
        ctx.strokeStyle = '#000';
        ctx.strokeText('DEAL WITH IT', C / 2, C * 0.86);
        ctx.fillStyle = '#fff';
        ctx.fillText('DEAL WITH IT', C / 2, C * 0.86);
      }
      ctx.restore();
    },
  };
}

export default { id: 'deal', face: true, name: 'Очки', emoji: '😎', make: dealWithIt };
