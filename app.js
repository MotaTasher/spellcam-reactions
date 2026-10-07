import { EFFECTS } from './effects/index.js';

const CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/';

async function loadVision(base) {
  for (const root of [new URL('vendor/mediapipe/', base).href, CDN]) {
    try {
      const mod = await import(root + 'vision_bundle.mjs');
      return { ...mod, WASM: root + 'wasm' };
    } catch (e) {}
  }
  throw new Error('MediaPipe не загрузился');
}

const mobile = matchMedia('(pointer: coarse)').matches;
const C = mobile ? 480 : 640;
const MAX_SEC = 60;

const $ = (s) => document.querySelector(s);
const video = $('#cam');
const canvas = $('#out');
const ctx = canvas.getContext('2d');
canvas.width = canvas.height = C;

const mk = () => {
  const c = document.createElement('canvas');
  c.width = c.height = C;
  return c;
};
const frame = mk();
const fctx = frame.getContext('2d');
const maskCanvas = mk();
const mctx = maskCanvas.getContext('2d');
const layers = [mk(), mk()];
const segIn = document.createElement('canvas');
const segCtx = segIn.getContext('2d', { willReadFrequently: false });
const maskSrc = document.createElement('canvas');
const maskSrcCtx = maskSrc.getContext('2d');

let stream = null;
let faceDet = null;
let segmenter = null;
let segLoading = false;
let face = null;
let faceTarget = null;
let faceMiss = 0;
let lastSegAt = 0;
let buttonsKey = '';
let maskReady = false;
let maskArr = null, maskW = 0, maskH = 0;
let lastVideoTime = -1;
let active = [];
let crop = { ox: 0, oy: 0, s: 1, vw: 1, vh: 1 };

const status = (txt) => { $('#status').textContent = txt || ''; };

let facing = 'user';
let mirror = true;

function mapPt(px, py) {
  const u = ((px - crop.ox) / crop.s) * C;
  return { x: mirror ? C - u : u, y: ((py - crop.oy) / crop.s) * C };
}

function setMirror(c) {
  if (mirror) c.setTransform(-1, 0, 0, 1, C, 0);
  else c.setTransform(1, 0, 0, 1, 0, 0);
}

function edgePoint() {
  if (!maskArr) return null;
  for (let i = 0; i < 60; i++) {
    const mx = (Math.random() * maskW) | 0, my = (Math.random() * maskH) | 0;
    const v = maskArr[my * maskW + mx];
    if (v > 0.25 && v < 0.75) {
      const k = crop.vw / maskW;
      return mapPt(mx * k, my * k);
    }
  }
  return null;
}

const env = {
  C,
  get face() { return face; },
  get mask() { return maskReady ? maskCanvas : null; },
  frame,
  layer: (i) => layers[i],
  edgePoint,
};

const params = new URLSearchParams(location.search);

async function startCamera() {
  const src = params.get('video');
  if (src) {
    video.src = src;
    video.loop = true;
    video.muted = true;
    stream = new MediaStream();
    await video.play();
    return;
  }
  const v = videoConstraints();
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: v, audio: { echoCancellation: true, noiseSuppression: true } });
  } catch (e) {
    stream = await navigator.mediaDevices.getUserMedia({ video: v });
  }
  video.srcObject = stream;
  await video.play();
}

function videoConstraints() {
  return mobile
    ? { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 }, facingMode: facing }
    : { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, facingMode: facing };
}

async function flipCamera() {
  const next = facing === 'user' ? 'environment' : 'user';
  const prev = facing;
  facing = next;
  try {
    const fresh = await navigator.mediaDevices.getUserMedia({ video: videoConstraints() });
    for (const tr of stream.getVideoTracks()) { tr.stop(); stream.removeTrack(tr); }
    stream.addTrack(fresh.getVideoTracks()[0]);
    video.srcObject = stream;
    await video.play();
    mirror = facing === 'user';
    face = null;
    faceTarget = null;
    lastVideoTime = -1;
  } catch (e) {
    facing = prev;
  }
}

async function offerFlip() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    if (mobile && devices.filter((d) => d.kind === 'videoinput').length > 1) $('#flip').hidden = false;
  } catch (e) {}
}

let worker = null;
let workerReady = false;
let workerBusy = false;

