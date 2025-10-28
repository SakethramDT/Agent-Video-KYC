// ocrDetector.js
// A standalone OCR/ID-card detector module built on onnxruntime-web.
// It encapsulates model loading, frame scanning, heuristics, and capture output.
//
// Usage:
//   import { OcrDetector } from './ocrDetector';
//   const det = new OcrDetector({ modelUrl: '/models/id.onnx' });
//   await det.load();
//   const controller = new AbortController();
//   const img = await det.scan({ video, side: 'front', onStatus: (msg)=>{}, signal: controller.signal });
//   // img = { blob, url, type: 'front_card', timestamp }
//
// Notes:
// - 'side' should be 'front' or 'back'.
// - Provide a <video> element that is rendering the remote stream.
// - Call controller.abort() to cancel a running scan.
// - Call det.dispose() to release resources when done.

import * as ort from 'onnxruntime-web';

function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }
function xywh2xyxy(boxes) { return boxes.map(([x, y, w, h]) => [x - w / 2, y - h / 2, x + w / 2, y + h / 2]); }

function iou(a, b) {
  const [x1, y1, x2, y2] = a, [x1b, y1b, x2b, y2b] = b;
  const xi1 = Math.max(x1, x1b), yi1 = Math.max(y1, y1b);
  const xi2 = Math.min(x2, x2b), yi2 = Math.min(y2, y2b);
  const inter = Math.max(0, xi2 - xi1) * Math.max(0, yi2 - yi1);
  const areaA = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const areaB = Math.max(0, x2b - x1b) * Math.max(0, y2b - y1b);
  return inter / (areaA + areaB - inter + 1e-6);
}

function nonMaxSuppression(boxes, scores, iouThreshold = 0.45) {
  const idxs = boxes.map((_, i) => i).sort((a, b) => scores[b] - scores[a]);
  const keep = [];
  while (idxs.length) {
    const curr = idxs.shift();
    keep.push(curr);
    for (let i = idxs.length - 1; i >= 0; i--) {
      if (iou(boxes[curr], boxes[idxs[i]]) >= iouThreshold) idxs.splice(i, 1);
    }
  }
  return keep;
}

// Simple Laplacian variance blur detector
function isImageBlurry(canvas, threshold = 120) {
  const ctx = canvas.getContext('2d');
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const gray = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.2989 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  const kernel = [0, 1, 0, 1, -4, 1, 0, 1, 0];
  const lap = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let s = 0, k = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++, k++) {
          s += kernel[k] * gray[(y + ky) * width + (x + kx)];
        }
      }
      lap.push(s);
    }
  }
  const mean = lap.reduce((a, b) => a + b, 0) / lap.length;
  const variance = lap.reduce((a, b) => a + (b - mean) ** 2, 0) / lap.length;
  return variance < threshold;
}

// Brightness/contrast sanity check
function lightOk(canvas, meanRange = [30, 205], stdMin = 24) {
  const ctx = canvas.getContext('2d');
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let sum = 0, sum2 = 0, n = canvas.width * canvas.height;
  for (let i = 0; i < data.length; i += 4) {
    const g = 0.2989 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    sum += g; sum2 += g * g;
  }
  const mean = sum / n;
  const std = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
  return mean >= meanRange[0] && mean <= meanRange[1] && std >= stdMin;
}

// Edge strength along the outer border (to ensure strong rectangular edges)
function borderEdgeScore(canvas, borderPct = 0.06) {
  const ctx = canvas.getContext('2d');
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const gray = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.2989 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  // Sobel
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  const mag = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sx = 0, sy = 0, k = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++, k++) {
          const v = gray[(y + ky) * width + (x + kx)];
          sx += sobelX[k] * v;
          sy += sobelY[k] * v;
        }
      }
      mag[y * width + x] = Math.hypot(sx, sy);
    }
  }
  const bw = Math.max(2, Math.floor(width * borderPct));
  const bh = Math.max(2, Math.floor(height * borderPct));
  let sum = 0, cnt = 0;
  // top/bottom
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < width; x++) { sum += mag[y * width + x]; cnt++; }
  }
  for (let y = height - bh; y < height; y++) {
    for (let x = 0; x < width; x++) { sum += mag[y * width + x]; cnt++; }
  }
  // left/right
  for (let y = bh; y < height - bh; y++) {
    for (let x = 0; x < bw; x++) { sum += mag[y * width + x]; cnt++; }
    for (let x = width - bw; x < width; x++) { sum += mag[y * width + x]; cnt++; }
  }
  return sum / Math.max(1, cnt);
}

