// Проверка жестов: вместо камеры видео из фото (кусок с жестом, потом пустой кадр 1 с),
// и реакции должны сработать по порядку, сколько надо раз и ничего лишнего.
//   python3 server.py &   и   CHROME=/путь/к/chrome node tools/gesture-check.mjs
// Фото не лежат в репе: скрипт скачивает их в vendor/gestures/ и собирает оттуда
// видео (нужен ffmpeg). Это примеры MediaPipe и два фото с Wikimedia Commons
// (CC BY-SA 4.0: «Hand heart.JPG» — Dylan.cronk, «ASL ILY@Side-PalmForward.jpg» — Rodasmith).
// Кулак из того же фото отражён (другая рука), «стучит» (фото рывками
// приближается: +25 % за 0,13 с и обратно) и медленно наезжает (это не стук).
// Модель жестов страница грузит сама: из vendor/mediapipe/, если там есть
// (./tools/vendor.sh), иначе из storage.googleapis.com.
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const GR = 'https://storage.googleapis.com/mediapipe-tasks/gesture_recognizer/';
const ASSETS = 'https://storage.googleapis.com/mediapipe-assets/';
const WIKI = 'https://commons.wikimedia.org/wiki/Special:FilePath/';
const PHOTOS = {
  thumbs_up: GR + 'thumbs_up.jpg',
  victory: GR + 'victory.jpg',
  pointing_up: GR + 'pointing_up.jpg',
  thumbs_down: GR + 'thumbs_down.jpg',
  fist: ASSETS + 'fist.jpg',
  hand_heart: WIKI + 'Hand_heart.JPG?width=800',
  ily: WIKI + 'ASL_ILY@Side-PalmForward.jpg?width=800',
};
// Стук: 0,6 с кулак неподвижен (большой БАХ), потом 5 ударов раз в 0,4 с.
const KNOCK = { start: 0.6, period: 0.4, rise: 0.13, fall: 0.17, n: 5, amp: 0.25 };
const T = 'on/30';
const P = `mod(${T}-${KNOCK.start},${KNOCK.period})`;
const knockZoom = `1+${KNOCK.amp}*if(between(${T},${KNOCK.start},${KNOCK.start + KNOCK.n * KNOCK.period}),if(lt(${P},${KNOCK.rise}),${P}/${KNOCK.rise},if(lt(${P},${KNOCK.rise + KNOCK.fall}),1-(${P}-${KNOCK.rise})/${KNOCK.fall},0)),0)`;
const slowZoom = `if(lt(${T},0.3),1,if(lt(${T},1.5),1+0.35*(${T}-0.3)/1.2,1.35))`;
const SEGMENTS = [
  { name: 'thumbs_up', photo: 'thumbs_up', want: { Thumb_Up: 1 } },
  { name: 'victory', photo: 'victory', want: { Victory: 1 } },
  { name: 'pointing_up', photo: 'pointing_up', want: { Pointing_Up: 1 } },
  { name: 'thumbs_down', photo: 'thumbs_down', want: { Thumb_Down: 1 } },
  { name: 'fist', photo: 'fist', want: { Closed_Fist: 1 } },
  { name: 'fist_other_hand', photo: 'fist', flip: true, want: { Closed_Fist: 1 } },
  { name: 'hand_heart', photo: 'hand_heart', want: { Heart: 1 } },
  { name: 'ily', photo: 'ily', want: { ILoveYou: 1 }, max: 1 },
  { name: 'knock', photo: 'fist', zoom: knockZoom, hold: KNOCK.start + KNOCK.n * KNOCK.period + 0.4, want: { Closed_Fist: 1, Knock: KNOCK.n - 1 },
    impacts: Array.from({ length: KNOCK.n }, (_, i) => KNOCK.start + i * KNOCK.period + KNOCK.rise) },
  { name: 'fist_slow_approach', photo: 'fist', zoom: slowZoom, want: { Closed_Fist: 1 } },
];
const LEAD = 1.5, HOLD = 2, GAP = 1, SIDE = 480, FPS = 30;
// Сколько можно ждать: первая реакция куска — не позже MAX с (до этой ветки было 0,3–0,5 с
// на этих фото), БАХ от стука — не позже KNOCK_LAG с после удара.
const MAX = 0.8, KNOCK_LAG = 0.35;
const DIR = 'vendor/gestures';
const spec = createHash('sha1').update(JSON.stringify({ SEGMENTS, PHOTOS, LEAD, HOLD, GAP, SIDE, FPS })).digest('hex').slice(0, 8);
const CLIP = `${DIR}/gestures-${spec}.webm`;
const UA = { 'User-Agent': 'spellcam-reactions gesture-check (https://github.com/MotaTasher/spellcam-reactions)' };
const holdOf = (s) => s.hold ?? HOLD;