function startWorker() {
  if (params.has('noworker') || typeof createImageBitmap !== 'function') return Promise.reject(new Error('no worker'));
  return new Promise((resolve, reject) => {
    try {
      worker = new Worker(new URL('./detect-worker.js', import.meta.url), { type: 'module' });
    } catch (e) {
      reject(e);
      return;
    }
    const fail = (e) => { worker = null; workerReady = false; reject(e); };
    worker.onerror = (e) => fail(new Error(e.message || 'worker'));
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'ready') { workerReady = true; worker.onmessage = onWorker; resolve(); }
      else if (m.type === 'error') fail(new Error(m.error));
    };
    worker.postMessage({ type: 'init', base: new URL('./', location.href).href });
  });
}

function onWorker(e) {
  const m = e.data;
  if (m.type === 'warn') { console.warn('worker:', m.error); return; }
  workerBusy = false;
  if (m.faceMs !== undefined) perf.face = perf.face * 0.8 + m.faceMs * 0.2;
  if (m.segMs !== undefined) perf.seg = perf.seg * 0.8 + m.segMs * 0.2;
  perf.det++;
  if ('face' in m) {
    if (m.face) {
      const [bx, by, bw, bh] = m.face.box;
      setFace(m.face.eyes.map(([x, y]) => [x * crop.vw, y * crop.vh]), [bx * crop.vw, by * crop.vh, bw * crop.vw, bh * crop.vh]);
    } else missFace();
  }
  if (m.mask) applyMask(m.mask, m.mw, m.mh);
}

function sendFrame(now, needMask) {
  if (!worker || !workerReady || workerBusy) return;
  workerBusy = true;
  const w = Math.min(480, crop.vw), h = Math.round((w * crop.vh) / crop.vw);
  createImageBitmap(video, { resizeWidth: w, resizeHeight: h, resizeQuality: 'low' })
    .catch(() => createImageBitmap(video))
    .then((bitmap) => worker.postMessage({ type: 'frame', bitmap, ts: now, face: true, seg: needMask }, [bitmap]))
    .catch(() => { workerBusy = false; });
}

async function loadModels() {
  const mp = await loadVision(location.href);
  env.mp = mp;
  const fs = await mp.FilesetResolver.forVisionTasks(mp.WASM);
  env.fs = fs;
  faceDet = await mp.FaceDetector.createFromOptions(fs, {
    baseOptions: { modelAssetPath: './models/blaze_face_short_range.tflite', delegate: 'GPU' },
    runningMode: 'VIDEO',
    minDetectionConfidence: 0.5,
  });
}

async function ensureSegmenter() {
  if (segmenter || segLoading || !env.fs) return;
  segLoading = true;
  segmenter = await env.mp.ImageSegmenter.createFromOptions(env.fs, {
    baseOptions: { modelAssetPath: './models/selfie_segmenter.tflite', delegate: 'GPU' },
    runningMode: 'VIDEO',
    outputConfidenceMasks: true,
    outputCategoryMask: false,
  });
  segLoading = false;
}

function updateCrop() {
  const vw = video.videoWidth, vh = video.videoHeight;
  const s = Math.min(vw, vh);
  crop = { ox: (vw - s) / 2, oy: (vh - s) / 2, s, vw, vh };
}

function missFace() {
  if (++faceMiss > 4) faceTarget = null;
}

function setFace(eyesPx, [bx, by, bw, bh]) {
  faceMiss = 0;
  let eyes = eyesPx.map(([x, y]) => mapPt(x, y));
  const a = mapPt(bx, by), b = mapPt(bx + bw, by + bh);
  const box = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
  const prev = (face || faceTarget || {}).eyes;
  if (prev && Math.hypot(prev[0].x - eyes[1].x, prev[0].y - eyes[1].y) < Math.hypot(prev[0].x - eyes[0].x, prev[0].y - eyes[0].y)) {
    eyes = [eyes[1], eyes[0]];
  }
  faceTarget = { eyes, box };
}

function detectFace(ts) {
  if (!faceDet) return;
  const r = faceDet.detectForVideo(video, ts);
  const d = r.detections && r.detections[0];
  if (!d) { missFace(); return; }
  const kp = d.keypoints, bb = d.boundingBox;
  setFace([[kp[0].x * crop.vw, kp[0].y * crop.vh], [kp[1].x * crop.vw, kp[1].y * crop.vh]], [bb.originX, bb.originY, bb.width, bb.height]);
}

function followFace(dt) {
  if (!faceTarget) { face = null; return; }
  if (!face) { face = { eyes: faceTarget.eyes.map((p) => ({ ...p })), box: { ...faceTarget.box } }; return; }
  const k = 1 - Math.exp(-dt * 35);
  const mix = (p, q) => { p.x += (q.x - p.x) * k; p.y += (q.y - p.y) * k; };
  mix(face.eyes[0], faceTarget.eyes[0]);
  mix(face.eyes[1], faceTarget.eyes[1]);
  for (const key of ['x', 'y', 'w', 'h']) face.box[key] += (faceTarget.box[key] - face.box[key]) * k;
}

