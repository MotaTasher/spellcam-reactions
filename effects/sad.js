import { TAU, rand, clamp, envelope, faceOrDefault } from './lib.js';

function sad(env) {
  const C = env.C;
  let t = 0;
  const dur = 4.2;
  let drops = [];
  const puffs = [[-0.32, 0.05, 0.24], [-0.12, -0.1, 0.3], [0.12, -0.06, 0.28], [0.32, 0.06, 0.22], [0, 0.08, 0.3]];
  let cloud = null;
  return {
    get done() { return t > dur; },
    filter() {
      const a = envelope(t, dur, 0.4, 0.5);
      return `grayscale(${0.85 * a}) brightness(${1 - 0.18 * a}) contrast(${1 + 0.05 * a})`;
    },
    update(dt, e) {
      t += dt;
      const f = faceOrDefault(e);
      const w = clamp(f.box.w * 1.15, C * 0.26, C * 0.46);
      const target = { x: f.box.x + f.box.w / 2, y: Math.max(f.box.y - w * 0.28, w * 0.22), w };
      if (!cloud) cloud = { ...target, y: -C * 0.25 };
      const k = 1 - Math.exp(-6 * dt);
      cloud.x += (target.x - cloud.x) * k;
      cloud.y += (target.y - cloud.y) * k;
      cloud.w += (target.w - cloud.w) * k;
      if (t > 0.4 && t < dur - 0.5) {
        for (let i = 0; i < 3; i++) drops.push({ x: cloud.x + rand(-0.4, 0.4) * cloud.w, y: cloud.y + cloud.w * 0.1, v: C * rand(1.0, 1.4) });
      }
      for (const d of drops) d.y += d.v * dt;
      drops = drops.filter((d) => d.y < C + 20);
    },
    draw(ctx) {
      const a = envelope(t, dur, 0.4, 0.5);
      ctx.save();
      ctx.fillStyle = `rgba(25,55,110,${0.22 * a})`;
      ctx.fillRect(0, 0, C, C);
      ctx.globalAlpha = 0.75 * a;
      ctx.strokeStyle = 'rgba(180,210,255,1)';
      ctx.lineWidth = C * 0.004;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (const d of drops) {
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - C * 0.004, d.y - C * 0.035);
      }
      ctx.stroke();
      if (cloud) {
        const bob = Math.sin(t * 2.2) * C * 0.006;
        ctx.globalAlpha = a;
        for (const [px, py, r] of puffs) {
          const x = cloud.x + px * cloud.w, y = cloud.y + py * cloud.w + bob, R = r * cloud.w;
          const g = ctx.createRadialGradient(x - R * 0.3, y - R * 0.4, R * 0.1, x, y, R);
          g.addColorStop(0, '#9aa3b0');
          g.addColorStop(1, '#4b525e');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, R, 0, TAU);
          ctx.fill();
        }
      }
      if (t > 0.7) {
        ctx.globalAlpha = clamp((t - 0.7) / 0.4, 0, 1) * a;
        ctx.font = `italic 600 ${C * 0.075}px Georgia, "Times New Roman", serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = C * 0.02;
        ctx.fillText('мда.', C / 2, C * 0.86);
      }
      ctx.restore();
    },
  };
}

export default { id: 'sad', face: true, name: 'Грусть', emoji: '🌧️', make: sad };
