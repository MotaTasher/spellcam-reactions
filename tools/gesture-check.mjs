// Проверка жестов: вместо камеры видео из фото-примеров MediaPipe (жест 2 с,
// пустой кадр 1 с), и реакции должны сработать от жестов по порядку, по одной на жест.
//   python3 server.py &   и   CHROME=/путь/к/chrome node tools/gesture-check.mjs
// Фото не лежат в репе: скрипт скачивает их в vendor/gestures/ и собирает оттуда
// vendor/gestures/gestures.webm (нужен ffmpeg). Модель жестов страница грузит сама:
// из vendor/mediapipe/, если там есть (./tools/vendor.sh), иначе из storage.googleapis.com.
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const GR = 'https://storage.googleapis.com/mediapipe-tasks/gesture_recognizer/';
const ASSETS = 'https://storage.googleapis.com/mediapipe-assets/';
const SAMPLES = [
  { name: 'thumbs_up', url: GR + 'thumbs_up.jpg', gesture: 'Thumb_Up' },
  { name: 'victory', url: GR + 'victory.jpg', gesture: 'Victory' },
  { name: 'pointing_up', url: GR + 'pointing_up.jpg', gesture: 'Pointing_Up' },
  { name: 'thumbs_down', url: GR + 'thumbs_down.jpg', gesture: 'Thumb_Down' },
  { name: 'fist', url: ASSETS + 'fist.jpg', gesture: 'Closed_Fist' },
];
const LEAD = 1.5, HOLD = 2, GAP = 1, SIDE = 480, FPS = 30;
const DIR = 'vendor/gestures'; // поменяли SAMPLES — удалите папку, клип соберётся заново
const CLIP = `${DIR}/gestures.webm`;

async function buildClip() {
  if (existsSync(CLIP)) return;
  mkdirSync(DIR, { recursive: true });
  for (const s of SAMPLES) {
    const file = `${DIR}/${s.name}.jpg`;
    if (existsSync(file)) continue;
    const r = await fetch(s.url);
    if (!r.ok) throw new Error(`${s.url}: ${r.status}`);
    writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  }
  const black = (d) => `color=black:s=${SIDE}x${SIDE}:r=${FPS}:d=${d},format=yuv420p`;
  const parts = [`${black(LEAD)}[lead]`];
  const order = ['[lead]'];
  SAMPLES.forEach((s, i) => {
    parts.push(`[${i}:v]scale=${SIDE}:${SIDE}:force_original_aspect_ratio=decrease:out_range=tv,pad=${SIDE}:${SIDE}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${FPS},format=yuv420p[g${i}]`);
    parts.push(`${black(GAP)}[b${i}]`);
    order.push(`[g${i}]`, `[b${i}]`);
  });
  parts.push(`${order.join('')}concat=n=${order.length}:v=1:a=0[out]`);
  // JPEG даёт полный диапазон яркости, а такой VP9 Chrome иногда не декодирует: out_range=tv.
  const inputs = SAMPLES.flatMap((s) => ['-loop', '1', '-framerate', String(FPS), '-t', String(HOLD), '-i', `${DIR}/${s.name}.jpg`]);
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', parts.join(';'), '-map', '[out]',
    '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '36', '-deadline', 'realtime', '-cpu-used', '8', '-g', String(FPS), '-color_range', 'tv', CLIP], { stdio: 'inherit' });
}

await buildClip();

const chrome = process.env.CHROME;
const url = (process.env.URL || 'http://127.0.0.1:8765/') + `?out=gesturecheck&video=${CLIP}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', ...(process.env.CI ? ['--no-sandbox'] : [])] });
const page = await browser.newPage();
await page.setViewport({ width: 480, height: 480 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.text().startsWith('worker:')) console.log('  ', m.text()); });
const t0 = Date.now();
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__fx && window.__fx.gestures, { timeout: 30000 });
try {
  await page.waitForFunction(() => window.__fx.gestures.ready, { timeout: 90000, polling: 100 });
} catch (e) {
  console.log('✗ распознавание жестов не запустилось за 90 с', await page.evaluate(() => window.__fx.gestures));
  await browser.close();
  process.exit(1);
}
console.log(`жесты готовы через ${((Date.now() - t0) / 1000).toFixed(1)} с после открытия страницы`);
await sleep(2200);

const meta = await page.evaluate(() => window.__fx.meta);
const byGesture = Object.fromEntries(meta.filter((m) => m.gesture).map((m) => [m.gesture, m.id]));
const total = LEAD + SAMPLES.length * (HOLD + GAP);

const run = await page.evaluate(async (total) => {
  const v = document.querySelector('#cam');
  v.currentTime = 0;
  await new Promise((res) => setTimeout(res, 100));
  const prev = { ...window.__fx.gestures.castAt };
  const casts = [];
  let frames = 0, worst = 0, last = performance.now(), lastT = 0;
  const start = performance.now();
  while (performance.now() - start < (total + 10) * 1000) {
    await new Promise((res) => requestAnimationFrame(res));
    const now = performance.now();
    worst = Math.max(worst, now - last);
    last = now;
    frames++;
    const g = window.__fx.gestures;
    for (const [k, at] of Object.entries(g.castAt)) {
      if (prev[k] !== at) {
        prev[k] = at;
        casts.push({ gesture: k, t: v.currentTime, active: window.__fx.active, hand: g.hand && { x: Math.round(g.hand.x), y: Math.round(g.hand.y), size: Math.round(g.hand.size) } });
      }
    }
    if (v.currentTime < lastT - 1) break;
    lastT = v.currentTime;
  }
  const secs = (performance.now() - start) / 1000;
  return { casts, fps: frames / secs, worst, perf: { face: window.__perf.face, hand: window.__perf.hand } };
}, total);

let failed = 0;
const fail = (msg) => { failed++; console.log('✗', msg); };
if (errors.length) fail(`ошибка на странице: ${errors[0]}`);
const casts = [...run.casts];
SAMPLES.forEach((s, i) => {
  const from = LEAD + i * (HOLD + GAP), to = from + HOLD + 0.5;
  const want = byGesture[s.gesture];
  const mine = casts.filter((c) => c.t >= from && c.t < to);
  for (const c of mine) casts.splice(casts.indexOf(c), 1);
  if (!want) return fail(`${s.name}: жест ${s.gesture} не привязан ни к одной реакции`);
  const hit = mine.find((c) => c.gesture === s.gesture);
  if (!hit) return fail(`${s.name}: ждали ${s.gesture} → ${want}, сработало: ${mine.map((c) => c.gesture).join(', ') || 'ничего'}`);
  if (!hit.active.includes(want)) fail(`${s.name}: жест распознан, но реакции ${want} нет среди активных`);
  if (mine.length > 1) fail(`${s.name}: за один жест сработало ${mine.length} раз: ${mine.map((c) => c.gesture).join(', ')}`);
  else console.log(`✓ ${s.name}: ${s.gesture} → ${want} через ${(hit.t - from).toFixed(2)} с, рука ${JSON.stringify(hit.hand)}`);
});
for (const c of casts) fail(`лишнее срабатывание ${c.gesture} на ${c.t.toFixed(2)} с видео (в паузе между жестами)`);
console.log(`кадр: ${run.fps.toFixed(0)} fps, худший ${run.worst.toFixed(0)} мс; лицо ${run.perf.face.toFixed(1)} мс, рука ${run.perf.hand.toFixed(1)} мс в воркере`);
await browser.close();
if (failed) {
  console.log(`\nПроблем: ${failed}`);
  process.exit(1);
}
