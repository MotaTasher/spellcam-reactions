// Скриншоты эффектов без камеры: headless Chrome с подставной камерой.
//   npm i && npm start   (в другом терминале)
//   CHROME=/путь/к/chrome npm run shots [-- id1 id2 …]
// FAKE_VIDEO=face.y4m — своё видео вместо тестовой картинки Chrome
// (ffmpeg -loop 1 -i face.jpg -t 4 -r 15 -vf scale=-2:360,format=yuv420p face.y4m).
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const chrome = process.env.CHROME || {
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  linux: '/usr/bin/google-chrome',
  win32: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
}[process.platform];
const url = process.env.URL || 'http://127.0.0.1:8765/';
const args = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--enable-unsafe-swiftshader'];
if (process.env.FAKE_VIDEO) args.push(`--use-file-for-fake-video-capture=${process.env.FAKE_VIDEO}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync('screenshots', { recursive: true });
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args });
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 1000 });
page.on('pageerror', (e) => console.log('ошибка на странице:', e.message));
await page.goto(url, { waitUntil: 'load' });
await sleep(5000);
const ids = process.argv.slice(2).length ? process.argv.slice(2) : await page.evaluate(() => window.__fx.ids);
for (const id of ids) {
  await page.evaluate((id) => window.__fx.fire(id), id);
  for (const at of [0.4, 1.2]) {
    await sleep(at === 0.4 ? 400 : 800);
    await (await page.$('#out')).screenshot({ path: `screenshots/${id}-${at}s.png` });
  }
  await sleep(4000);
  console.log('готово:', id);
}
await browser.close();
