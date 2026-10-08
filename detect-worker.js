const CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/';
const HANDS = 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';

async function loadVision(base) {
  for (const root of [new URL('vendor/mediapipe/', base).href, CDN]) {
    try {
      const mod = await import(root + 'vision_bundle.mjs');
      return { ...mod, WASM: root + 'wasm' };
    } catch (e) {}
  }
  throw new Error('MediaPipe не загрузился');
}

let FilesetResolver, FaceDetector, ImageSegmenter, GestureRecognizer, WASM;

self.importScripts = (...urls) => {
  for (const url of urls) {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', String(url), false);
    xhr.send();
    if (xhr.status !== 200) throw new Error(`load ${url}: ${xhr.status}`);
    (0, eval)(xhr.responseText);
  }
};

let fs = null;
let base = '';
let face = null;
let seg = null;
let segLoading = false;
let hands = null;
let handsLoading = false;
let handsGpu = true;
let handsOff = false;
let lastTs = 0;

async function create(Task, opts, gpu = true) {
  if (!gpu) return Task.createFromOptions(fs, { ...opts, baseOptions: { ...opts.baseOptions, delegate: 'CPU' } });
  try {
    return await Task.createFromOptions(fs, { ...opts, baseOptions: { ...opts.baseOptions, delegate: 'GPU' } });
  } catch (e) {
    return await Task.createFromOptions(fs, { ...opts, baseOptions: { ...opts.baseOptions, delegate: 'CPU' } });
  }
}

async function ensureSeg() {
  if (seg || segLoading) return;
  segLoading = true;
  try {
    seg = await create(ImageSegmenter, {
      baseOptions: { modelAssetPath: base + 'models/selfie_segmenter.tflite' },
      runningMode: 'VIDEO',
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    }, false);
  } catch (err) {
    self.postMessage({ type: 'warn', error: String(err) });
  }
  segLoading = false;
}

async function handsModel() {
  const local = base + 'vendor/mediapipe/gesture_recognizer.task';
  try {
    const r = await fetch(local, { method: 'HEAD' });
    if (r.ok) return local;
  } catch (e) {}
  return HANDS;
}

async function ensureHands() {
  if (hands || handsLoading || handsOff || !GestureRecognizer) return;
  handsLoading = true;
  try {
    hands = await create(GestureRecognizer, {
      baseOptions: { modelAssetPath: await handsModel() },
      runningMode: 'VIDEO',
      numHands: 1,
    }, handsGpu);
  } catch (err) {
    handsOff = true;
    self.postMessage({ type: 'warn', error: String(err) });
    self.postMessage({ type: 'hand', off: true });
  }
  handsLoading = false;
}

function findHand(bmp, ts) {
  ensureHands();
  if (!hands) return;
  const out = { type: 'hand', hand: null };
  const t0 = performance.now();
  try {
    const r = hands.recognizeForVideo(bmp, ts);
    const lm = r.landmarks && r.landmarks[0];
    if (lm && lm.length === 21) {
      let top = { categoryName: 'None', score: 0 };
      for (const c of (r.gestures && r.gestures[0]) || []) if (c.score > top.score) top = c;
      const xs = lm.map((p) => p.x), ys = lm.map((p) => p.y);
      const palm = [0, 5, 9, 13, 17];
      out.hand = {
        g: top.categoryName || 'None',
        s: top.score,
        c: [palm.reduce((a, i) => a + xs[i], 0) / 5, palm.reduce((a, i) => a + ys[i], 0) / 5],
        w: [xs[0], ys[0]],
        b: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
      };
    }
  } catch (err) {
    try { hands.close(); } catch (e) {}
    hands = null;
    if (handsGpu) handsGpu = false;
    else handsOff = true;
    self.postMessage({ type: 'warn', error: String(err) });
    if (handsOff) self.postMessage({ type: 'hand', off: true });
    return;
  }
  out.handMs = performance.now() - t0;
  self.postMessage(out);
}

self.onmessage = async (e) => {
  const m = e.data;
  if (m.type === 'init') {
    try {
      base = m.base;
      ({ FilesetResolver, FaceDetector, ImageSegmenter, GestureRecognizer, WASM } = await loadVision(base));
      fs = await FilesetResolver.forVisionTasks(WASM);
      face = await create(FaceDetector, {
        baseOptions: { modelAssetPath: base + 'models/blaze_face_short_range.tflite' },
        runningMode: 'VIDEO',
        minDetectionConfidence: 0.5,
      });
      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'error', error: String(err) });
    }
    return;
  }
  if (m.type !== 'frame') return;
  const bmp = m.bitmap;
  const ts = Math.max(m.ts, lastTs + 1);
  lastTs = ts;
  const out = { type: 'result' };
  const transfer = [];
  const t0 = performance.now();
  try {
    if (face && m.face) {
      const r = face.detectForVideo(bmp, ts);
      const d = r.detections && r.detections[0];
      out.face = d
        ? {
            eyes: [[d.keypoints[0].x, d.keypoints[0].y], [d.keypoints[1].x, d.keypoints[1].y]],
            box: [d.boundingBox.originX / bmp.width, d.boundingBox.originY / bmp.height, d.boundingBox.width / bmp.width, d.boundingBox.height / bmp.height],
          }
        : null;
    }
    out.faceMs = performance.now() - t0;
    if (m.seg) {
      ensureSeg();
      if (seg) {
        const t1 = performance.now();
        seg.segmentForVideo(bmp, ts, (res) => {
          const mk = res.confidenceMasks && res.confidenceMasks[0];
          if (!mk) return;
          out.mask = mk.getAsFloat32Array().slice();
          out.mw = mk.width;
          out.mh = mk.height;
          transfer.push(out.mask.buffer);
        });
        out.segMs = performance.now() - t1;
      }
    }
  } catch (err) {
    out.error = String(err);
  }
  self.postMessage(out, transfer);
  if (m.hand) findHand(bmp, ts);
  bmp.close();
};
