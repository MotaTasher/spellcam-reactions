// Проверка логики жестов без камеры и браузера: spells.js получает выдуманные
// последовательности рук (жест, уверенность, положение, «глубина» z) и должен
// включать реакции когда надо и молчать когда не надо.
//   node tools/spells-test.mjs
// Руки для сердца сняты MediaPipe с настоящих фото (сердце из ладоней, две ладони,
// два больших пальца) — только числа, фото в репе нет.
import { createSpells, heartOf, nearHeart, TUNE } from '../spells.js';

let failed = 0, passed = 0;
const ok = (cond, msg, extra = '') => {
  if (cond) { passed++; console.log(`✓ ${msg}${extra ? ` (${extra})` : ''}`); }
  else { failed++; console.log(`✗ ${msg}${extra ? ` (${extra})` : ''}`); }
};

const C = 640;
// Рука: центр ладони x, y, размер size, z — отношение размера руки на кадре к её
// настоящему размеру (растёт, когда рука приближается к камере).
function hand(o = {}) {
  const x = o.x ?? 320, y = o.y ?? 330, size = o.size ?? 150;
  const k = size / 150;
  return {
    g: 'None', s: 0, z: 1, ...o, x, y, size,
    wrist: { x, y: y + 70 * k }, mcp: { x, y: y - 20 * k },
    thumb: { x: x - 40 * k, y }, pip: { x, y: y - 50 * k }, index: { x, y: y - 75 * k },
  };
}

// Прогон: frame(t) → массив рук в момент t (мс). dt — шаг распознавания.
function run(frame, { until = 3000, dt = 33, spells = createSpells() } = {}) {
  const casts = [];
  for (let t = 0; t <= until; t += dt) {
    const r = spells.step(t, frame(t));
    for (const c of r.casts) casts.push({ ...c, t });
  }
  return { casts, spells, count: (spell) => casts.filter((c) => c.spell === spell).length, first: (spell) => casts.find((c) => c.spell === spell) };
}

let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const noise = (a) => (rnd() * 2 - 1) * a;

// --- обычные жесты: быстрый запуск, удержание, открытая ладонь ---
{
  const r = run(() => [hand({ g: 'Thumb_Up', s: 0.9 })]);
  const c = r.first('Thumb_Up');
  ok(c && c.t <= 70 && r.count('Thumb_Up') === 1, 'уверенный 👍 срабатывает со второго кадра', c && `${c.t} мс, 30 Гц`);
  const r15 = run(() => [hand({ g: 'Thumb_Up', s: 0.9 })], { dt: 66 });
  ok(r15.first('Thumb_Up')?.t <= 140, 'на 15 Гц тоже со второго кадра', `${r15.first('Thumb_Up')?.t} мс`);
}
{
  const r = run(() => [hand({ g: 'Victory', s: 0.7 })]);
  const c = r.first('Victory');
  ok(c && c.t >= TUNE.hold && c.t < TUNE.hold + 40, 'неуверенный ✌️ ждёт удержания', c && `${c.t} мс`);
  ok(run(() => [hand({ g: 'Victory', s: 0.6 })]).casts.length === 0, 'совсем неуверенный ✌️ (0,6) не срабатывает');
}
{
  const r = run((t) => [hand({ g: 'Thumb_Up', s: 0.9, x: 120 + t * 0.6 })], { until: 1000 });
  const c = r.first('Thumb_Up');
  ok(c && c.t >= TUNE.hold, '👍 на летящей руке ждёт удержания, а не двух кадров', c && `${c.t} мс`);
}
{
  const r = run(() => [hand({ g: 'Open_Palm', s: 0.95 })]);
  const c = r.first('Open_Palm');
  ok(c && c.t >= 450, '✋ не срабатывает быстро даже уверенная', c && `${c.t} мс`);
  ok(run(() => [hand({ g: 'Open_Palm', s: 0.75 })]).casts.length === 0, '✋ с уверенностью 0,75 не срабатывает');
  const ily = run(() => [hand({ g: 'ILoveYou', s: 0.9 })]).first('ILoveYou');
  ok(ily && ily.t >= 450, '🤟 под той же защитой, что ✋', ily && `${ily.t} мс`);
}
{
  const r = run((t) => (t < 800 || (t > 1200 && t < 1800) || t > 2600 ? [hand({ g: 'Thumb_Up', s: 0.9 })] : []), { until: 3200 });
  ok(r.count('Thumb_Up') === 2, 'повтор того же жеста — после паузы 2 с, не раньше', r.casts.map((c) => c.t).join(', '));
}