function segment(ts) {
  if (!segmenter) return;
  const sw = 256, sh = Math.round((256 * crop.vh) / crop.vw);
  if (segIn.width !== sw || segIn.height !== sh) { segIn.width = sw; segIn.height = sh; }
  segCtx.drawImage(video, 0, 0, sw, sh);
  segmenter.segmentForVideo(segIn, ts, (res) => {
    const m = res.confidenceMasks && res.confidenceMasks[0];
    if (m) applyMask(m.getAsFloat32Array(), m.width, m.height);
  });
}

function applyMask(arr, w, h) {
  maskW = w; maskH = h;
  if (!maskArr || maskArr.length !== arr.length) maskArr = new Float32Array(arr.length);
  maskArr.set(arr);
  if (maskSrc.width !== maskW || maskSrc.height !== maskH) { maskSrc.width = maskW; maskSrc.height = maskH; }
  const img = maskSrcCtx.createImageData(maskW, maskH);
  const d = img.data;
  for (let i = 0, j = 0; i < maskArr.length; i++, j += 4) {
    d[j] = d[j + 1] = d[j + 2] = 255;
    const v = (maskArr[i] - 0.3) / 0.3;
    d[j + 3] = v <= 0 ? 0 : v >= 1 ? 255 : v * v * (3 - 2 * v) * 255;
  }
  maskSrcCtx.putImageData(img, 0, 0);
  const k = maskW / crop.vw;
  mctx.setTransform(1, 0, 0, 1, 0, 0);
  mctx.clearRect(0, 0, C, C);
  setMirror(mctx);
  mctx.drawImage(maskSrc, crop.ox * k, crop.oy * k, crop.s * k, crop.s * k, 0, 0, C, C);
  mctx.setTransform(1, 0, 0, 1, 0, 0);
  maskReady = true;
}

const perf = { face: 0, seg: 0, fps: 0, det: 0, detRate: 0, detAt: performance.now() };
const hud = params.has('debug') ? document.createElement('div') : null;
if (hud) {
  hud.style.cssText = 'position:fixed;left:8px;top:8px;z-index:20;font:12px/1.3 ui-monospace,Menlo,monospace;color:#0f0;background:rgba(0,0,0,.6);padding:4px 6px;border-radius:6px;pointer-events:none;white-space:pre';
  document.body.appendChild(hud);
}
function drawHud(dt, now) {
  perf.fps = perf.fps * 0.9 + (dt > 0 ? 1 / dt : 0) * 0.1;
  if (now - perf.detAt > 1000) { perf.detRate = (perf.det * 1000) / (now - perf.detAt); perf.det = 0; perf.detAt = now; }
  hud.textContent = `${perf.fps.toFixed(0)} fps  C=${C}  ${worker ? 'worker' : 'main'}\nface ${perf.face.toFixed(1)} ms  seg ${perf.seg.toFixed(1)} ms  det ${perf.detRate.toFixed(0)}/s\ncam ${video.videoWidth}x${video.videoHeight}  fx ${active.length}`;
}
window.__perf = perf;

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (video.readyState >= 2 && video.videoWidth) {
    if (!camReadyAt) camReadyAt = performance.now();
    updateCrop();
    setMirror(fctx);
    fctx.drawImage(video, crop.ox, crop.oy, crop.s, crop.s, 0, 0, C, C);
    fctx.setTransform(1, 0, 0, 1, 0, 0);
    const needMask = active.some((e) => e.inst.needsMask);
    if (!needMask) maskReady = false;
    if (worker) {
      if (video.currentTime !== lastVideoTime || needMask) {
        if (!workerBusy) lastVideoTime = video.currentTime;
        sendFrame(now, needMask);
      }
    }
    else if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      if (needMask) ensureSegmenter();
      try {
        const t0 = performance.now();
        detectFace(now);
        perf.face = perf.face * 0.8 + (performance.now() - t0) * 0.2;
        perf.det++;
        if (needMask && now - lastSegAt >= 33) {
          const t1 = performance.now();
          segment(now);
          lastSegAt = now;
          perf.seg = performance.now() - t1;
        }
      } catch (e) { console.warn(e); }
    }
  }
  followFace(dt);
  for (const e of active) e.inst.update(dt, env);
  active = active.filter((e) => !e.inst.done);
  render();
  syncButtons();
  if (hud) drawHud(dt, now);
  requestAnimationFrame(loop);
}

let camReadyAt = 0;

