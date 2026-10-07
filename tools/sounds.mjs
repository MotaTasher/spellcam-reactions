// Звук каждой реакции — в WAV, чтобы послушать без камеры.
//   python3 server.py &   и   CHROME=/путь/к/chrome node tools/sounds.mjs [папка] [id …]
import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const chrome = process.env.CHROME;
const url = (process.env.URL || 'http://127.0.0.1:8765/') + '?out=soundroom&video=docs/demo/cartoon.webm';
const [outDir = 'screenshots/sounds', ...only] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--enable-unsafe-swiftshader', ...(process.env.CI ? ['--no-sandbox'] : [])] });
const page = await browser.newPage();
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__fx && window.__fx.ids, { timeout: 30000 });
const ids = only.length ? only : await page.evaluate(() => window.__fx.ids);
for (const id of ids) {
  const wav = await page.evaluate(async (id) => {
    const inst = window.__fx.make(id);
    if (!inst.sound) return null;
    const rate = 44100, ac = new OfflineAudioContext(1, rate * 6, rate);
    inst.sound({ ac, out: ac.destination });
    const buf = await ac.startRendering();
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) > 0.002) last = i;
    const n = Math.min(d.length, last + rate / 4);
    const out = new DataView(new ArrayBuffer(44 + n * 2));
    const str = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
    str(0, 'RIFF'); out.setUint32(4, 36 + n * 2, true); str(8, 'WAVEfmt ');
    out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true);
    out.setUint32(24, rate, true); out.setUint32(28, rate * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true);
    str(36, 'data'); out.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 32767, true);
    return Array.from(new Uint8Array(out.buffer));
  }, id);
  if (!wav) { console.log(`– ${id}: без звука`); continue; }
  writeFileSync(join(outDir, `${id}.wav`), Buffer.from(wav));
  console.log(`♪ ${id}: ${(wav.length / 2 / 44100).toFixed(1)} с → ${join(outDir, id + '.wav')}`);
}
await browser.close();