// --- две руки ---
{
  const r = run((t) => [hand({ g: 'Thumb_Up', s: 0.9, x: 160 }), hand({ g: t > 500 ? 'Victory' : 'None', s: 0.9, x: 480 })], { until: 1500 });
  const a = r.first('Thumb_Up'), b = r.first('Victory');
  ok(a && b && a.id !== b.id, 'каждая рука включает свой жест', a && b && `👍 ${a.t} мс рукой ${a.id}, ✌️ ${b.t} мс рукой ${b.id}`);
  ok(Math.abs(a.hand.x - 160) < 1 && Math.abs(b.hand.x - 480) < 1, 'реакция вылетает из той руки, что показала жест');
}
{
  const left = run((t) => [hand({ g: 'Closed_Fist', s: 0.9, x: 150 }), hand({ x: 500 })], { until: 800 });
  const right = run((t) => [hand({ x: 150 }), hand({ g: 'Closed_Fist', s: 0.77, x: 500 })], { until: 800 });
  ok(left.count('Closed_Fist') === 1 && right.count('Closed_Fist') === 1, '✊ срабатывает и левой, и правой (вторая рука в кадре не мешает)',
    `${left.first('Closed_Fist')?.t} и ${right.first('Closed_Fist')?.t} мс`);
}
{
  const r = run(() => [hand({ g: 'Closed_Fist', s: 0.9, x: 150 }), hand({ g: 'Closed_Fist', s: 0.9, x: 500 })], { until: 4000 });
  ok(r.count('Closed_Fist') === 1, 'два кулака сразу — один БАХ, и не повторяется через 2 с, пока кулаки держат');
}
{
  const r = run((t) => (t < 1000 ? [hand({ g: 'Closed_Fist', s: 0.9, x: 160 })] : t < 1500 ? [] : [hand({ g: 'Closed_Fist', s: 0.9, x: 480 })]), { until: 4000 });
  ok(r.count('Closed_Fist') === 2, 'одна рука ушла, другая показала тот же жест после паузы', r.casts.map((c) => `${c.t}`).join(', '));
}