function render() {
  if (!camReadyAt) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, C, C);
    return;
  }
  let sx = 0, sy = 0;
  const filters = [];
  const zooms = [];
  for (const e of active) {
    const s = e.inst.shake && e.inst.shake();
    if (s) { sx += s.x; sy += s.y; }
    const f = e.inst.filter && e.inst.filter();
    if (f) filters.push(f);
    const z = e.inst.zoom && e.inst.zoom(env);
    if (z && (z.s > 1.0001 || z.rot)) zooms.push(z);
  }
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, C, C);
  if (sx || sy) {
    ctx.translate(C / 2 + sx, C / 2 + sy);
    ctx.scale(1.06, 1.06);
    ctx.translate(-C / 2, -C / 2);
  }
  for (const z of zooms) {
    const x = z.x ?? C / 2, y = z.y ?? C / 2;
    const fit = (v, p) => Math.min(z.s * p, Math.max(C - z.s * (C - p), v));
    ctx.translate(fit(z.tx ?? x, x), fit(z.ty ?? y, y));
    if (z.rot) ctx.rotate(z.rot);
    ctx.scale(z.s, z.s);
    ctx.translate(-x, -y);
  }
  ctx.filter = filters.join(' ') || 'none';
  ctx.drawImage(frame, 0, 0);
  ctx.filter = 'none';
  for (const e of active) if (e.inst.base) e.inst.base(ctx, env);
  for (const e of active) e.inst.draw(ctx, env);
  ctx.restore();
  for (const e of active) if (e.inst.overlay) e.inst.overlay(ctx, env);
}

let audio = null;
let recMixed = false;

function ensureAudio() {
  if (audio) return audio;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  const ac = new AC();
  const recDest = ac.createMediaStreamDestination();
  const out = ac.createGain();
  const limiter = ac.createDynamicsCompressor();
  limiter.threshold.value = -8;
  limiter.knee.value = 6;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.12;
  const monitor = ac.createGain();
  monitor.gain.value = mobile ? 0.5 : 0.7;
  out.connect(limiter);
  limiter.connect(recDest);
  limiter.connect(monitor).connect(ac.destination);
  audio = { ac, out, recDest, monitor, mic: null };
  return audio;
}

function wakeAudio() {
  const a = ensureAudio();
  if (a && a.ac.state !== 'running') a.ac.resume().catch(() => {});
}

function wireMic() {
  const a = audio;
  const tracks = stream ? stream.getAudioTracks() : [];
  if (!a || !tracks.length) return false;
  if (a.mic) a.mic.disconnect();
  a.mic = a.ac.createMediaStreamSource(new MediaStream(tracks));
  a.mic.connect(a.recDest);
  return true;
}

function fire(def) {
  const inst = def.make(env);
  active.push({ def, inst });
  if (!inst.sound) return;
  const a = ensureAudio();
  if (!a || a.ac.state !== 'running' || (rec && !recMixed)) return;
  try { inst.sound({ ac: a.ac, out: a.out }); } catch (e) { console.warn(e); }
}

function syncButtons() {
  const key = active.map((e) => e.def.id).sort().join();
  if (key === buttonsKey) return;
  buttonsKey = key;
  const on = new Set(active.map((e) => e.def.id));
  for (const b of document.querySelectorAll('.fx')) b.classList.toggle('on', on.has(b.dataset.id));
}

const KEYS = '1234567890qwertyuiop';

function buildButtons() {
  const bar = $('#fx');
  EFFECTS.forEach((def, i) => {
    const b = document.createElement('button');
    b.className = 'fx';
    b.dataset.id = def.id;
    b.innerHTML = `<span class="e">${def.emoji}</span><span class="n">${def.name}</span><kbd>${KEYS[i] || ''}</kbd>`;
    b.addEventListener('pointerdown', (ev) => { ev.preventDefault(); wakeAudio(); fire(def); });
    bar.appendChild(b);
  });
  window.addEventListener('keydown', (ev) => {
    if (ev.repeat) return;
    const i = KEYS.indexOf(ev.key.toLowerCase());
    if (i >= 0 && i < EFFECTS.length && !ev.metaKey && !ev.ctrlKey) fire(EFFECTS[i]);
    const inPreview = !$('#preview').hidden;
    if (ev.code === 'Space') {
      ev.preventDefault();
      if (!inPreview) toggleRec();
    }
    if (ev.key === 'Enter') {
      ev.preventDefault();
      if (inPreview) $('#again').click();
      else toggleRec();
    }
  });
}

let rec = null, chunks = [], recStart = 0, recTimer = null, recMime = '';

