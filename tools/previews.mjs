// Анимированные превью реакций для README: docs/previews/<id>.gif.
//   python3 server.py &   и   CHROME=/путь/к/chrome node tools/previews.mjs [id …]
// Камера подменяется видео docs/demo/cartoon.webm (мультяшное лицо).
// Реакции со временем (хук source: повтор, стоп-кадр, перемотка) пишутся целиком
// и с секундой живого кадра до нажатия, иначе в превью не видно, что что-то вернулось.
import puppeteer from 'puppeteer-core';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const chrome = process.env.CHROME;
const url = (process.env.URL || 'http://127.0.0.1:8765/') + '?out=previewroom&video=docs/demo/cartoon.webm';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', ...(process.env.CI ? ['--no-sandbox'] : [])] });
const page = await browser.newPage();
await page.setViewport({ width: 480, height: 480 });
await page.goto(url, { waitUntil: 'load' });
await sleep(6000);
console.log('face:', !!(await page.evaluate(() => window.__fx.face)));
const ids = process.argv.slice(2).length ? process.argv.slice(2) : await page.evaluate(() => window.__fx.ids);
mkdirSync('docs/previews', { recursive: true });
for (const id of ids) {
  const dir = `screenshots/frames-${id}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const frames = await page.evaluate(async (id) => {
    const src = document.querySelector('#out');
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 320;
    const c = canvas.getContext('2d');
    const out = [];
    const snap = () => {
      c.fillStyle = '#0d0d12';
      c.fillRect(0, 0, 320, 320);
      c.save();
      c.beginPath();
      c.arc(160, 160, 156, 0, Math.PI * 2);
      c.clip();
      c.drawImage(src, 0, 0, 320, 320);
      c.restore();
      return canvas.toDataURL('image/jpeg', 0.92);
    };
    const timed = typeof window.__fx.make(id).source === 'function';
    const lead = timed ? 1200 : 0;
    const t0 = performance.now();
    let fired = false;
    for (;;) {
      const el = performance.now() - t0;
      if (!fired && el >= lead) { window.__fx.fire(id); fired = true; }
      if (timed ? (fired && !window.__fx.active.includes(id) && el > lead + 600) || el > 7000 : el >= 2600) break;
      const next = t0 + (out.length + 1) * (1000 / 15);
      out.push(snap());
      await new Promise((r) => setTimeout(r, Math.max(0, next - performance.now())));
    }
    return out;
  }, id);
  frames.forEach((d, i) => writeFileSync(`${dir}/${String(i).padStart(3, '0')}.jpg`, Buffer.from(d.split(',')[1], 'base64')));
  const n = frames.length;
  const fps = 15;
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', String(fps), '-i', `${dir}/%03d.jpg`,
    '-vf', 'scale=200:200:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4',
    '-loop', '0', `docs/previews/${id}.gif`]);
  rmSync(dir, { recursive: true, force: true });
  console.log(id, n, 'frames');
  await sleep(2500);
}
await browser.close();
