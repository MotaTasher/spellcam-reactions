import { TAU, rand, pick, envelope, drawGlow, emojiSprite } from './lib.js';
import { cash } from './sfx.js';

function money(env) {
  const C = env.C;
  let t = 0;
  let items = [];
  let emitted = 0;
  const total = 70;
  const dur = 3.2;
  const set = ['💸', '💵', '💵', '💰', '🤑', '💎'];
  return {
    sound(a) { cash(a); cash(a, 0.55); },
    get done() { return t > dur && !items.length; },
    update(dt) {
      t += dt;
      const want = Math.min(total, Math.floor((t / dur) * total));
      while (emitted < want) {
        const coin = Math.random() < 0.35;
        items.push({
          coin, ch: pick(set), x: rand(0, 1) * C, y: -C * 0.1,
          vy: C * rand(0.35, 0.65), s: C * (coin ? rand(0.04, 0.06) : rand(0.07, 0.12)),
          rot: rand(0, TAU), vr: rand(-3, 3), flip: rand(0, TAU), vf: rand(5, 10), ph: rand(0, TAU),
        });
        emitted++;
      }
      for (const m of items) {
        m.y += m.vy * dt;
        m.x += Math.sin(t * 2 + m.ph) * C * 0.05 * dt;
        m.rot += m.vr * dt;
        m.flip += m.vf * dt;
      }
      items = items.filter((m) => m.y < C + m.s * 2);
    },
    draw(ctx) {
      ctx.save();
      const a = envelope(t, dur + 1, 0.4, 0.8);
      const vg = ctx.createRadialGradient(C / 2, C / 2, C * 0.3, C / 2, C / 2, C * 0.75);
      vg.addColorStop(0, 'rgba(255,200,40,0)');
      vg.addColorStop(1, `rgba(255,190,30,${0.35 * a})`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, C, C);
      for (const m of items) {
        ctx.setTransform(1, 0, 0, 1, m.x, m.y);
        if (m.coin) {
          const cf = Math.cos(m.flip);
          ctx.globalCompositeOperation = 'lighter';
          if (cf > 0.85) drawGlow(ctx, 0, 0, m.s * 1.6, 45, 0.8);
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 1;
          ctx.scale(Math.max(0.06, Math.abs(cf)), 1);
          const g = ctx.createLinearGradient(-m.s, -m.s, m.s, m.s);
          g.addColorStop(0, '#fff3a8');
          g.addColorStop(0.5, '#ffc62a');
          g.addColorStop(1, '#b97a00');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(0, 0, m.s * 0.5, 0, TAU);
          ctx.fill();
          ctx.strokeStyle = '#9a6400';
          ctx.lineWidth = m.s * 0.06;
          ctx.stroke();
          ctx.fillStyle = '#9a6400';
          ctx.font = `900 ${m.s * 0.55}px system-ui,sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('$', 0, m.s * 0.03);
        } else {
          ctx.globalAlpha = 1;
          ctx.rotate(m.rot * 0.3);
          ctx.drawImage(emojiSprite(m.ch), -m.s / 2, -m.s / 2, m.s, m.s);
        }
      }
      ctx.restore();
    },
  };
}

export default { id: 'money', name: 'Деньги', emoji: '💸', make: money };