// --- стук кулаком ---
// Удар в воздушную стену перед камерой: кулак приближается (z растёт на 25 % за
// 130 мс) и возвращается за 170 мс, дальше пауза. period — время между ударами.
const knockZ = (t, { period = 400, rise = 130, fall = 170, amp = Math.log(1.25) } = {}) => {
  const p = t % period;
  return Math.exp(p < rise ? amp * (p / rise) : p < rise + fall ? amp * (1 - (p - rise) / fall) : 0);
};
{
  const knocks = (t) => [hand(t < 300 ? {} : { g: 'Closed_Fist', s: 0.9, z: t < 1900 ? knockZ(t - 300) : 1 })];
  const r = run(knocks, { until: 3500 });
  const k = r.casts.filter((c) => c.spell === 'Knock');
  ok(k.length === 3, 'четыре удара: первый взводит, со второго каждый — БАХ', k.map((c) => `${c.t} мс №${c.hand.knock}`).join(', '));
  ok(k.map((c) => c.hand.knock).join() === '2,3,4', 'номер удара в серии растёт');
  ok(r.count('Closed_Fist') === 0, 'пока стучат, большой БАХ от кулака не срабатывает');
  const lag = k.map((c, i) => c.t - (300 + (i + 1) * 400 + 130));
  ok(lag.every((v) => v >= 0 && v <= 100), 'БАХ от стука — не позже 0,1 с после удара', lag.join(', ') + ' мс');
}
for (const [period, label] of [[300, '3,3'], [500, '2']]) {
  const r = run((t) => [hand(t < 300 ? {} : { g: 'Closed_Fist', s: 0.9, z: t < 300 + period * 4 ? knockZ(t - 300, { period }) : 1 })], { until: 3500 });
  ok(r.count('Knock') === 3 && r.count('Closed_Fist') === 0, `стук ${label} раза в секунду — чистая серия`, r.casts.map((c) => `${c.spell === 'Knock' ? '№' + c.hand.knock : 'большой'} ${c.t}`).join(', '));
}
{
  const r = run((t) => [hand(t < 300 ? {} : { g: 'Closed_Fist', s: 0.9, z: t < 1900 ? knockZ(t - 300) : 1 })], { until: 3500, dt: 50 });
  ok(r.count('Knock') >= 2 && r.count('Closed_Fist') === 0, 'стук ловится и на 20 Гц', `${r.count('Knock')} раз`);
}
{
  const r = run((t) => [hand(t < 300 ? {} : { g: 'Closed_Fist', s: 0.9, z: t < 4500 ? knockZ(t - 300, { period: 1400 }) : 1 })], { until: 5500 });
  ok(r.count('Knock') === 0, 'удары реже раза в 1,2 с — серии нет', `БАХ от кулака: ${r.count('Closed_Fist')}`);
  const slow = run((t) => [hand(t < 300 ? {} : { g: 'Closed_Fist', s: 0.9, z: t < 3000 ? knockZ(t - 300, { period: 800 }) : 1 })], { until: 4000 });
  ok(slow.count('Knock') >= 2 && slow.count('Closed_Fist') <= 1, 'медленный стук (раз в 0,8 с) — первый большой БАХ, дальше серия', slow.casts.map((c) => `${c.spell === 'Knock' ? '№' + c.hand.knock : 'большой'} ${c.t}`).join(', '));
}
{
  const r = run((t) => [hand(t < 300 ? {} : { g: 'Closed_Fist', s: 0.9, z: t < 900 ? knockZ(t - 300, { amp: Math.log(1.08) }) : 1 })], { until: 2000 });
  ok(r.count('Knock') === 0, 'слабые толчки (8 %) — не стук');
}
{
  const z = (t) => Math.exp(t < 300 ? 0 : t < 1800 ? 0.3 * ((t - 300) / 1500) : t < 3300 ? 0.3 * (1 - (t - 1800) / 1500) : 0);
  const r = run((t) => [hand({ g: 'Closed_Fist', s: 0.9, z: z(t) })], { until: 4000 });
  ok(r.count('Knock') === 0, 'медленно поднёс кулак к камере и убрал — не стук', `БАХ от кулака: ${r.count('Closed_Fist')}`);
}
{
  const r = run((t) => [hand({ g: 'Closed_Fist', s: 0.9, y: 330 + 0.6 * 150 * Math.sin(t / 1000 * 2 * Math.PI * 3), z: Math.exp(noise(0.02)) })], { until: 3000 });
  ok(r.count('Knock') === 0, 'кулак машет вверх-вниз в плоскости кадра — не стук');
}
{
  const r = run((t) => [hand(t < 300 ? {} : { g: 'Open_Palm', s: 0.7, z: t < 1900 ? knockZ(t - 300) : 1 })], { until: 2500 });
  ok(r.count('Knock') === 0, 'такие же толчки открытой ладонью — не стук');
}
{
  seed = 11;
  const talk = (t) => {
    const phase = Math.floor(t / 400) % 4;
    const g = ['None', 'Open_Palm', 'None', 'Pointing_Up'][phase];
    const s = g === 'None' ? 0.5 : 0.55 + noise(0.05);
    return [hand({ g, s, x: 300 + 40 * Math.sin(t / 170) + noise(6), y: 360 + 30 * Math.sin(t / 230) + noise(6), size: 150 + noise(8), z: Math.exp(0.05 * Math.sin(t / 150) + noise(0.03)) })];
  };
  const r = run(talk, { until: 10000 });
  ok(r.casts.length === 0, 'рука жестикулирует во время разговора 10 с — ничего не включается', r.casts.map((c) => c.spell).join(', '));
  const fistTalk = (t) => [hand({ g: 'Closed_Fist', s: 0.75 + noise(0.1), x: 300 + 30 * Math.sin(t / 200) + noise(5), y: 360 + 25 * Math.sin(t / 260) + noise(5), z: Math.exp(0.04 * Math.sin(t / 180) + noise(0.03)) })];
  const f = run(fistTalk, { until: 10000 });
  ok(f.count('Knock') === 0, 'кулак дрожит и покачивается 10 с — стука нет', `БАХ от кулака: ${f.count('Closed_Fist')}`);
}
{
  const r = run((t) => [hand(t < 300 ? {} : { g: 'Closed_Fist', s: 0.9 })], { until: 1500 });
  const c = r.first('Closed_Fist');
  ok(c && c.t - 300 <= 70 && r.count('Closed_Fist') === 1, 'кулак держат неподвижно — большой БАХ сразу', c && `${c.t - 300} мс`);
}
{
  const z = (t) => Math.exp(t < 300 ? 0 : t < 450 ? Math.log(1.3) * (t - 300) / 150 : Math.log(1.3));
  const r = run((t) => [hand(t < 300 ? {} : { g: 'Closed_Fist', s: 0.9, z: z(t) })], { until: 2000 });
  const c = r.first('Closed_Fist');
  ok(c && r.count('Closed_Fist') === 1 && r.count('Knock') === 0 && c.t - 450 <= 300, 'ткнул кулаком в камеру и замер — один большой БАХ', c && `${c.t - 450} мс после остановки`);
}
{
  const amp = Math.log(1.3);
  const z = (t) => Math.exp(t < 300 ? 0 : t < 450 ? amp * (t - 300) / 150 : t < 600 ? amp * (1 - 0.6 * (t - 450) / 150) : amp * 0.4);
  const r = run((t) => [hand(t < 300 ? {} : { g: 'Closed_Fist', s: 0.9, z: z(t) })], { until: 2000 });
  const c = r.first('Closed_Fist');
  ok(c && r.count('Closed_Fist') === 1 && r.count('Knock') === 0 && c.t - 450 <= 550, 'удар с отскоком и замер — один большой БАХ, без серии', c && `${c.t - 450} мс после удара`);
}
{
  const r = run((t) => [hand({ x: 160, ...(t < 300 ? {} : { g: 'Closed_Fist', s: 0.9, z: t < 1900 ? knockZ(t - 300) : 1 }) }), hand({ x: 480, g: 'Closed_Fist', s: 0.9 })], { until: 2500 });
  ok(r.count('Knock') === 3 && r.casts.filter((c) => c.spell === 'Knock').every((c) => Math.abs(c.hand.x - 160) < 1), 'стучит одна рука, другая держит кулак — серия идёт из стучащей');
}

