// // facescan.js — v4.1 (FaceMesh pose gate: reject tilted/turned heads)
// // - Single face only, min size, sharpness, illumination, AND FaceMesh-based pose check
// // - Roll (tilt) from eye-line; yaw/pitch from nose vs eye midpoint (stable with FaceMesh)
// // - Backbuffer + robust sharpness metric to avoid "sharpness: 0"

import React, { useEffect, useRef } from "react";
import { FaceDetection } from "@mediapipe/face_detection";
import { FaceMesh } from "@mediapipe/face_mesh";

// ---------- Thresholds ----------
function getThresholds() {
  // Optional runtime overrides: window.AUTO_CAPTURE.THRESHOLDS = {...}
  const t =
    (typeof window !== "undefined" &&
      window.AUTO_CAPTURE &&
      window.AUTO_CAPTURE.THRESHOLDS) ||
    {};
  return {
    // Detection / size
    minDetConfidence: t.minDetConfidence ?? 0.2,
    minBoxCoverage: t.minBoxCoverage ?? 0.08,

    // Image quality
    minSharpness: t.minSharpness ?? 3,  // a bit stricter
    minIllumination: t.minIllumination ?? 25,
    
    // Stability / cadence
    requiredStableFrames: t.requiredStableFrames ?? 5,
    cooldownMs: t.cooldownMs ?? 2500,

    // Crop padding
    pad: t.pad ?? 0.22,

    // Pose (degrees) — required to reject tilt/side faces
    usePose: true,           // force ON (ignores t.usePose if false)
    maxYaw: t.maxYaw ?? 30, // side turn
    maxPitch: t.maxPitch ?? 65, // up/down nod
    maxRoll: t.maxRoll ?? 10, // head tilt
  };

}

// ---------- Utils ----------
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const toBlobAsync = (canvas, type = "image/jpeg", quality = 0.92) =>
  new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));

function sharpnessScore(ctx, w, h) {
  if (w < 3 || h < 3) return 0;
  const { data } = ctx.getImageData(0, 0, w, h);

  // Basic blank-frame guard
  const probe = (i) => 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  if (probe(0) < 2 && probe(((w * h * 4) >> 1)) < 2 && probe(w * h * 4 - 4) < 2) return 0;

  // Variance of Laplacian on luminance
  const idx = (x, y) => 4 * (y * w + x);
  let sum = 0, sumSq = 0, n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = idx(x, y);
      const L = probe(i);
      const Up = probe(idx(x, y - 1));
      const Dn = probe(idx(x, y + 1));
      const Lf = probe(idx(x - 1, y));
      const Rt = probe(idx(x + 1, y));
      const lap = -4 * L + Up + Dn + Lf + Rt;
      sum += lap; sumSq += lap * lap; n++;
    }
  }
  if (!n) return 0;
  const mean = sum / n;
  const variance = sumSq / n - mean * mean;
  return Math.max(0, Math.min(100, (variance / 2500) * 100));
}

function illuminationScore(ctx, w, h) {
  if (w < 1 || h < 1) return 0;
  const { data } = ctx.getImageData(0, 0, w, h);
  let tot = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) {
    tot += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    n++;
  }
  return Math.max(0, Math.min(100, (tot / (n || 1)) / 2.55));
}

// FaceDetection box accessor (supports multiple shapes)
function getRelBox(det) {
  const rb = det?.locationData?.relativeBoundingBox;
  if (rb && typeof rb.xMin === "number") {
    const xCenter = rb.xMin + rb.width / 2;
    const yCenter = rb.yMin + rb.height / 2;
    return { xCenter, yCenter, width: rb.width, height: rb.height };
  }
  if (det?.boundingBox?.xCenter != null) return det.boundingBox;
  if (det?.relativeBoundingBox?.xCenter != null) return det.relativeBoundingBox;
  return null;
}

// ---------- Pose from FaceMesh ----------
/**
 * Compute yaw/pitch/roll (degrees) from FaceMesh landmarks.
 * Uses robust indices:
 * - LEFT_EYE_OUTER = 33, RIGHT_EYE_OUTER = 263
 * - NOSE_TIP = 1
 * - MOUTH_CENTER ~ 13 (not essential here)
 * Roll = eye-line slope; Yaw/Pitch = nose vs eye-mid normalized by inter-ocular distance.
 */
