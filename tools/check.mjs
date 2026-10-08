// Проверка реакций: каждая запускается на мультяшном лице, не должна ронять
// страницу, должна закончиться за 15 секунд и не тормозить кадр. Реакция с жестом
// запускается ещё раз так, будто её вызвали рукой (make(env, hand)).
// Плюс движок прошлых кадров: env.history, хук source и реакции со временем,
// нажатые до того, как камера успела что-то запомнить.
//   python3 server.py &   и   CHROME=/путь/к/chrome node tools/check.mjs [id …]
import puppeteer from 'puppeteer-core';
import { readFileSync, readdirSync } from 'node:fs';

const chrome = process.env.CHROME;
const url = (process.env.URL || 'http://127.0.0.1:8765/') + '?out=checkroom&nogestures&video=docs/demo/cartoon.webm';
const GESTURES = ['Thumb_Up', 'Thumb_Down', 'Closed_Fist', 'Open_Palm', 'Victory', 'Pointing_Up', 'ILoveYou'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const fail = (msg) => { failed++; console.log('✗', msg); };

const index = readFileSync('effects/index.js', 'utf8');
for (const f of readdirSync('effects')) {
  if (!f.endsWith('.js') || f === 'index.js' || f === 'lib.js' || f === 'sfx.js' || f.startsWith('_')) continue;
  if (!index.includes(`'./${f}'`)) fail(`effects/${f} не подключён в effects/index.js`);
}

const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', ...(process.env.CI ? ['--no-sandbox'] : [])] });
const page = await browser.newPage();
await page.setViewport({ width: 480, height: 480 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__fx && window.__fx.ids, { timeout: 30000 });
await sleep(4000);

const meta = await page.evaluate(() => window.__fx.meta);
const ids = process.argv.slice(2).length ? process.argv.slice(2) : meta.map((m) => m.id);
const seen = new Set();
const spells = new Map();
for (const m of meta) {
  if (m.gesture !== undefined) {
    if (!GESTURES.includes(m.gesture)) fail(`«${m.id}»: gesture «${m.gesture}» — такого жеста нет, есть: ${GESTURES.join(', ')}`);
    else if (spells.has(m.gesture)) fail(`«${m.id}»: жест ${m.gesture} уже у реакции «${spells.get(m.gesture)}»`);
    else spells.set(m.gesture, m.id);
  }
  if (seen.has(m.id)) fail(`повторяется id «${m.id}»`);
  seen.add(m.id);
  if (!/^[a-z0-9_-]{1,32}$/.test(m.id)) fail(`id «${m.id}»: только a-z, 0-9, _ и -, до 32 символов`);
  if (!m.name || !m.emoji) fail(`«${m.id}»: нужны name и emoji`);
  if (!m.make) fail(`«${m.id}»: нет make`);
}

const play = (id, gesture) => page.evaluate(async (id, gesture) => {
  const C = document.querySelector('#out').width;
  const hand = gesture && { x: C * 0.7, y: C * 0.68, size: C * 0.2, gesture, wrist: { x: C * 0.72, y: C * 0.84 } };
  const t0 = performance.now();
  window.__fx.fire(id, hand);
  let frames = 0, worst = 0, last = performance.now();
  while (window.__fx.active.includes(id) && performance.now() - t0 < 15000) {
    await new Promise((res) => requestAnimationFrame(res));
    const now = performance.now();
    worst = Math.max(worst, now - last);
    last = now;
    frames++;
  }
  const secs = (performance.now() - t0) / 1000;
  return { secs, fps: frames / secs, worst, still: window.__fx.active.includes(id) };
}, id, gesture);

for (const id of ids) {
  if (!seen.has(id)) { fail(`нет реакции «${id}»`); continue; }
  errors.length = 0;
  const r = await play(id);
  if (errors.length) fail(`«${id}»: ошибка на странице: ${errors[0]}`);
  else if (r.still) fail(`«${id}»: не закончилась за 15 секунд (done так и не стал true)`);
  else console.log(`✓ ${id}: ${r.secs.toFixed(1)} с, ${r.fps.toFixed(0)} fps, худший кадр ${r.worst.toFixed(0)} мс`);
  const s = await page.evaluate(async (id) => {
    const inst = window.__fx.make(id);
    if (!inst.sound) return null;
    const rate = 44100, ac = new OfflineAudioContext(1, rate * 8, rate);
    try { inst.sound({ ac, out: ac.destination }); } catch (e) { return { error: String(e) }; }
    const buf = await ac.startRendering();
    const d = buf.getChannelData(0);
    let peak = 0, last = 0;
    for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; if (v > 0.002) last = i; }
    return { peak, secs: last / rate };
  }, id);
  if (s && s.error) fail(`«${id}»: звук падает: ${s.error}`);
  else if (s && s.secs < 0.05) fail(`«${id}»: звук есть, но тишина`);
  else if (s && s.secs > 6) fail(`«${id}»: звук длиннее 6 секунд (${s.secs.toFixed(1)} с)`);
  else if (s && s.peak > 1) fail(`«${id}»: звук клиппует (пик ${s.peak.toFixed(2)})`);
  else if (s) console.log(`  ♪ ${s.secs.toFixed(1)} с, пик ${s.peak.toFixed(2)}`);
  const gesture = meta.find((m) => m.id === id).gesture;
  if (gesture) {
    await sleep(300);
    errors.length = 0;
    const h = await play(id, gesture);
    if (errors.length) fail(`«${id}» от жеста: ошибка на странице: ${errors[0]}`);
    else if (h.still) fail(`«${id}» от жеста: не закончилась за 15 секунд`);
    else console.log(`  ${gesture}: ${h.secs.toFixed(1)} с, ${h.fps.toFixed(0)} fps, худший кадр ${h.worst.toFixed(0)} мс`);
  }
  await sleep(300);
}

// Прошлые кадры и хук source. Пробные эффекты подменяют кадр сплошным цветом:
// цвет в центре кадра должен смениться, лицо из подменённого кадра должны видеть
// остальные эффекты, а из двух подмен побеждает нажатая последней.
await page.waitForFunction(() => window.__fx.active.length === 0, { timeout: 20000 }).catch(() => {});
errors.length = 0;
const h = await page.evaluate(async () => {
  const fx = window.__fx;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const raf = () => new Promise((r) => requestAnimationFrame(r));
  const settle = async (ms) => { await wait(ms); await raf(); await raf(); };
  const now = fx.history(0), one = fx.history(1), far = fx.history(100);
  const res = { span: fx.span, now: now && now.ago, one: one && one.ago, far: far && far.ago, side: now && now.canvas.width, face: !!(one && one.face) };
  const solid = (color) => {
    const c = document.createElement('canvas');
    c.width = c.height = 8;
    const g = c.getContext('2d');
    g.fillStyle = color;
    g.fillRect(0, 0, 8, 8);
    return c;
  };
  const fake = { eyes: [{ x: 11, y: 22 }, { x: 33, y: 22 }], box: { x: 5, y: 6, w: 40, h: 50 } };
  const probe = (id, canvas, face, life) => ({ id, name: id, emoji: '·', make: () => {
    let t = 0;
    return { update(dt) { t += dt; }, draw() {}, get done() { return t > life; }, source: () => (face ? { canvas, face } : canvas) };
  } });
  let seen = null;
  const watcher = { id: 'probe-watch', name: 'watch', emoji: '·', make: () => {
    let t = 0;
    return { update(dt, env) { t += dt; seen = env.face; }, draw() {}, get done() { return t > 1.4; } };
  } };
  const out = document.querySelector('#out');
  const px = () => {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const g = c.getContext('2d');
    g.drawImage(out, out.width / 2, out.height / 2, 1, 1, 0, 0, 1, 1);
    return [...g.getImageData(0, 0, 1, 1).data].slice(0, 3);
  };
  fx.fire(probe('probe-red', solid('#f00'), null, 1.2));
  fx.fire(watcher);
  await settle(150);
  res.red = px();
  fx.fire(probe('probe-green', solid('#0f0'), fake, 0.4));
  await settle(150);
  res.green = px();
  res.seen = seen;
  await settle(500);
  res.back = px();
  await settle(900);
  res.after = fx.shown;
  return res;
});
const near = (a, b) => a && a.every((v, i) => Math.abs(v - b[i]) < 12);
const failedBefore = failed;
if (errors.length) fail(`история кадров: ошибка на странице: ${errors[0]}`);
if (!(h.span >= 2 && h.span <= 4.5)) fail(`история кадров: через 4 с видео помнится ${h.span} с (ждали 2–4,5)`);
if (!(h.now < 0.15)) fail(`история кадров: history(0) отстаёт на ${h.now} с`);
if (!(Math.abs(h.one - 1) < 0.1)) fail(`история кадров: history(1) вернул кадр ${h.one} с назад`);
if (!(Math.abs(h.far - h.span) < 0.01)) fail(`история кадров: history(100) должен вернуть самый старый кадр (${h.far} против ${h.span})`);
if (!near(h.red, [255, 0, 0])) fail(`source: кадр не подменился (в центре ${h.red})`);
if (!near(h.green, [0, 255, 0])) fail(`source: последний нажатый не победил (в центре ${h.green})`);
if (JSON.stringify(h.seen) !== JSON.stringify({ eyes: [{ x: 11, y: 22 }, { x: 33, y: 22 }], box: { x: 5, y: 6, w: 40, h: 50 } })) fail('source: остальные эффекты не видят лицо из подменённого кадра');
if (!near(h.back, [255, 0, 0])) fail(`source: после конца подмены не вернулась предыдущая (в центре ${h.back})`);
if (h.after) fail('source: подмена осталась после конца эффектов');
if (failed === failedBefore) console.log(`✓ история кадров: ${h.span.toFixed(1)} с, кадр ${h.side}px, лицо ${h.face ? 'запомнено' : 'нет'}; source подменяет кадр и лицо`);

// Реакции со временем, нажатые сразу после открытия страницы (камера ещё не готова,
// прошлого нет) и в первые доли секунды: не падают и заканчиваются.
const timed = await page.evaluate(() => window.__fx.ids.filter((id) => typeof window.__fx.make(id).source === 'function'));
if (timed.length) {
  const early = await browser.newPage();
  await early.setViewport({ width: 480, height: 480 });
  const earlyErrors = [];
  early.on('pageerror', (e) => earlyErrors.push(e.message));
  await early.goto(url, { waitUntil: 'load' });
  await early.waitForFunction(() => window.__fx && window.__fx.ids, { timeout: 30000 });
  const r = await early.evaluate(async (ids) => {
    const fx = window.__fx;
    const raf = () => new Promise((res) => requestAnimationFrame(res));
    const t0 = performance.now();
    const spans = [fx.span];
    for (const id of ids) fx.fire(id);
    while (fx.span === 0 && performance.now() - t0 < 15000) await raf();
    for (let i = 0; i < 3; i++) await raf();
    spans.push(fx.span);
    for (const id of ids) fx.fire(id);
    while (fx.active.some((id) => ids.includes(id)) && performance.now() - t0 < 30000) await raf();
    return { spans, still: fx.active.filter((id) => ids.includes(id)) };
  }, timed);
  await early.close();
  if (earlyErrors.length) fail(`реакции со временем без прошлого: ошибка на странице: ${earlyErrors[0]}`);
  else if (r.still.length) fail(`реакции со временем без прошлого не закончились: ${r.still.join(', ')}`);
  else console.log(`✓ без прошлого (${r.spans.map((v) => v.toFixed(2)).join(' и ')} с): ${timed.join(', ')}`);
}
await browser.close();
if (failed) {
  console.log(`\nПроблем: ${failed}`);
  process.exit(1);
}
