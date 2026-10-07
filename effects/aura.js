import { rand, envelope, drawGlow } from './lib.js';
import { powerUp } from './sfx.js';

function aura(env) {
  const C = env.C;
  let t = 0;
  const dur = 6;
  let sparks = [];
  let bolts = [];
  let boltT = 0;
  let small = null;
  return {
    sound(a) { powerUp(a); },
    needsMask: true,
    get done() { return t > dur; },
    update(dt, e) {
      t += dt;
      const a = envelope(t, dur, 0.5, 0.6);
      if (e.edgePoint && a > 0.2) {
        for (let i = 0; i < 6; i++) {
          const p = e.edgePoint();
          if (p) sparks.push({ x: p.x, y: p.y, vx: rand(-20, 20), vy: -C * rand(0.25, 0.6), life: rand(0.4, 0.9), max: 0.9, hue: rand(38, 55) });
        }
        boltT -= dt;
        if (boltT <= 0) {
          boltT = rand(0.12, 0.35);
          const p = e.edgePoint();
          if (p) {
            const pts = [p];
            let x = p.x, y = p.y, ang = -Math.PI / 2 + rand(-0.8, 0.8);
            for (let i = 0; i < 7; i++) {
              ang += rand(-0.7, 0.7);
              x += Math.cos(ang) * C * 0.03;
              y += Math.sin(ang) * C * 0.03;
              pts.push({ x, y });
            }
            bolts.push({ pts, life: 0.14 });
          }
        }
      }
      for (const s of sparks) {
        s.x += s.vx * dt + Math.sin(s.life * 20) * 0.6;
        s.y += s.vy * dt;
        s.life -= dt;
      }
      sparks = sparks.filter((s) => s.life > 0);
      for (const b of bolts) b.life -= dt;
      bolts = bolts.filter((b) => b.life > 0);
    },
    base(ctx, e) {
      if (!e.mask) return;
      const a = envelope(t, dur, 0.5, 0.6);
      ctx.save();
      ctx.fillStyle = `rgba(8,4,30,${0.68 * a})`;
      ctx.fillRect(0, 0, C, C);
      const k = 4, W = Math.round(C / k);
      if (!small) {
        small = document.createElement('canvas');
        small.width = small.height = W;
      }
      const l = small.getContext('2d');
      l.globalCompositeOperation = 'source-over';
      l.setTransform(1, 0, 0, 1, 0, 0);
      l.clearRect(0, 0, W, W);
      l.filter = `blur(${(C * 0.028) / k}px)`;
      const cx = C / 2, cy = C * 0.7;
      for (const [s, dy] of [[1.06 + 0.025 * Math.sin(t * 11), 0], [1.1 + 0.03 * Math.sin(t * 7 + 1), -C * 0.04]]) {
        l.setTransform(s / k, 0, 0, s / k, (cx - cx * s) / k, (cy - cy * s + dy) / k);
        l.drawImage(e.mask, 0, 0);
      }
      l.setTransform(1, 0, 0, 1, 0, 0);
      l.filter = 'none';
      l.globalCompositeOperation = 'source-in';
      const g = l.createLinearGradient(0, 0, 0, W);
      g.addColorStop(0, `hsl(${52 + 6 * Math.sin(t * 5)},100%,72%)`);
      g.addColorStop(0.6, 'hsl(40,100%,58%)');
      g.addColorStop(1, 'hsl(22,100%,50%)');
      l.fillStyle = g;
      l.fillRect(0, 0, W, W);
      const L = small;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(L, 0, 0, C, C);
      ctx.drawImage(L, 0, 0, C, C);
      ctx.globalCompositeOperation = 'source-over';
      const P = e.layer(1), p = P.getContext('2d');
      p.globalCompositeOperation = 'source-over';
      p.clearRect(0, 0, C, C);
      p.drawImage(e.frame, 0, 0);
      p.globalCompositeOperation = 'destination-in';
      p.drawImage(e.mask, 0, 0);
      ctx.globalAlpha = a;
      ctx.drawImage(P, 0, 0);
      ctx.restore();
    },
    draw(ctx) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const s of sparks) drawGlow(ctx, s.x, s.y, C * 0.018, s.hue, s.life / s.max);
      ctx.globalAlpha = 1;
      ctx.lineJoin = 'round';
      for (const b of bolts) {
        for (const [lw, col] of [[C * 0.016, 'rgba(120,180,255,0.35)'], [C * 0.004, 'rgba(240,250,255,1)']]) {
          ctx.lineWidth = lw;
          ctx.strokeStyle = col;
          ctx.beginPath();
          b.pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
          ctx.stroke();
        }
      }
      ctx.restore();
    },
  };
}

export default { id: 'aura', name: 'Аура', emoji: '⚡', make: aura };
