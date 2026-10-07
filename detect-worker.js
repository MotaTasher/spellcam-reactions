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

let FilesetResolver, FaceDetector, ImageSegmenter, WASM;

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

self.onmessage = async (e) => {
  const m = e.data;
  if (m.type === 'init') {
    try {
      base = m.base;
      ({ FilesetResolver, FaceDetector, ImageSegmenter, WASM } = await loadVision(base));
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
  bmp.close();
  self.postMessage(out, transfer);
};
