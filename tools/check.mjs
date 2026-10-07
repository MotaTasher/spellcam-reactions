// Проверка реакций: каждая запускается на мультяшном лице, не должна ронять
// страницу, должна закончиться за 15 секунд и не тормозить кадр.
//   python3 server.py &   и   CHROME=/путь/к/chrome node tools/check.mjs [id …]
import puppeteer from 'puppeteer-core';
import { readFileSync, readdirSync } from 'node:fs';

const chrome = process.env.CHROME;
const url = (process.env.URL || 'http://127.0.0.1:8765/') + '?out=checkroom&video=docs/demo/cartoon.webm';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const fail = (msg) => { failed++; console.log('✗', msg); };

const index = readFileSync('effects/index.js', 'utf8');
for (const f of readdirSync('effects')) {
  if (!f.endsWith('.js') || f === 'index.js' || f === 'lib.js' || f.startsWith('_')) continue;
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
for (const m of meta) {
  if (seen.has(m.id)) fail(`повторяется id «${m.id}»`);
  seen.add(m.id);
  if (!/^[a-z0-9_-]{1,32}$/.test(m.id)) fail(`id «${m.id}»: только a-z, 0-9, _ и -, до 32 символов`);
  if (!m.name || !m.emoji) fail(`«${m.id}»: нужны name и emoji`);
  if (!m.make) fail(`«${m.id}»: нет make`);
}

for (const id of ids) {
  if (!seen.has(id)) { fail(`нет реакции «${id}»`); continue; }
  errors.length = 0;
  const r = await page.evaluate(async (id) => {
    const t0 = performance.now();
    window.__fx.fire(id);
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
  }, id);
  if (errors.length) fail(`«${id}»: ошибка на странице: ${errors[0]}`);
  else if (r.still) fail(`«${id}»: не закончилась за 15 секунд (done так и не стал true)`);
  else console.log(`✓ ${id}: ${r.secs.toFixed(1)} с, ${r.fps.toFixed(0)} fps, худший кадр ${r.worst.toFixed(0)} мс`);
  await sleep(300);
}
await browser.close();
if (failed) {
  console.log(`\nПроблем: ${failed}`);
  process.exit(1);
}
