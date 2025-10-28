// FaceAutoCapture.js
// Standalone, dependency-free auto face capture for a remote <video> stream.
// Heuristics-based (box-in-center, size, brightness, blur) with a stability counter.
// Props:
//   - remoteVideoRef: React ref to <video> (the remote peer video)
//   - overlayCanvasRef: React ref to <canvas> atop the remote video (for guides)
//   - connectionState: string ('connected' to run)
//   - enabled: boolean toggle
//   - onFaceCaptured: (imgObj) => void
//   - setStatus: (msg) => void
//
// Notes:
// - This version uses simple image heuristics rather than a face model to avoid heavy deps.
// - You can plug in a real detector later by replacing computeFaceBox().

import React, { useEffect, useRef } from 'react';

function varianceOfLaplacian(gray, width, height) {
  // 3x3 Laplacian, returns variance as blur metric
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
  const mean = lap.reduce((a, b) => a + b, 0) / Math.max(1, lap.length);
  const variance = lap.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, lap.length);
  return variance;
}

function computeBrightnessStats(data) {
  let sum = 0, sum2 = 0, n = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const g = 0.2989 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    sum += g; sum2 += g * g;
  }
  const mean = sum / n;
  const std = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
  return { mean, std };
}

function drawGuide(ctx, w, h, target) {
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  // Face target box (center-ish)
  const { x, y, width, height } = target;
  ctx.strokeRect(x, y, width, height);
  ctx.font = '14px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText('Align your face inside the box', x + 6, y - 8);
}

function defaultTargetBox(w, h) {
  // Expect a portrait face area ~22% of height, centered horizontally,
  // slightly above exact center vertically (for typical framing)
  const faceH = Math.round(h * 0.30);
  const faceW = Math.round(faceH * 0.80);
  const x = Math.round(w * 0.5 - faceW / 2);
  const y = Math.round(h * 0.40 - faceH / 2);
  return { x, y, width: faceW, height: faceH };
}

function centerOverlap(box, target) {
  // overlap ratio between box and target
  const ax1 = box.x, ay1 = box.y, ax2 = box.x + box.width, ay2 = box.y + box.height;
  const bx1 = target.x, by1 = target.y, bx2 = target.x + target.width, by2 = target.y + target.height;
  const xi1 = Math.max(ax1, bx1), yi1 = Math.max(ay1, by1);
  const xi2 = Math.min(ax2, bx2), yi2 = Math.min(ay2, by2);
  const inter = Math.max(0, xi2 - xi1) * Math.max(0, yi2 - yi1);
  const areaA = Math.max(0, ax2 - ax1) * Math.max(0, ay2 - ay1);
  const areaB = Math.max(0, bx2 - bx1) * Math.max(0, by2 - by1);
  return inter / Math.max(1, areaA + areaB - inter);
}

function computeFaceBox(imageData, width, height) {
  // Very lightweight pseudo-detector:
  // - Use center target as expected face area.
  // - Return that as the "box".
  // You can wire a real face detector here later.
  const target = defaultTargetBox(width, height);
  return target;
}

export default function FaceAutoCapture({
  remoteVideoRef,
  overlayCanvasRef,
  connectionState,
  enabled,
  onFaceCaptured,
  setStatus
}) {
  const workCanvasRef = useRef(null);
  const rafRef = useRef(null);
  const stableRef = useRef(0);
  const lastCapturedAtRef = useRef(0);

  useEffect(() => {
    if (!overlayCanvasRef?.current) return;
    // Ensure overlay matches video element size
    const vc = overlayCanvasRef.current;
    const video = remoteVideoRef?.current;
    if (video) {
      const resize = () => {
        vc.width = video.clientWidth || video.videoWidth || 640;
        vc.height = video.clientHeight || video.videoHeight || 480;
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(video);
      return () => ro.disconnect();
    }
  }, [remoteVideoRef, overlayCanvasRef]);

  useEffect(() => {
    const video = remoteVideoRef?.current;
    const overlay = overlayCanvasRef?.current;
    if (!video || !overlay) return;

    if (!workCanvasRef.current) {
      workCanvasRef.current = document.createElement('canvas');
    }
    const work = workCanvasRef.current;
    const wctx = work.getContext('2d');
    const octx = overlay.getContext('2d');

    let running = true;
    const loop = () => {
      if (!running) return;
      rafRef.current = requestAnimationFrame(loop);

      if (!enabled || connectionState !== 'connected' || video.readyState < 2) {
        octx.clearRect(0, 0, overlay.width, overlay.height);
        return;
      }

      // Draw current frame into work canvas
      const vw = video.videoWidth || overlay.width;
      const vh = video.videoHeight || overlay.height;
      work.width = vw; work.height = vh;
      wctx.drawImage(video, 0, 0, vw, vh);
      const img = wctx.getImageData(0, 0, vw, vh);

      // Heuristics
      const target = defaultTargetBox(vw, vh);
      drawGuide(octx, overlay.width, overlay.height, {
        x: Math.round(target.x * overlay.width / vw),
        y: Math.round(target.y * overlay.height / vh),
        width: Math.round(target.width * overlay.width / vw),
        height: Math.round(target.height * overlay.height / vh),
      });

      const faceBox = computeFaceBox(img.data, vw, vh);
      const overlap = centerOverlap(faceBox, target);

      // Brightness & blur checks
      const { mean, std } = computeBrightnessStats(img.data);
      const gray = new Float32Array((vw) * (vh));
      for (let i = 0, p = 0; i < img.data.length; i += 4, p++) {
        gray[p] = 0.2989 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
      }
      const lapVar = varianceOfLaplacian(gray, vw, vh);

      const brightOk = mean >= 60 && mean <= 200;
      const contrastOk = std >= 28;
      const blurOk = lapVar >= 140;
      const centeredOk = overlap >= 0.45;

      if (setStatus) {
        const tips = [];
        if (!centeredOk) tips.push('center your face');
        if (!brightOk || !contrastOk) tips.push('add more light');
        if (!blurOk) tips.push('hold steady');
        if (tips.length) setStatus(tips.join(' • ')); else setStatus('Perfect — keep still');
      }

      if (centeredOk && brightOk && contrastOk && blurOk) {
        stableRef.current += 1;
      } else {
        stableRef.current = Math.max(0, stableRef.current - 1);
      }

      // Need a few stable frames before capture
      if (stableRef.current >= 10) {
        const now = Date.now();
        if (now - lastCapturedAtRef.current > 3000) {
          lastCapturedAtRef.current = now;
          // Capture crop = target box at full video resolution
          const sx = Math.max(0, Math.min(vw, target.x));
          const sy = Math.max(0, Math.min(vh, target.y));
          const sw = Math.max(1, Math.min(vw - sx, target.width));
          const sh = Math.max(1, Math.min(vh - sy, target.height));

          const crop = document.createElement('canvas');
          crop.width = sw; crop.height = sh;
          const cctx = crop.getContext('2d');
          cctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);

          crop.toBlob((blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const imgObj = {
              id: Date.now(),
              url,
              blob,
              timestamp: new Date().toISOString(),
              type: 'face'
            };
            onFaceCaptured?.(imgObj);
            setStatus?.('Face captured!');
          }, 'image/png', 0.92);

          stableRef.current = 0;
        }
      }
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      // Clear overlay
      try { octx.clearRect(0, 0, overlay.width, overlay.height); } catch {}
    };
  }, [remoteVideoRef, overlayCanvasRef, enabled, connectionState, onFaceCaptured, setStatus]);

  return null;
}