// Letterbox the video frame into a square canvas and return mapping meta
function letterboxDraw(video, ctx, IMG_SIZE) {
  const vw = video.videoWidth, vh = video.videoHeight;
  const scale = Math.min(IMG_SIZE / vw, IMG_SIZE / vh);
  const newW = Math.round(vw * scale);
  const newH = Math.round(vh * scale);
  const padX = Math.floor((IMG_SIZE - newW) / 2);
  const padY = Math.floor((IMG_SIZE - newH) / 2);

  ctx.clearRect(0, 0, IMG_SIZE, IMG_SIZE);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, IMG_SIZE, IMG_SIZE);
  ctx.drawImage(video, 0, 0, vw, vh, padX, padY, newW, newH);

  return { scale, padX, padY, newW, newH, vw, vh };
}

// Map a 640-space box back to original video pixel coords
function unletterboxBox([x1, y1, x2, y2], meta, clamp = true) {
  const { scale, padX, padY, vw, vh } = meta;
  let rx1 = (x1 - padX) / scale;
  let ry1 = (y1 - padY) / scale;
  let rx2 = (x2 - padX) / scale;
  let ry2 = (y2 - padY) / scale;
  if (clamp) {
    rx1 = Math.max(0, Math.min(vw, rx1));
    rx2 = Math.max(0, Math.min(vw, rx2));
    ry1 = Math.max(0, Math.min(vh, ry1));
    ry2 = Math.max(0, Math.min(vh, ry2));
  }
  return [Math.round(rx1), Math.round(ry1), Math.round(rx2), Math.round(ry2)];
}

// Partition helper
function boxInside(inner, outer) {
  return inner[0] >= outer[0] && inner[1] >= outer[1] && inner[2] <= outer[2] && inner[3] <= outer[3];
}

export class OcrDetector {
  /**
   * @param {{modelUrl: string}} opts
   */
  constructor({ modelUrl }) {
    this.modelUrl = modelUrl;
    this.session = null;
    this.canvas = null; // work canvas
    this.MIN_STABLE_FRAMES = 4;
    this._stable = { box: null, count: 0, side: null, classId: null };
  }