// --- Replace your poseFromMesh with this version ---
function poseFromMesh(landmarks) {
  // Guard
  if (!landmarks || landmarks.length < 330) return { yaw: 999, pitch: 999, roll: 999 };

  // Eye corners (robust)
  const L = landmarks[33];   // LEFT_EYE_OUTER
  const R = landmarks[263];  // RIGHT_EYE_OUTER

  // Nose refs (robust against model variance):
  // Prefer true tip (4), else 1; also compute nostril mid (98, 327)
  const NT = landmarks[4] || landmarks[1];   // nose tip
  const NL = landmarks[98];                  // left nostril
  const NR = landmarks[327];                 // right nostril
  const NM = (NL && NR)
    ? { x: (NL.x + NR.x) / 2, y: (NL.y + NR.y) / 2, z: ((NL.z || 0) + (NR.z || 0)) / 2 }
    : NT;

  // Eye baseline
  const dx = R.x - L.x;
  const dy = R.y - L.y;
  const inter = Math.hypot(dx, dy) || 1e-6;

  // Roll from eye-line (in degrees, ~0 when eyes level)
  const roll = (Math.atan2(dy, dx) * 180) / Math.PI;

  // Eye midpoint
  const mx = (R.x + L.x) / 2;
  const my = (R.y + L.y) / 2;

  // ---- De-roll: rotate points by -roll so tilt doesn't leak into yaw/pitch ----
  const rad = -Math.atan2(dy, dx); // -roll in radians
  const cos = Math.cos(rad), sin = Math.sin(rad);

  const rot = (p) => {
    const x = p.x - mx, y = p.y - my;
    return { x: x * cos - y * sin, y: x * sin + y * cos };
  };

  const nose = rot(NM); // use nostril-mid (or nose tip fallback) as orientation anchor

  // Yaw (left/right) from horizontal offset; Pitch (up/down) from vertical offset
  // Scale by inter-ocular distance to be size-invariant. y grows downward in FaceMesh.
  const yaw = (nose.x / inter) * 90;
  const pitch = (nose.y / inter) * 90;

  return { yaw, pitch, roll };
}