async function buildClip() {
  if (existsSync(CLIP)) return;
  mkdirSync(DIR, { recursive: true });
  for (const [name, url] of Object.entries(PHOTOS)) {
    const file = `${DIR}/${name}.jpg`;
    if (existsSync(file)) continue;
    const r = await fetch(url, { headers: UA });
    if (!r.ok) throw new Error(`${url}: ${r.status}`);
    writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  }
  const black = (d) => `color=black:s=${SIDE}x${SIDE}:r=${FPS}:d=${d},format=yuv420p`;
  const parts = [`${black(LEAD)}[lead]`];
  const order = ['[lead]'];
  SEGMENTS.forEach((s, i) => {
    const zoom = s.zoom ? `,zoompan=z='${s.zoom}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${SIDE}x${SIDE}:fps=${FPS}` : '';
    parts.push(`[${i}:v]${s.flip ? 'hflip,' : ''}scale=${SIDE}:${SIDE}:force_original_aspect_ratio=decrease:out_range=tv,pad=${SIDE}:${SIDE}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${FPS}${zoom},format=yuv420p[g${i}]`);
    parts.push(`${black(GAP)}[b${i}]`);
    order.push(`[g${i}]`, `[b${i}]`);
  });
  parts.push(`${order.join('')}concat=n=${order.length}:v=1:a=0[out]`);
  // JPEG даёт полный диапазон яркости, а такой VP9 Chrome иногда не декодирует: out_range=tv.
  const inputs = SEGMENTS.flatMap((s) => ['-loop', '1', '-framerate', String(FPS), '-t', String(holdOf(s)), '-i', `${DIR}/${s.photo}.jpg`]);
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
const bySpell = {};
for (const m of meta) for (const g of [].concat(m.gesture ?? [])) bySpell[g] = m.id;
const total = LEAD + SEGMENTS.reduce((a, s) => a + holdOf(s) + GAP, 0);

const run = await page.evaluate(async (total) => {
  const v = document.querySelector('#cam');
  v.currentTime = 0;
  await new Promise((res) => setTimeout(res, 100));
  let seen = window.__fx.gestures.log.length;
  const casts = [];
  const hands = [0, 1, 2].map(() => ({ ms: 0, n: 0, msgs: 0, secs: 0 }));
  let frames = 0, worst = 0, last = performance.now(), lastT = 0, lastHn = window.__perf.hn;
  const start = performance.now();
  while (performance.now() - start < (total + 10) * 1000) {
    await new Promise((res) => requestAnimationFrame(res));
    const now = performance.now();
    const dt = now - last;
    worst = Math.max(worst, dt);
    last = now;
    frames++;
    const g = window.__fx.gestures;
    const k = g.hands.length;
    if (hands[k]) {
      hands[k].ms += window.__perf.hand;
      hands[k].n++;
      hands[k].msgs += window.__perf.hn - lastHn;
      hands[k].secs += dt / 1000;
    }
    lastHn = window.__perf.hn;
    for (; seen < g.log.length; seen++) {
      const e = g.log[seen];
      casts.push({ spell: e.spell, t: v.currentTime - (now - e.t) / 1000, active: window.__fx.active, hand: g.hand && { x: Math.round(g.hand.x), y: Math.round(g.hand.y), size: Math.round(g.hand.size) } });
    }
    if (v.currentTime < lastT - 1) break;
    lastT = v.currentTime;
  }
  const secs = (performance.now() - start) / 1000;
  return { casts, fps: frames / secs, worst, hands, perf: { face: window.__perf.face } };
}, total);

let failed = 0;
const fail = (msg) => { failed++; console.log('✗', msg); };
if (errors.length) fail(`ошибка на странице: ${errors[0]}`);
const casts = [...run.casts];
let from = LEAD;
for (const s of SEGMENTS) {
  const to = from + holdOf(s) + 0.5;
  const mine = casts.filter((c) => c.t >= from && c.t < to);
  for (const c of mine) casts.splice(casts.indexOf(c), 1);
  const got = {};
  for (const c of mine) got[c.spell] = (got[c.spell] || 0) + 1;
  const wantTxt = Object.entries(s.want).map(([k, n]) => `${k}×${n}`).join(' ');
  const gotTxt = Object.entries(got).map(([k, n]) => `${k}×${n}`).join(' ') || 'ничего';
  const unbound = Object.keys(s.want).filter((k) => !bySpell[k]);
  const segStart = from;
  from = to - 0.5 + GAP;
  if (unbound.length) { fail(`${s.name}: жест ${unbound.join(', ')} не привязан ни к одной реакции`); continue; }
  const same = Object.keys({ ...got, ...s.want }).every((k) => (got[k] || 0) === (s.want[k] || 0));
  if (!same) { fail(`${s.name}: ждали ${wantTxt}, сработало: ${gotTxt}`); continue; }
  const missing = mine.filter((c) => !c.active.includes(bySpell[c.spell]));
  if (missing.length) { fail(`${s.name}: ${missing[0].spell} распознан, но реакции ${bySpell[missing[0].spell]} нет среди активных`); continue; }
  const first = mine[0];
  if (first.t - segStart > (s.max ?? MAX)) { fail(`${s.name}: ${first.spell} сработал через ${(first.t - segStart).toFixed(2)} с, ждали не дольше ${s.max ?? MAX} с`); continue; }
  let extra = '';
  if (s.impacts) {
    const lags = mine.filter((c) => c.spell === 'Knock').map((c) => {
      const t = c.t - segStart;
      const hit = s.impacts.filter((x) => x <= t + 0.02).pop();
      return Math.round((t - hit) * 1000);
    });
    if (lags.some((v) => !(v >= 0 && v <= KNOCK_LAG * 1000))) { fail(`${s.name}: БАХ от стука запаздывает: ${lags.join(', ')} мс после удара`); continue; }
    extra = `, стук: запаздывание ${lags.join(', ')} мс после удара`;
  }
  console.log(`✓ ${s.name}: ${gotTxt} → ${[...new Set(mine.map((c) => bySpell[c.spell]))].join(', ')} через ${(first.t - segStart).toFixed(2)} с${extra}, рука ${JSON.stringify(first.hand)}`);
}
for (const c of casts) fail(`лишнее срабатывание ${c.spell} на ${c.t.toFixed(2)} с видео (в паузе между жестами)`);
const hs = (k) => {
  const h = run.hands[k];
  const name = ['без рук', 'одна рука', 'две руки'][k];
  return h.n ? `${name} ${(h.ms / h.n).toFixed(1)} мс, ${(h.msgs / h.secs).toFixed(1)} раз/с` : `${name} не было`;
};
console.log(`кадр: ${run.fps.toFixed(0)} fps, худший ${run.worst.toFixed(0)} мс; лицо ${run.perf.face.toFixed(1)} мс; руки в воркере: ${hs(0)}; ${hs(1)}; ${hs(2)}`);
await browser.close();
if (failed) {
  console.log(`\nПроблем: ${failed}`);
  process.exit(1);
}