// --- сердце из ладоней ---
const FX = {
  heart1: [{ g: 'None', s: 0.62, x: 486, y: 237, size: 296, wrist: { x: 582, y: 368 }, thumb: { x: 321, y: 434 }, pip: { x: 350, y: 210 }, index: { x: 286, y: 291 }, mcp: { x: 467, y: 198 } }, { g: 'None', s: 0.64, x: 139, y: 272, size: 275, wrist: { x: 21, y: 389 }, thumb: { x: 297, y: 436 }, pip: { x: 257, y: 196 }, index: { x: 263, y: 306 }, mcp: { x: 162, y: 236 } }],
  heart1_flip: [{ g: 'None', s: 0.78, x: 157, y: 250, size: 296, wrist: { x: 50, y: 363 }, thumb: { x: 326, y: 448 }, pip: { x: 282, y: 208 }, index: { x: 346, y: 304 }, mcp: { x: 175, y: 216 } }, { g: 'Thumb_Down', s: 0.69, x: 507, y: 265, size: 263, wrist: { x: 604, y: 394 }, thumb: { x: 341, y: 425 }, pip: { x: 386, y: 198 }, index: { x: 359, y: 299 }, mcp: { x: 486, y: 226 } }],
  heart4: [{ g: 'None', s: 0.89, x: 275, y: 356, size: 100, wrist: { x: 235, y: 374 }, thumb: { x: 313, y: 412 }, pip: { x: 322, y: 337 }, index: { x: 335, y: 359 }, mcp: { x: 290, y: 351 } }, { g: 'None', s: 0.97, x: 368, y: 367, size: 87, wrist: { x: 396, y: 399 }, thumb: { x: 319, y: 415 }, pip: { x: 338, y: 333 }, index: { x: 329, y: 353 }, mcp: { x: 355, y: 358 } }],
  heart4_flip: [{ g: 'None', s: 0.88, x: 366, y: 354, size: 92, wrist: { x: 406, y: 375 }, thumb: { x: 330, y: 408 }, pip: { x: 321, y: 335 }, index: { x: 314, y: 359 }, mcp: { x: 351, y: 349 } }, { g: 'None', s: 0.94, x: 273, y: 367, size: 88, wrist: { x: 236, y: 394 }, thumb: { x: 323, y: 414 }, pip: { x: 313, y: 342 }, index: { x: 324, y: 357 }, mcp: { x: 287, y: 359 } }],
  heart6: [{ g: 'None', s: 0.94, x: 280, y: 367, size: 116, wrist: { x: 233, y: 409 }, thumb: { x: 338, y: 421 }, pip: { x: 324, y: 330 }, index: { x: 349, y: 344 }, mcp: { x: 296, y: 355 } }, { g: 'None', s: 0.94, x: 400, y: 368, size: 95, wrist: { x: 415, y: 415 }, thumb: { x: 372, y: 359 }, pip: { x: 381, y: 324 }, index: { x: 350, y: 332 }, mcp: { x: 402, y: 351 } }],
  heart6_flip: [{ g: 'None', s: 0.85, x: 363, y: 367, size: 109, wrist: { x: 406, y: 411 }, thumb: { x: 301, y: 424 }, pip: { x: 323, y: 330 }, index: { x: 297, y: 344 }, mcp: { x: 348, y: 354 } }, { g: 'None', s: 0.95, x: 238, y: 364, size: 89, wrist: { x: 214, y: 406 }, thumb: { x: 282, y: 394 }, pip: { x: 262, y: 326 }, index: { x: 294, y: 342 }, mcp: { x: 240, y: 348 } }],
  heart_far: [{ g: 'None', s: 0.88, x: 343, y: 297, size: 39, wrist: { x: 359, y: 312 }, thumb: { x: 321, y: 322 }, pip: { x: 322, y: 288 }, index: { x: 322, y: 299 }, mcp: { x: 336, y: 292 } }, { g: 'None', s: 0.88, x: 299, y: 300, size: 43, wrist: { x: 279, y: 309 }, thumb: { x: 319, y: 322 }, pip: { x: 320, y: 289 }, index: { x: 322, y: 300 }, mcp: { x: 307, y: 298 } }],
  two_palms: [{ g: 'None', s: 0.65, x: 506, y: 272, size: 296, wrist: { x: 527, y: 173 }, thumb: { x: 352, y: 308 }, pip: { x: 424, y: 367 }, index: { x: 408, y: 446 }, mcp: { x: 485, y: 304 } }, { g: 'Open_Palm', s: 0.72, x: 134, y: 368, size: 299, wrist: { x: 111, y: 468 }, thumb: { x: 289, y: 332 }, pip: { x: 216, y: 274 }, index: { x: 233, y: 195 }, mcp: { x: 155, y: 337 } }],
  two_palms_flip: [{ g: 'Open_Palm', s: 0.6, x: 503, y: 367, size: 294, wrist: { x: 521, y: 464 }, thumb: { x: 351, y: 331 }, pip: { x: 427, y: 275 }, index: { x: 411, y: 195 }, mcp: { x: 484, y: 337 } }, { g: 'None', s: 0.59, x: 137, y: 275, size: 293, wrist: { x: 120, y: 178 }, thumb: { x: 290, y: 308 }, pip: { x: 213, y: 365 }, index: { x: 230, y: 442 }, mcp: { x: 156, y: 305 } }],
  two_thumbs: [{ g: 'Thumb_Up', s: 0.54, x: 356, y: 352, size: 81, wrist: { x: 374, y: 354 }, thumb: { x: 340, y: 289 }, pip: { x: 324, y: 329 }, index: { x: 332, y: 328 }, mcp: { x: 352, y: 346 } }, { g: 'Thumb_Up', s: 0.74, x: 255, y: 310, size: 68, wrist: { x: 256, y: 317 }, thumb: { x: 259, y: 257 }, pip: { x: 281, y: 291 }, index: { x: 269, y: 295 }, mcp: { x: 253, y: 303 } }],
  two_thumbs_flip: [{ g: 'Thumb_Up', s: 0.56, x: 285, y: 352, size: 80, wrist: { x: 265, y: 351 }, thumb: { x: 300, y: 289 }, pip: { x: 321, y: 331 }, index: { x: 300, y: 331 }, mcp: { x: 289, y: 346 } }, { g: 'Thumb_Up', s: 0.68, x: 386, y: 309, size: 68, wrist: { x: 382, y: 311 }, thumb: { x: 382, y: 257 }, pip: { x: 362, y: 291 }, index: { x: 372, y: 293 }, mcp: { x: 388, y: 303 } }],
  fist: [{ g: 'Closed_Fist', s: 0.9, x: 305, y: 257, size: 284, wrist: { x: 306, y: 419 }, thumb: { x: 359, y: 205 }, pip: { x: 401, y: 136 }, index: { x: 391, y: 236 }, mcp: { x: 330, y: 206 } }],
};
const mirror = (hs) => hs.map((h) => {
  const m = (p) => ({ x: C - p.x, y: p.y });
  return { ...h, ...m(h), wrist: m(h.wrist), thumb: m(h.thumb), pip: m(h.pip), index: m(h.index), mcp: m(h.mcp) };
});
const shift = (h, dx, dy = 0) => {
  const m = (p) => ({ x: p.x + dx, y: p.y + dy });
  return { ...h, ...m(h), wrist: m(h.wrist), thumb: m(h.thumb), pip: m(h.pip), index: m(h.index), mcp: m(h.mcp) };
};
const fistR = FX.fist[0], fistL = mirror(FX.fist)[0];
const synth = {
  // ладони вместе, пальцы вверх (молитва): кончики сходятся, но пальцы смотрят вверх
  praying: [hand({ x: 290, size: 150 }), mirror([hand({ x: 290, size: 150 })])[0]].map((h) => ({ ...h, index: { x: 320, y: 200 }, pip: { x: 315, y: 230 }, thumb: { x: 318, y: 300 } })),
  // ромб: большие и указательные сошлись, но указательные прямые и смотрят вверх
  rhombus: [{ ...hand({ x: 230 }), index: { x: 318, y: 210 }, pip: { x: 290, y: 240 }, thumb: { x: 318, y: 360 } }, { ...hand({ x: 410 }), index: { x: 322, y: 210 }, pip: { x: 350, y: 240 }, thumb: { x: 322, y: 360 } }],
  // два кулака рядом
  fists: [shift(fistR, 150), shift(fistL, -150)],
  // одна рука над другой
  stacked: [hand({ x: 320, y: 200 }), hand({ x: 320, y: 420 })],
};
for (const k of ['heart1', 'heart1_flip', 'heart4', 'heart4_flip', 'heart6', 'heart6_flip', 'heart_far']) {
  const h = heartOf(...FX[k]), hm = heartOf(...mirror(FX[k]));
  ok(h && hm, `сердце: ${k}`, h && `центр ${h.x.toFixed(0)},${h.y.toFixed(0)}, размер ${h.size.toFixed(0)}`);
}
for (const [k, v] of [...Object.entries({ two_palms: FX.two_palms, two_palms_flip: FX.two_palms_flip, two_thumbs: FX.two_thumbs, two_thumbs_flip: FX.two_thumbs_flip }), ...Object.entries(synth)]) {
  ok(!heartOf(...v) && !heartOf(...mirror(v)), `не сердце: ${k}`);
}
ok(!nearHeart(...FX.two_thumbs) && !nearHeart(...FX.two_palms), 'два больших пальца и две ладони не глушат обычные жесты');
{
  const h = heartOf(...FX.heart4);
  const top = { x: (FX.heart4[0].index.x + FX.heart4[1].index.x) / 2, y: (FX.heart4[0].index.y + FX.heart4[1].index.y) / 2 };
  const bot = { x: (FX.heart4[0].thumb.x + FX.heart4[1].thumb.x) / 2, y: (FX.heart4[0].thumb.y + FX.heart4[1].thumb.y) / 2 };
  ok(h.y > top.y && h.y < bot.y && Math.abs(h.x - (top.x + bot.x) / 2) < 10, 'сердечки встают в центр сердца из ладоней');
}
{
  const jit = (hs) => hs.map((h) => shift(h, noise(2), noise(2)));
  const r = run((t) => (t < 300 ? [shift(FX.heart1_flip[0], -120), shift(FX.heart1_flip[1], 120)] : t < 1500 ? jit(FX.heart1_flip) : []), { until: 2500 });
  const c = r.first('Heart');
  ok(c && r.count('Heart') === 1 && c.t - 300 <= 100, 'сложил сердце — одно срабатывание, сразу', c && `${c.t - 300} мс`);
  ok(r.count('Thumb_Down') === 0, 'рука в сердце похожа на 👎 (0,69), но «Нет!» не включается');
}
{
  const r = run((t) => (t < 900 ? FX.heart4 : t < 1300 ? [] : t < 2000 ? FX.heart4 : []), { until: 2500 });
  ok(r.count('Heart') === 1, 'сердце повторно в течение 2 с — не срабатывает');
  const r2 = run((t) => (t < 600 ? FX.heart4 : t < 2300 ? [] : t < 3000 ? FX.heart4 : []), { until: 3500 });
  ok(r2.count('Heart') === 2, 'сердце после паузы 2 с — снова');
}
{
  const r = run(() => [shift(FX.heart6[0], -60), shift(FX.heart6[1], 60)], { until: 1500 });
  ok(r.casts.length === 0, 'руки рядом, но не сомкнуты — ничего');
}
{
  const r = run(() => FX.two_thumbs.map((h) => ({ ...h, s: 0.9 })), { until: 1500 });
  ok(r.count('Thumb_Up') === 1, 'два больших пальца рядом — «Да!» включается');
}

console.log(`\n${passed} прошло, ${failed} нет`);
if (failed) process.exit(1);