export default function FaceAutoCapture({
  remoteVideoRef,
  overlayCanvasRef,
  connectionState,
  scanningSide,        // kept for compatibility
  enabled = true,
  onFaceCaptured,      // ({ id, url, blob, timestamp, type, metrics })
  setStatus,           // (string)
}) {
  const thrRef = useRef(getThresholds());

  // MediaPipe instances
  const fdRef = useRef(null);
  const fmRef = useRef(null);

  // State refs
  const lastGoodRef = useRef(0);
  const lastShotAtRef = useRef(0);
  const capturingRef = useRef(false); // prevents races / multiple captures

  // Backbuffer & crop buffers
  const frameCanvasRef = useRef(null);
  const frameCtxRef = useRef(null);
  const cropCanvasRef = useRef(null);
  const cropCtxRef = useRef(null);

  // Callbacks
  const onFaceCapturedRef = useRef(onFaceCaptured);
  const setStatusRef = useRef(setStatus);
  useEffect(() => { onFaceCapturedRef.current = onFaceCaptured; }, [onFaceCaptured]);
  useEffect(() => { setStatusRef.current = setStatus; }, [setStatus]);
  useEffect(() => { thrRef.current = getThresholds(); });
   

  // Keep overlay sized to video
  useEffect(() => {
    const video = remoteVideoRef?.current;
    const overlay = overlayCanvasRef?.current;
    if (!video || !overlay) return;
    const sync = () => {
      overlay.width = video.videoWidth || video.clientWidth || overlay.width;
      overlay.height = video.videoHeight || video.clientHeight || overlay.height;
    };
    sync();
    const onMeta = () => sync();
    window.addEventListener("resize", sync);
    video.addEventListener("loadedmetadata", onMeta);
    return () => {
      window.removeEventListener("resize", sync);
      video.removeEventListener("loadedmetadata", onMeta);
    };
  }, [remoteVideoRef, overlayCanvasRef]);

  useEffect(() => {
    if (!enabled || connectionState !== "connected") return;
    if (!remoteVideoRef?.current) return;

    let cancelled = false;
    let rafId = 0;

    // Canvases
    cropCanvasRef.current = document.createElement("canvas");
    cropCtxRef.current = cropCanvasRef.current.getContext("2d", { willReadFrequently: true });
    cropCtxRef.current.imageSmoothingEnabled = false;

    frameCanvasRef.current = document.createElement("canvas");
    frameCtxRef.current = frameCanvasRef.current.getContext("2d", { willReadFrequently: true });
    frameCtxRef.current.imageSmoothingEnabled = false;

    // FaceDetection
    const fd = new FaceDetection({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`,
    });
    fd.setOptions({ model: "short", minDetectionConfidence: thrRef.current.minDetConfidence });
    fdRef.current = fd;

    // FaceMesh (for pose)
    const fm = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });
    fm.setOptions({
      maxNumFaces: 1,
      refineLandmarks: false,
      selfieMode: true,
    });
    fmRef.current = fm;

    // Helper: FaceMesh run returning landmarks once
    const runMesh = () =>
      new Promise((resolve) => {
        const handler = (res) => {
          resolve(res?.multiFaceLandmarks?.[0] || null);
        };
        fm.onResults(handler);
        // Use the same full frame (backbuffer) we draw for FD
        fm.send({ image: frameCanvasRef.current });
      });

    const drawOverlay = (box, color) => {
      const overlay = overlayCanvasRef?.current;
      const v = remoteVideoRef?.current;
      if (!overlay || !v) return;
      const ctx = overlay.getContext("2d"); if (!ctx) return;

      const W = v.videoWidth || 1, H = v.videoHeight || 1;
      const sx = (overlay.width || W) / W;
      const sy = (overlay.height || H) / H;
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      if (!box) return;
      ctx.strokeStyle = color; ctx.lineWidth = 3;
      ctx.strokeRect(Math.round(box.x * sx), Math.round(box.y * sy),
        Math.round(box.w * sx), Math.round(box.h * sy));
    };

    fd.onResults(async (fdRes) => {
      if (cancelled) return;

      const v = remoteVideoRef?.current;
      if (!v || v.readyState < 2 || !v.videoWidth || !v.videoHeight) {
        lastGoodRef.current = 0;
        drawOverlay(null, "#ef4444");
        setStatusRef.current?.("Video not ready");
        return;
      }

      // Backbuffer draw (ensures we're sampling real pixels)
      const W = v.videoWidth, H = v.videoHeight;
      if (frameCanvasRef.current.width !== W || frameCanvasRef.current.height !== H) {
        frameCanvasRef.current.width = W;
        frameCanvasRef.current.height = H;
      }
      frameCtxRef.current.drawImage(v, 0, 0, W, H);

      const dets = fdRes?.detections || [];
      if (dets.length !== 1) {
        lastGoodRef.current = 0;
        drawOverlay(null, "#ef4444");
        setStatusRef.current?.(dets.length === 0 ? "No face" : "Multiple faces");
        return;
      }

      const rel = getRelBox(dets[0]);
      if (!rel) {
        lastGoodRef.current = 0;
        drawOverlay(null, "#ef4444");
        setStatusRef.current?.("No box");
        return;
      }

      // Box + padding
      const pad = thrRef.current.pad;
      const baseW = rel.width * W;
      const baseH = rel.height * H * 1.20; // include chin/forehead
      let x = (rel.xCenter - rel.width / 2) * W - baseW * pad;
      let y = (rel.yCenter - rel.height / 2) * H - baseH * (pad + 0.10);
      let w = baseW * (1 + 2 * pad);
      let h = baseH * (1 + 2 * pad);

      x = Math.round(clamp(x, 0, Math.max(0, W - 1)));
      y = Math.round(clamp(y, 0, Math.max(0, H - 1)));
      w = Math.round(clamp(w, 1, W - x));
      h = Math.round(clamp(h, 1, H - y));

      const coverage = (w * h) / (W * H);
      if (coverage < thrRef.current.minBoxCoverage) {
        lastGoodRef.current = 0;
        drawOverlay({ x, y, w, h }, "#ef4444");
        setStatusRef.current?.("Too far");
        return;
      }

      // Crop FROM backbuffer
      const crop = cropCanvasRef.current;
      if (crop.width !== w || crop.height !== h) { crop.width = w; crop.height = h; }
      cropCtxRef.current.drawImage(frameCanvasRef.current, x, y, w, h, 0, 0, w, h);

      // Quality
      const sharp = sharpnessScore(cropCtxRef.current, w, h);
      if (sharp === 0) {
        lastGoodRef.current = 0;
        drawOverlay({ x, y, w, h }, "#ef4444");
        setStatusRef.current?.("Waiting for pixels…");
        return;
      }
      const illum = illuminationScore(cropCtxRef.current, w, h);

      // Pose (FaceMesh)
      let yaw = 0, pitch = 0, roll = 0, poseOK = true;
      if (thrRef.current.usePose) {
        const lms = await runMesh(); // landmarks for this frame
        if (!lms) {
          lastGoodRef.current = 0;
          drawOverlay({ x, y, w, h }, "#ef4444");
          setStatusRef.current?.("Align face in frame");
          return;
        }
        const pose = poseFromMesh(lms);
        yaw = pose.yaw; pitch = pose.pitch; roll = pose.roll;
        poseOK =
          Math.abs(yaw) <= thrRef.current.maxYaw &&
          Math.abs(pitch) <= thrRef.current.maxPitch &&
          Math.abs(roll) <= thrRef.current.maxRoll;
      }

      // Decide
      const sharpOK = sharp >= thrRef.current.minSharpness;
      const illumOK = illum >= thrRef.current.minIllumination;
      const allGood = sharpOK && illumOK && poseOK;

      if (allGood) lastGoodRef.current += 1;
      else lastGoodRef.current = 0;
      if (!capturingRef.current) {
        const color = allGood ? "#16a34a" : poseOK ? "#f59e0b" : "#ef4444";
        drawOverlay({ x, y, w, h }, color);

        setStatusRef.current?.(
          allGood
            ? `OK ${lastGoodRef.current}/${thrRef.current.requiredStableFrames}`
            : !poseOK
              ? `Keep face straight (yaw:${Math.round(yaw)}° pitch:${Math.round(pitch)}° roll:${Math.round(roll)}°)`
              : !sharpOK
                ? `Increase clarity (sharp:${Math.round(sharp)})`
                : `Improve lighting (illum:${Math.round(illum)})`
        );
      }


      // Cooldown
      const now = Date.now();
      if (now - lastShotAtRef.current < thrRef.current.cooldownMs) return;

      // Capture
      if (lastGoodRef.current >= thrRef.current.requiredStableFrames && !capturingRef.current) {
        capturingRef.current = true;
        lastGoodRef.current = 0;
        lastShotAtRef.current = now;

        try {
          const blob = await toBlobAsync(crop, "image/jpeg", 0.92);
          const url = URL.createObjectURL(blob);

          // notify parent
          onFaceCapturedRef.current?.({
            id: now,
            url,
            blob,
            timestamp: new Date(now).toISOString(),
            type: "face",
            metrics: {
              sharp: Math.round(sharp),
              illumination: Math.round(illum),
              yaw: Math.round(yaw),
              pitch: Math.round(pitch),
              roll: Math.round(roll),
              coverage: +coverage.toFixed(3),
            },
          });

          
          setStatusRef.current?.("face-captured");
          setStatusRef.current?.("face-captured");
          console.log("[facescan] face captured -> status set to 'face-captured'");
          setTimeout(() => {
            // Your next logic here
            console.log("Delay finished, proceed to the next step...");
          }, 2000);

          // keep the capture lock for a short window so nothing else immediately overwrites the status.
          // If you want to keep it locked until the parent acknowledges upload, replace this timeout with
          // an explicit ACK mechanism (recommended for reliable uploads).
          setTimeout(() => {
            capturingRef.current = false;
          }, 1200); // 1.2s lock — adjust if uploads take longer

        }
        catch (err) {
          console.error("[facescan] capture failed:", err);
          // release lock so next opportunity can try again
          capturingRef.current = false;
        }

      }
    });

    // Feed frames
    const feed = async () => {
      if (cancelled) return;
      const v = remoteVideoRef?.current;
      if (!v || v.readyState < 2 || !v.videoWidth || !v.videoHeight) {
        rafId = requestAnimationFrame(feed);
        return;
      }
      try { await fdRef.current?.send({ image: v }); } catch { }
      rafId = requestAnimationFrame(feed);
    };
    rafId = requestAnimationFrame(feed);

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      try { fdRef.current?.close?.(); } catch { }
      try { fmRef.current?.close?.(); } catch { }
      fdRef.current = null;
      fmRef.current = null;

      frameCanvasRef.current = null;
      frameCtxRef.current = null;
      cropCanvasRef.current = null;
      cropCtxRef.current = null;

      const overlay = overlayCanvasRef?.current;
      if (overlay) {
        const ctx = overlay.getContext("2d");
        ctx && ctx.clearRect(0, 0, overlay.width, overlay.height);
      }
    };
  }, [enabled, connectionState, remoteVideoRef, overlayCanvasRef]);

  // Live-update detection confidence if changed at runtime
  useEffect(() => {
    if (fdRef.current) {
      fdRef.current.setOptions({
        minDetectionConfidence: thrRef.current.minDetConfidence,
      });
    }
  });

  return null;
}

// facescan.js — v4.2 (Multi-face tolerant + portrait-preview)
// - Chooses LARGEST face when multiple faces exist (configurable via requireSingleFace).
// - Renders live portrait preview: blurred background + sharp oval around primary face.
// - Keeps FaceMesh pose checks, sharpness, illumination, cooldowns, and capture flow.
// - Minimal changes to original flow; added portrait canvas and selection logic.

// Based on original uploaded file (facescan.js v4.1). :contentReference[oaicite:1]{index=1}


/*
import React, { useEffect, useRef } from "react";
import { FaceDetection } from "@mediapipe/face_detection";
import { FaceMesh } from "@mediapipe/face_mesh";

// ---------- Thresholds ----------
function getThresholds() {
  // Optional runtime overrides: window.AUTO_CAPTURE.THRESHOLDS = {...}
  const t =
    (typeof window !== "undefined" &&
      window.AUTO_CAPTURE &&
      window.AUTO_CAPTURE.THRESHOLDS) ||
    {};
  return {
    // Detection / size
    minDetConfidence: t.minDetConfidence ?? 0.2,
    minBoxCoverage: t.minBoxCoverage ?? 0.08,

    // Image quality
    minSharpness: t.minSharpness ?? 5, // a bit stricter
    minIllumination: t.minIllumination ?? 25,

    // Stability / cadence
    requiredStableFrames: t.requiredStableFrames ?? 5,
    cooldownMs: t.cooldownMs ?? 2500,

    // Crop padding
    pad: t.pad ?? 0.22,

    // Pose (degrees)
    usePose: true,
    maxYaw: t.maxYaw ?? 30,
    maxPitch: t.maxPitch ?? 50,
    maxRoll: t.maxRoll ?? 10,

    // New options
    requireSingleFace: t.requireSingleFace ?? false, // if true: preserve original strict single-face requirement
    portraitBlurPx: t.portraitBlurPx ?? 12,
    ovalPortraitPadding: t.ovalPortraitPadding ?? 0.35,
  };
}

// ---------- Utils ----------
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const toBlobAsync = (canvas, type = "image/jpeg", quality = 0.92) =>
  new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));

function sharpnessScore(ctx, w, h) {
  if (w < 3 || h < 3) return 0;
  const { data } = ctx.getImageData(0, 0, w, h);

  // Basic blank-frame guard
  const probe = (i) => 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  if (probe(0) < 2 && probe(((w * h * 4) >> 1)) < 2 && probe(w * h * 4 - 4) < 2) return 0;

  // Variance of Laplacian on luminance
  const idx = (x, y) => 4 * (y * w + x);
  let sum = 0, sumSq = 0, n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = idx(x, y);
      const L = probe(i);
      const Up = probe(idx(x, y - 1));
      const Dn = probe(idx(x, y + 1));
      const Lf = probe(idx(x - 1, y));
      const Rt = probe(idx(x + 1, y));
      const lap = -4 * L + Up + Dn + Lf + Rt;
      sum += lap; sumSq += lap * lap; n++;
    }
  }
  if (!n) return 0;
  const mean = sum / n;
  const variance = sumSq / n - mean * mean;
  return Math.max(0, Math.min(100, (variance / 2500) * 100));
}

function illuminationScore(ctx, w, h) {
  if (w < 1 || h < 1) return 0;
  const { data } = ctx.getImageData(0, 0, w, h);
  let tot = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) {
    tot += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    n++;
  }
  return Math.max(0, Math.min(100, (tot / (n || 1)) / 2.55));
}

// FaceDetection box accessor (supports multiple shapes)
function getRelBox(det) {
  const rb = det?.locationData?.relativeBoundingBox;
  if (rb && typeof rb.xMin === "number") {
    const xCenter = rb.xMin + rb.width / 2;
    const yCenter = rb.yMin + rb.height / 2;
    return { xCenter, yCenter, width: rb.width, height: rb.height };
  }
  if (det?.boundingBox?.xCenter != null) return det.boundingBox;
  if (det?.relativeBoundingBox?.xCenter != null) return det.relativeBoundingBox;
  return null;
}

// ---------- Pose from FaceMesh (unchanged) ----------
function poseFromMesh(landmarks) {
  if (!landmarks || landmarks.length < 330) return { yaw: 999, pitch: 999, roll: 999 };
  const L = landmarks[33];
  const R = landmarks[263];
  const NT = landmarks[4] || landmarks[1];
  const NL = landmarks[98];
  const NR = landmarks[327];
  const NM = (NL && NR)
    ? { x: (NL.x + NR.x) / 2, y: (NL.y + NR.y) / 2, z: ((NL.z || 0) + (NR.z || 0)) / 2 }
    : NT;

  const dx = R.x - L.x;
  const dy = R.y - L.y;
  const inter = Math.hypot(dx, dy) || 1e-6;
  const roll = (Math.atan2(dy, dx) * 180) / Math.PI;
  const mx = (R.x + L.x) / 2;
  const my = (R.y + L.y) / 2;
  const rad = -Math.atan2(dy, dx);
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const rot = (p) => {
    const x = p.x - mx, y = p.y - my;
    return { x: x * cos - y * sin, y: x * sin + y * cos };
  };
  const nose = rot(NM);
  const yaw = (nose.x / inter) * 90;
  const pitch = (nose.y / inter) * 90;
  return { yaw, pitch, roll };
}

export default function FaceAutoCapture({
  remoteVideoRef,
  overlayCanvasRef,
  connectionState,
  scanningSide,
  enabled = true,
  onFaceCaptured,
  setStatus,
}) {
  const thrRef = useRef(getThresholds());

  // MediaPipe instances
  const fdRef = useRef(null);
  const fmRef = useRef(null);

  // State refs
  const lastGoodRef = useRef(0);
  const lastShotAtRef = useRef(0);

  // Backbuffer & crop buffers
  const frameCanvasRef = useRef(null);
  const frameCtxRef = useRef(null);
  const cropCanvasRef = useRef(null);
  const cropCtxRef = useRef(null);

  // Portrait preview buffer
  const portraitCanvasRef = useRef(null);
  const portraitCtxRef = useRef(null);

  const onFaceCapturedRef = useRef(onFaceCaptured);
  const setStatusRef = useRef(setStatus);
  useEffect(() => { onFaceCapturedRef.current = onFaceCaptured; }, [onFaceCaptured]);
  useEffect(() => { setStatusRef.current = setStatus; }, [setStatus]);
  useEffect(() => { thrRef.current = getThresholds(); });

  // Keep overlay sized to video
  useEffect(() => {
    const video = remoteVideoRef?.current;
    const overlay = overlayCanvasRef?.current;
    if (!video || !overlay) return;
    const sync = () => {
      overlay.width = video.videoWidth || video.clientWidth || overlay.width;
      overlay.height = video.videoHeight || video.clientHeight || overlay.height;
    };
    sync();
    const onMeta = () => sync();
    window.addEventListener("resize", sync);
    video.addEventListener("loadedmetadata", onMeta);
    return () => {
      window.removeEventListener("resize", sync);
      video.removeEventListener("loadedmetadata", onMeta);
    };
  }, [remoteVideoRef, overlayCanvasRef]);

  useEffect(() => {
    if (!enabled || connectionState !== "connected") return;
    if (!remoteVideoRef?.current) return;

    let cancelled = false;
    let rafId = 0;

    // Canvases
    cropCanvasRef.current = document.createElement("canvas");
    cropCtxRef.current = cropCanvasRef.current.getContext("2d", { willReadFrequently: true });
    cropCtxRef.current.imageSmoothingEnabled = false;

    frameCanvasRef.current = document.createElement("canvas");
    frameCtxRef.current = frameCanvasRef.current.getContext("2d", { willReadFrequently: true });
    frameCtxRef.current.imageSmoothingEnabled = false;

    portraitCanvasRef.current = document.createElement("canvas");
    portraitCtxRef.current = portraitCanvasRef.current.getContext("2d", { willReadFrequently: true });

    // FaceDetection
    const fd = new FaceDetection({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`,
    });
    fd.setOptions({ model: "short", minDetectionConfidence: thrRef.current.minDetConfidence });
    fdRef.current = fd;

    // FaceMesh (for pose)
    const fm = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });
    fm.setOptions({
      maxNumFaces: 1,
      refineLandmarks: false,
      selfieMode: true,
    });
    fmRef.current = fm;

    // FaceMesh helper (single-run)
    const runMesh = () =>
      new Promise((resolve) => {
        const handler = (res) => {
          resolve(res?.multiFaceLandmarks?.[0] || null);
        };
        fm.onResults(handler);
        fm.send({ image: frameCanvasRef.current });
      });

    // Draw overlay bounding box
    const drawOverlay = (box, color) => {
      const overlay = overlayCanvasRef?.current;
      const v = remoteVideoRef?.current;
      if (!overlay || !v) return;
      const ctx = overlay.getContext("2d"); if (!ctx) return;

      const W = v.videoWidth || 1, H = v.videoHeight || 1;
      const sx = (overlay.width || W) / W;
      const sy = (overlay.height || H) / H;
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      if (!box) return;
      ctx.strokeStyle = color; ctx.lineWidth = 3;
      ctx.strokeRect(Math.round(box.x * sx), Math.round(box.y * sy),
        Math.round(box.w * sx), Math.round(box.h * sy));
    };

    // Portrait render onto overlayCanvas: blurred background + clear oval around primary face
    const renderPortraitPreview = (primaryBox) => {
      const overlay = overlayCanvasRef?.current;
      const v = remoteVideoRef?.current;
      const frame = frameCanvasRef.current;
      const pC = portraitCanvasRef.current;
      if (!overlay || !v || !frame || !pC) return;
      const W = v.videoWidth || 1, H = v.videoHeight || 1;
      // sync portrait canvas to video dims
      if (pC.width !== W || pC.height !== H) { pC.width = W; pC.height = H; }
      const pCtx = portraitCtxRef.current;
      pCtx.clearRect(0, 0, W, H);

      // draw blurred background from frame
      pCtx.save();
      pCtx.filter = `blur(${thrRef.current.portraitBlurPx}px)`;
      pCtx.drawImage(frame, 0, 0, W, H);
      pCtx.restore();

      if (!primaryBox) {
        // copy to overlay scaled
        const outCtx = overlay.getContext("2d");
        outCtx.clearRect(0, 0, overlay.width, overlay.height);
        outCtx.drawImage(pC, 0, 0, overlay.width, overlay.height);
        return;
      }

      // compute expanded oval region
      const pad = thrRef.current.ovalPortraitPadding;
      const cx = primaryBox.x + primaryBox.w / 2;
      const cy = primaryBox.y + primaryBox.h / 2;
      const rx = (primaryBox.w / 2) + primaryBox.w * pad;
      const ry = (primaryBox.h / 2) + primaryBox.h * pad;

      // clip oval and draw sharp pixels from the original frame
      pCtx.save();
      pCtx.beginPath();
      pCtx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
      pCtx.closePath();
      pCtx.clip();
      pCtx.drawImage(frame, 0, 0, W, H);
      pCtx.restore();

      // subtle stroke around oval
      pCtx.save();
      pCtx.lineWidth = 3;
      pCtx.strokeStyle = 'rgba(255,255,255,0.14)';
      pCtx.beginPath();
      pCtx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
      pCtx.stroke();
      pCtx.restore();

      // copy portrait canvas into overlay (scaled to overlay size)
      const outCtx = overlay.getContext("2d");
      outCtx.clearRect(0, 0, overlay.width, overlay.height);
      outCtx.drawImage(pC, 0, 0, overlay.width, overlay.height);
    };

    // select largest detection (by area)
    const chooseLargest = (dets, W, H) => {
      const boxes = dets.map(d => {
        const rel = getRelBox(d);
        if (!rel) return null;
        const x = (rel.xCenter - rel.width / 2) * W;
        const y = (rel.yCenter - rel.height / 2) * H;
        const w = rel.width * W;
        const h = rel.height * H;
        return { raw: d, x: clamp(Math.round(x), 0, W - 1), y: clamp(Math.round(y), 0, H - 1), w: Math.round(w), h: Math.round(h), area: w * h, rel };
      }).filter(Boolean);
      if (!boxes.length) return null;
      boxes.sort((a, b) => b.area - a.area);
      return boxes[0];
    };

    fd.onResults(async (fdRes) => {
      if (cancelled) return;

      const v = remoteVideoRef?.current;
      if (!v || v.readyState < 2 || !v.videoWidth || !v.videoHeight) {
        lastGoodRef.current = 0;
        drawOverlay(null, "#ef4444");
        renderPortraitPreview(null);
        setStatusRef.current?.("Video not ready");
        return;
      }

      // Backbuffer draw
      const W = v.videoWidth, H = v.videoHeight;
      if (frameCanvasRef.current.width !== W || frameCanvasRef.current.height !== H) {
        frameCanvasRef.current.width = W;
        frameCanvasRef.current.height = H;
      }
      frameCtxRef.current.drawImage(v, 0, 0, W, H);

      const dets = fdRes?.detections || [];

      // If strict single-face is requested, preserve old behavior
      if (thrRef.current.requireSingleFace && dets.length !== 1) {
        lastGoodRef.current = 0;
        drawOverlay(null, "#ef4444");
        renderPortraitPreview(null);
        setStatusRef.current?.(dets.length === 0 ? "No face" : "Multiple faces");
        return;
      }

      if (dets.length === 0) {
        lastGoodRef.current = 0;
        drawOverlay(null, "#ef4444");
        renderPortraitPreview(null);
        setStatusRef.current?.("No face");
        return;
      }

      // choose primary (largest) detection
      const primary = chooseLargest(dets, W, H);
      if (!primary) {
        lastGoodRef.current = 0;
        drawOverlay(null, "#ef4444");
        renderPortraitPreview(null);
        setStatusRef.current?.("No box");
        return;
      }

      // convert primary.rel (normalized) into padded crop coords similar to previous code
      const rel = primary.rel;
      const pad = thrRef.current.pad;
      const baseW = rel.width * W;
      const baseH = rel.height * H * 1.20;
      let x = (rel.xCenter - rel.width / 2) * W - baseW * pad;
      let y = (rel.yCenter - rel.height / 2) * H - baseH * (pad + 0.10);
      let w = baseW * (1 + 2 * pad);
      let h = baseH * (1 + 2 * pad);

      x = Math.round(clamp(x, 0, Math.max(0, W - 1)));
      y = Math.round(clamp(y, 0, Math.max(0, H - 1)));
      w = Math.round(clamp(w, 1, W - x));
      h = Math.round(clamp(h, 1, H - y));

      const coverage = (w * h) / (W * H);
      if (coverage < thrRef.current.minBoxCoverage) {
        lastGoodRef.current = 0;
        drawOverlay({ x, y, w, h }, "#ef4444");
        renderPortraitPreview({ x, y, w, h });
        setStatusRef.current?.("Too far");
        return;
      }

      // Crop from backbuffer
      const crop = cropCanvasRef.current;
      if (crop.width !== w || crop.height !== h) { crop.width = w; crop.height = h; }
      cropCtxRef.current.drawImage(frameCanvasRef.current, x, y, w, h, 0, 0, w, h);

      // Quality checks
      const sharp = sharpnessScore(cropCtxRef.current, w, h);
      if (sharp === 0) {
        lastGoodRef.current = 0;
        drawOverlay({ x, y, w, h }, "#ef4444");
        renderPortraitPreview({ x, y, w, h });
        setStatusRef.current?.("Waiting for pixels…");
        return;
      }
      const illum = illuminationScore(cropCtxRef.current, w, h);

      // Pose checking using FaceMesh on full frame (robust)
      let yaw = 0, pitch = 0, roll = 0, poseOK = true;
      if (thrRef.current.usePose) {
        const lms = await runMesh();
        if (!lms) {
          lastGoodRef.current = 0;
          drawOverlay({ x, y, w, h }, "#ef4444");
          renderPortraitPreview({ x, y, w, h });
          setStatusRef.current?.("Align face in frame");
          return;
        }
        const pose = poseFromMesh(lms);
        yaw = pose.yaw; pitch = pose.pitch; roll = pose.roll;
        poseOK =
          Math.abs(yaw) <= thrRef.current.maxYaw &&
          Math.abs(pitch) <= thrRef.current.maxPitch &&
          Math.abs(roll) <= thrRef.current.maxRoll;
      }

      const sharpOK = sharp >= thrRef.current.minSharpness;
      const illumOK = illum >= thrRef.current.minIllumination;
      const allGood = sharpOK && illumOK && poseOK;

      if (allGood) lastGoodRef.current += 1;
      else lastGoodRef.current = 0;

      const color = allGood ? "#16a34a" : poseOK ? "#f59e0b" : "#ef4444";
      drawOverlay({ x, y, w, h }, color);
      renderPortraitPreview({ x, y, w, h });

      setStatusRef.current?.(
        allGood
          ? `OK ${lastGoodRef.current}/${thrRef.current.requiredStableFrames}`
          : !poseOK
            ? `Keep face straight (yaw:${Math.round(yaw)}° pitch:${Math.round(pitch)}° roll:${Math.round(roll)}°)`
            : !sharpOK
              ? `Increase clarity (sharp:${Math.round(sharp)})`
              : `Improve lighting (illum:${Math.round(illum)})`
      );

      // Cooldown
      const now = Date.now();
      if (now - lastShotAtRef.current < thrRef.current.cooldownMs) return;

      // Capture
      if (lastGoodRef.current >= thrRef.current.requiredStableFrames) {
        lastGoodRef.current = 0;
        lastShotAtRef.current = now;

        const blob = await toBlobAsync(crop, "image/jpeg", 0.92);
        const url = URL.createObjectURL(blob);
        onFaceCapturedRef.current?.({
          id: now,
          url,
          blob,
          timestamp: new Date(now).toISOString(),
          type: "face",
          metrics: {
            sharp: Math.round(sharp),
            illumination: Math.round(illum),
            yaw: Math.round(yaw),
            pitch: Math.round(pitch),
            roll: Math.round(roll),
            coverage: +coverage.toFixed(3),
          },
        });
        setStatusRef.current?.("Face auto-captured");
      }
    });

    // Feed frames loop
    const feed = async () => {
      if (cancelled) return;
      const v = remoteVideoRef?.current;
      if (!v || v.readyState < 2 || !v.videoWidth || !v.videoHeight) {
        rafId = requestAnimationFrame(feed);
        return;
      }
      try { await fdRef.current?.send({ image: v }); } catch { }
      rafId = requestAnimationFrame(feed);
    };
    rafId = requestAnimationFrame(feed);

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      try { fdRef.current?.close?.(); } catch { }
      try { fmRef.current?.close?.(); } catch { }
      fdRef.current = null;
      fmRef.current = null;

      frameCanvasRef.current = null;
      frameCtxRef.current = null;
      cropCanvasRef.current = null;
      cropCtxRef.current = null;
      portraitCanvasRef.current = null;
      portraitCtxRef.current = null;

      const overlay = overlayCanvasRef?.current;
      if (overlay) {
        const ctx = overlay.getContext("2d");
        ctx && ctx.clearRect(0, 0, overlay.width, overlay.height);
      }
    };
  }, [enabled, connectionState, remoteVideoRef, overlayCanvasRef]);

  // Live-update detection confidence if changed at runtime
  useEffect(() => {
    if (fdRef.current) {
      fdRef.current.setOptions({
        minDetectionConfidence: thrRef.current.minDetConfidence,
      });
    }
  });

  return null;
}
*/