function pickMime() {
  const opts = [
    'video/mp4;codecs=avc1.42E01F,mp4a.40.2',
    'video/mp4;codecs=avc1,mp4a',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm',
  ];
  return opts.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
}

function toggleRec() {
  if (rec) stopRec();
  else startRec();
}

function startRec() {
  const out = canvas.captureStream(30);
  const a = ensureAudio();
  recMixed = !!(a && a.ac.state === 'running' && wireMic());
  if (recMixed) for (const tr of a.recDest.stream.getAudioTracks()) out.addTrack(tr);
  else for (const tr of stream.getAudioTracks()) out.addTrack(tr);
  recMime = pickMime();
  rec = new MediaRecorder(out, { mimeType: recMime || undefined, videoBitsPerSecond: mobile ? 1_000_000 : 1_200_000 });
  chunks = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  rec.onstop = finishRec;
  rec.start(250);
  recStart = performance.now();
  document.body.classList.add('rec');
  recTimer = setInterval(tick, 100);
  tick();
}

function stopRec() {
  if (!rec) return;
  rec.stop();
  rec = null;
  clearInterval(recTimer);
  document.body.classList.remove('rec');
  setRing(0);
}

function tick() {
  const sec = (performance.now() - recStart) / 1000;
  setRing(sec / MAX_SEC);
  $('#time').textContent = `0:${String(Math.floor(sec)).padStart(2, '0')}`;
  if (sec >= MAX_SEC) stopRec();
}

function setRing(p) {
  const r = $('#ring circle.p');
  const len = 2 * Math.PI * 48;
  r.style.strokeDasharray = `${len}`;
  r.style.strokeDashoffset = `${len * (1 - p)}`;
}

function finishRec() {
  const type = rec?.mimeType || recMime || 'video/webm';
  const blob = new Blob(chunks, { type: chunks[0]?.type || type });
  const url = URL.createObjectURL(blob);
  const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
  const d = new Date();
  const p2 = (n) => String(n).padStart(2, '0');
  const name = `circle-${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}_${p2(d.getHours())}-${p2(d.getMinutes())}-${p2(d.getSeconds())}.${ext}`;
  const pv = $('#preview video');
  pv.muted = true;
  pv.defaultMuted = true;
  pv.src = url;
  pv.play().catch(() => {});
  const a = $('#save');
  a.href = url;
  a.download = name;
  $('#preview').hidden = false;
  window.__lastRecording = { size: blob.size, type: blob.type, name };
}

$('#again').addEventListener('click', () => {
  const pv = $('#preview video');
  pv.pause();
  URL.revokeObjectURL(pv.src);
  $('#preview').hidden = true;
});

let pressAt = 0;
let pressing = false;
const recBtn = $('#recbtn');
document.addEventListener('pointerdown', wakeAudio, { capture: true, passive: true });
recBtn.addEventListener('pointerdown', (ev) => {
  ev.preventDefault();
  wakeAudio();
  if (!$('#preview').hidden) return;
  if (rec) { stopRec(); return; }
  startRec();
  pressAt = performance.now();
  pressing = true;
});
const releaseRec = () => {
  if (pressing && rec && performance.now() - pressAt > 450) stopRec();
  pressing = false;
};
recBtn.addEventListener('pointerup', releaseRec);
recBtn.addEventListener('pointercancel', releaseRec);
recBtn.addEventListener('contextmenu', (ev) => ev.preventDefault());
$('#flip').addEventListener('click', flipCamera);


(async () => {
  buildButtons();
  if (params.has('out')) document.body.classList.add('out');
  setRing(0);
  requestAnimationFrame(loop);
  try {
    status('Включаю камеру…');
    await startCamera();
  } catch (e) {
    status('Нет доступа к камере. Разреши камеру для этой страницы и обнови её.');
    return;
  }
  if (!params.get('video')) offerFlip();
  status('Загружаю распознавание лица…');
  try {
    await startWorker();
    status('');
  } catch (e) {
    console.warn('worker fallback:', e && e.message);
    try {
      await loadModels();
      status('');
    } catch (e2) {
      console.warn(e2);
      status('Лицо не распознаётся: эффекты на лице встанут по центру.');
    }
  }
})();

window.__fx = { ids: EFFECTS.map((e) => e.id), meta: EFFECTS.map((e) => ({ id: e.id, name: e.name, emoji: e.emoji, make: typeof e.make === 'function' })), fire: (id) => fire(EFFECTS.find((e) => e.id === id)), make: (id) => EFFECTS.find((e) => e.id === id).make(env), toggleRec, get active() { return active.map((e) => e.def.id); }, get face() { return face; }, get mixed() { return recMixed; } };
