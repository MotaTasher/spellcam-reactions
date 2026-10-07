import { TAU, rand, clamp, easeOutBack, drawGlow, heart, faceOrDefault } from './lib.js';

function ogo(env) {
  const C = env.C;
  const dur = 3.2;
  let t = 0;
  let minis = [];
  let emitT = 0;

  function eyesOf(e) {
    const f = faceOrDefault(e);
    const ed = Math.hypot(f.eyes[1].x - f.eyes[0].x, f.eyes[1].y - f.eyes[0].y) || C * 0.16;
    return { f, ed };
  }

  function drawHeart(ctx, x, y, size, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(size, size);
    const g = ctx.createLinearGradient(0, -0.5, 0, 0.5);
    g.addColorStop(0, '#ff6b8a');
    g.addColorStop(1, '#d5002f');
    ctx.fillStyle = g;
    ctx.fill(heart());
    ctx.lineWidth = 0.07;
    ctx.strokeStyle = '#6e0018';
    ctx.stroke(heart());
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.ellipse(-0.22, -0.2, 0.1, 0.06, -0.6, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  return {
    get done() { return t > dur && !minis.length; },
    update(dt, e) {
      t += dt;
      emitT -= dt;
      if (t < dur - 0.4 && emitT <= 0) {
        emitT = 0.12;
        const { f, ed } = eyesOf(e);
        const eye = f.eyes[(Math.random() * 2) | 0];
        minis.push({ x: eye.x + rand(-ed * 0.3, ed * 0.3), y: eye.y, vy: -C * rand(0.12, 0.25), s: ed * rand(0.2, 0.35), life: 1, ph: rand(0, TAU) });
      }
      for (const m of minis) {
        m.y += m.vy * dt;
        m.life -= dt * 0.9;
      }
      minis = minis.filter((m) => m.life > 0);
    },
    draw(ctx, e) {
      const { f, ed } = eyesOf(e);
      const pop = t < 0.35 ? easeOutBack(t / 0.35) : 1;
      const fade = clamp((dur - t) / 0.35, 0, 1);
      const beat = 1 + 0.14 * Math.pow(Math.max(0, Math.sin(t * TAU * 2.2)), 3);
      ctx.save();
      for (const m of minis) {
        ctx.globalAlpha = m.life;
        drawHeart(ctx, m.x + Math.sin(t * 5 + m.ph) * ed * 0.1, m.y, m.s, Math.sin(t * 3 + m.ph) * 0.3);
      }
      ctx.globalAlpha = fade;
      f.eyes.forEach((eye, i) => {
        const size = ed * 1.15 * pop * beat;
        ctx.globalCompositeOperation = 'lighter';
        drawGlow(ctx, eye.x, eye.y, size * 0.9, 345, 0.6 * fade);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = fade;
        drawHeart(ctx, eye.x, eye.y, size, (i ? 0.15 : -0.15) + Math.sin(t * 6) * 0.05);
      });

      if (t > 0.2) {
        const p = easeOutBack(clamp((t - 0.2) / 0.3, 0, 1));
        const cx = f.box.x + f.box.w / 2;
        const right = cx < C * 0.6;
        const rx = C * 0.17, ry = C * 0.095;
        const bx = right ? clamp(f.box.x + f.box.w + rx * 0.4, rx + C * 0.1, C - rx - C * 0.08) : clamp(f.box.x - rx * 0.4, rx + C * 0.08, C - rx - C * 0.1);
        const by = clamp(f.box.y - ry * 0.2, ry + C * 0.1, C * 0.5);
        const tipX = right ? f.box.x + f.box.w * 0.85 : f.box.x + f.box.w * 0.15;
        const tipY = f.box.y + f.box.h * 0.3;
        ctx.translate(bx, by);
        ctx.rotate(Math.sin(t * 7) * 0.04 + (right ? 0.08 : -0.08));
        ctx.scale(p, p);
        ctx.lineJoin = 'round';
        ctx.lineWidth = C * 0.009;
        ctx.strokeStyle = '#111';
        ctx.fillStyle = '#fff';
        const ax = (tipX - bx) * 0.55, ay = (tipY - by) * 0.55;
        ctx.beginPath();
        ctx.moveTo(-rx * 0.15 * Math.sign(ax || 1), ry * 0.6);
        ctx.lineTo(ax, ay);
        ctx.lineTo(rx * 0.25 * Math.sign(ax || 1), ry * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.font = `900 ${C * 0.085}px "Arial Black", Impact, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = C * 0.012;
        ctx.strokeStyle = '#111';
        ctx.strokeText('ОГО!', 0, C * 0.004);
        ctx.fillStyle = '#ff2a4a';
        ctx.fillText('ОГО!', 0, C * 0.004);
      }
      ctx.restore();
    },
  };
}

export default { id: 'ogo', name: 'ОГО!', emoji: '😍', face: true, make: ogo };