  async load() {
    if (this.session) return;
    ort.env.wasm.simd = true;
    this.session = await ort.InferenceSession.create(this.modelUrl, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all'
    });
    this.canvas = document.createElement('canvas');
  }

  isLoaded() { return !!this.session; }

  dispose() {
    if (this.session) { try { this.session.release(); } catch { } this.session = null; }
    this.canvas = null;
  }

  _resetStability() { this._stable = { box: null, count: 0, side: null, classId: null }; }

  _passesHeuristics(side, cropBoxOrig, meta, outCanvas, score, classId) {
    const [x1, y1, x2, y2] = cropBoxOrig;
    const cropW = x2 - x1, cropH = y2 - y1;
    const frameArea = meta.vw * meta.vh;
    const areaRatio = (cropW * cropH) / frameArea;

    // aspect ratio (H/W) for horizontal ID cards ~ 0.63–0.72; allow some tolerance
    const ar = cropH / cropW;
    const minAR = 0.58, maxAR = 0.78;

    // area sanity (avoid tiny/huge boxes)
    const minArea = 0.14, maxArea = 0.65;

    // detector confidence
    const minDetConf = 0.50;

    // lighting & blur
    const lit = lightOk(outCanvas);
    const notBlurry = !isImageBlurry(outCanvas, 120);

    // border edges strong enough
    const edge = borderEdgeScore(outCanvas);
    const minEdge = 8;

    // stability check across frames (same side & class, similar bbox)
    const prev = this._stable;
    const sameSide = prev.side === side && prev.classId === classId && prev.box && iou(prev.box, cropBoxOrig) > 0.85;
    const count = sameSide ? prev.count + 1 : 1;
    this._stable = { box: cropBoxOrig, count, side, classId };

    const ok = ar >= minAR && ar <= maxAR &&
               areaRatio >= minArea && areaRatio <= maxArea &&
               score >= minDetConf && lit && notBlurry && edge >= minEdge &&
               count >= this.MIN_STABLE_FRAMES;

    return { ok, reasons: { ar, areaRatio, score, lit, notBlurry, edge, stableFrames: count } };
  }

  /**
   * Scan until a valid capture is produced or aborted.
   * @param {{video: HTMLVideoElement, side: 'front'|'back', onStatus?: (msg:string)=>void, signal?: AbortSignal}} opts
   * @returns {Promise<{blob: Blob, url: string, type: 'front_card'|'back_card', timestamp: string}>}
   */
  async scan({ video, side, onStatus, signal }) {
    if (!this.session) throw new Error('Detector not loaded');
    if (!video) throw new Error('No video provided');
    this._resetStability();

    const canvas = this.canvas;
    const IMG_SIZE = 640;
    canvas.width = IMG_SIZE; canvas.height = IMG_SIZE;
    const ctx = canvas.getContext('2d');

    const status = (m) => { if (onStatus) onStatus(m); };

    const awaitDelay = (ms) => new Promise((r) => setTimeout(r, ms));

    const step = async (first = false) => {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      if (video.readyState !== 4) {
        status('Waiting for video…');
        await awaitDelay(500);
        return step(false);
      }
      if (first) await awaitDelay(800);

      // 1) Letterbox draw (no stretching)
      const meta = letterboxDraw(video, ctx, IMG_SIZE);

      // Get RGB CHW tensor
      const rgba = ctx.getImageData(0, 0, IMG_SIZE, IMG_SIZE).data;
      const chw = new Float32Array(3 * IMG_SIZE * IMG_SIZE);
      for (let i = 0; i < IMG_SIZE * IMG_SIZE; i++) {
        chw[i] = rgba[i * 4] / 255;
        chw[IMG_SIZE * IMG_SIZE + i] = rgba[i * 4 + 1] / 255;
        chw[2 * IMG_SIZE * IMG_SIZE + i] = rgba[i * 4 + 2] / 255;
      }
      const inputTensor = new ort.Tensor('float32', chw, [1, 3, IMG_SIZE, IMG_SIZE]);

      // Inference
      const feeds = {}; feeds[this.session.inputNames[0]] = inputTensor;
      let output;
      try {
        const results = await this.session.run(feeds);
        output = results[this.session.outputNames[0]];
      } catch (e) {
        status('Detector inference error — retrying…');
        await awaitDelay(250);
        return step(false);
      }

      // Normalize output rows [x,y,w,h,c0,c1,c2]
      const rows = [];
      if (output.dims.length === 3) {
        if (output.dims[1] === 7) {
          for (let i = 0; i < output.dims[2]; i++) {
            const row = new Array(7);
            for (let j = 0; j < 7; j++) row[j] = output.data[j * output.dims[2] + i];
            rows.push(row);
          }
        } else if (output.dims[2] === 7) {
          for (let i = 0; i < output.dims[1]; i++) {
            const row = new Array(7);
            for (let j = 0; j < 7; j++) row[j] = output.data[i * output.dims[2] + j];
            rows.push(row);
          }
        } else {
          status('Unexpected detector output shape');
          await awaitDelay(600);
          return step(false);
        }
      } else {
        status('Detector output shape error');
        await awaitDelay(600);
        return step(false);
      }

      // 2) Tighter thresholds + NMS
      const boxes_xywh_norm = rows.map((r) => r.slice(0, 4));
      const classScores = rows.map((r) => r.slice(4).map(sigmoid));
      const maxScores = classScores.map((sc) => Math.max(...sc));
      const classIds = classScores.map((sc) => sc.indexOf(Math.max(...sc)));
      const confThr = 0.50;
      const mask = maxScores.map((s) => s >= confThr);

      const boxesF_norm = boxes_xywh_norm.filter((_, i) => mask[i]);
      const scoresF = maxScores.filter((_, i) => mask[i]);
      const classIdsF = classIds.filter((_, i) => mask[i]);

      if (!boxesF_norm.length) {
        status(`Hold steady… detecting ${side} ID`);
        await awaitDelay(120);
        return step(false);
      }

      // Convert to 640px space
      const boxes_px_640 = xywh2xyxy(
        boxesF_norm.map(([x, y, w, h]) => [x * IMG_SIZE, y * IMG_SIZE, w * IMG_SIZE, h * IMG_SIZE])
      );
      const keepIdx = nonMaxSuppression(boxes_px_640, scoresF, 0.45);

      // Partition by predicted class (assume 0=back, 1=front, 2=logo)
      const backs = [], fronts = [], logos = [];
      for (const i of keepIdx) {
        if (classIdsF[i] === 0) backs.push(i);
        if (classIdsF[i] === 1) fronts.push(i);
        if (classIdsF[i] === 2) logos.push(i);
      }

      // Decide crop (logo helpful but not strictly required)
      let crop640 = null, cropScore = 0, cropClass = null;
      if (side === 'front') {
        let chosen = null, best = -1, cls = null;
        for (const i of fronts) {
          const b = boxes_px_640[i].map(Math.round);
          const s = scoresF[i];
          const hasLogoInside = logos.some((l) => boxInside(boxes_px_640[l].map(Math.round), b));
          const scoreBoost = hasLogoInside ? 0.15 : 0.0;
          const score = s + scoreBoost;
          if (score > best) { best = score; chosen = b; cls = 1; }
        }
        crop640 = chosen; cropScore = best; cropClass = cls;
      } else {
        let chosen = null, best = -1, cls = null;
        for (const i of backs) {
          const b = boxes_px_640[i].map(Math.round);
          const s = scoresF[i];
          if (s > best) { best = s; chosen = b; cls = 0; }
        }
        crop640 = chosen; cropScore = best; cropClass = cls;
      }

      if (!crop640) {
        status(`Show the ${side} side clearly (good light, fill frame)`);
        await awaitDelay(150);
        return step(false);
      }

      // 3) Map crop back to original frame
      const cropOrig = unletterboxBox(crop640, meta, true);
      let [x1, y1, x2, y2] = cropOrig;
      const cropW = x2 - x1, cropH = y2 - y1;

      if (cropW <= 0 || cropH <= 0) {
        status(`Reposition the ${side} side in frame`);
        await awaitDelay(150);
        return step(false);
      }

      // Crop at full video resolution
      const full = document.createElement('canvas');
      full.width = meta.vw; full.height = meta.vh;
      const fctx = full.getContext('2d');
      fctx.drawImage(video, 0, 0, meta.vw, meta.vh);
      const crop = fctx.getImageData(x1, y1, cropW, cropH);

      const outCanvas = document.createElement('canvas');
      outCanvas.width = cropW; outCanvas.height = cropH;
      outCanvas.getContext('2d').putImageData(crop, 0, 0);

      // Heuristic gates
      const { ok, reasons } = this._passesHeuristics(side, cropOrig, meta, outCanvas, cropScore ?? 0, cropClass);
      if (!ok) {
        const msg = [];
        if (reasons.stableFrames < this.MIN_STABLE_FRAMES) msg.push('hold steady');
        if (!reasons.notBlurry) msg.push('avoid blur');
        if (!reasons.lit) msg.push('more light');
        status(msg.length ? msg.join(' • ') : 'Align the card horizontally');
        await awaitDelay(120);
        return step(false);
      }

      // Convert to blob and return
      const dataURL = outCanvas.toDataURL('image/png');
      const blob = await (await fetch(dataURL)).blob();
      const url = URL.createObjectURL(blob);
      const imgObj = { id: Date.now(), url, blob, timestamp: new Date().toISOString(), type: side === 'front' ? 'front_card' : 'back_card' };
      return imgObj;
    };

    // Loop until success
    let first = true;
    while (true) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const res = await step(first);
      if (res) return res;
      first = false;
    }
  }
}