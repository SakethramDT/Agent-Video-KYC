import React, { useEffect, useRef, useState } from 'react';
import { Check, Video, VideoOff, Mic, MicOff, PhoneOff, X, Camera, RotateCcw } from 'lucide-react';
import io from 'socket.io-client';
import * as ort from 'onnxruntime-web';
import FaceAutoCapture from './facescan'; // added

// ===== Helper functions =====
const sigmoid = (x) => 1 / (1 + Math.exp(-x));
const xywh2xyxy = (boxes) => boxes.map(([x, y, w, h]) => [x - w / 2, y - h / 2, x + w / 2, y + h / 2]);
const boxInside = (inner, outer) =>
  inner[0] >= outer[0] && inner[1] >= outer[1] && inner[2] <= outer[2] && inner[3] <= outer[3];

const iou = (a, b) => {
  const [x1, y1, x2, y2] = a, [x1b, y1b, x2b, y2b] = b;
  const xi1 = Math.max(x1, x1b), yi1 = Math.max(y1, y1b);
  const xi2 = Math.min(x2, x2b), yi2 = Math.min(y2, y2b);
  const inter = Math.max(0, xi2 - xi1) * Math.max(0, yi2 - yi1);
  const areaA = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const areaB = Math.max(0, x2b - x1b) * Math.max(0, y2b - y1b);
  return inter / (areaA + areaB - inter + 1e-6);
};

const nonMaxSuppression = (boxes, scores, iouThreshold = 0.45) => {
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
};

// Simple Laplacian variance blur detector
const isImageBlurry = (canvas, threshold = 100) => {
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
};

// Brightness/contrast sanity check
function lightOk(canvas, meanRange = [25, 205], stdMin = 20) {
  const ctx = canvas.getContext('2d');
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let sum = 0, sum2 = 0, n = canvas.width * canvas.height;
  for (let i = 0; i < data.length; i += 4) {
    const g = 0.2989 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    sum += g;
    sum2 += g * g;
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

// ===== Constants =====
const MODEL_URL = '/AgentVideoKyc/models/id.onnx'; // ensure file exists at public/models/id.onnx
const SIGNAL_SERVER_URL = `${process.env.REACT_APP_BACKEND_URL}`;
const API_BASE_URL = `${process.env.REACT_APP_BACKEND_URL}`;

// Replace with your live ngrok host
const VERIFY_URL = 'https://3fed711b3302.ngrok-free.app/verify_images';
const RESULT_URL = 'https://3fed711b3302.ngrok-free.app/result';

export default function VideoCallModal({ roomId, agent, session, onClose }) {
  // call state
  const [connectionState, setConnectionState] = useState('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeCaptureType, setActiveCaptureType] = useState('face');
  const [isSavingImage, setIsSavingImage] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [ocrStatus, setOcrStatus] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [scanningSide, setScanningSide] = useState(null); // 'front' | 'back' | null
  const [verifyMinimalResult, setVerifyMinimalResult] = useState(null);
  const [toast, setToast] = useState({ msg: '', visible: false });
  const faceAutoRef = useRef(null);
  const userId = session?.sessionId || session?.id || '';
  const userName = session?.name || 'User';
  const [captureKey, setCaptureKey] = useState(0);
  // media & rtc refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
    // toast state (added)
  
  const toastTimerRef = useRef(null);

  const showToast = (message, duration = 2000) => {
    // clear previous timer
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast({ msg: message, visible: true });
    toastTimerRef.current = setTimeout(() => {
      setToast({ msg: '', visible: false });
      toastTimerRef.current = null;
    }, duration);
  };

  const faceOverlayRef = useRef(null); // added overlay canvas ref
  const canvasRef = useRef(null);
  const pcRef = useRef(null);
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const previewTimeoutRef = useRef(null);
  const lastHintRef = useRef({ msg: '', t: 0 });
  // === NEW: guidance mode + phase emitter ===
  const guidanceActiveRef = useRef(false);
    // --- Sync refs to avoid stale state in async loops ---
  const scanningSideRef = useRef(null);
  // new: track last sent image ids so re-captures re-send
  const lastSentIdsRef = useRef('');          // e.g. "faceId|frontId|backId"

  // new: in-progress and abort control for polling/upload
  const verifyInProgressRef = useRef(false);
  const verifyAbortRef = useRef({ cancelled: false });
  // Agent-side logging helper (put near top of file, after imports)
  const AGENT_LOG = (...args) => {
    try {
      console.debug(new Date().toISOString(), '[AGENT][VideoCallModal]', ...args);
    } catch (e) { /* ignore */ }
  };

  // Reset stability whenever scanning starts/stops
  useEffect(() => {
    stableRef.current = { box: null, count: 0, side: null, classId: null };
  }, [scanningSide]);

  const sendPhaseToRemote = (phase, side) => {
    socketRef.current?.emit('ocr-phase', { roomId, from: userId, phase, side });
  };
  // generic socket emitter
  const emitSocket = (event, payload) => {
    try {
      if (!socketRef.current?.connected) return;
      socketRef.current.emit(event, { roomId, from: userId, ...payload });
    } catch (err) {
      console.warn('[VideoCallModal] emitSocket error:', err);
    }
  };
  // near other helpers in VideoCallModal, e.g. after emitSocket
  function emitAgentCaptured(type) {
    // type: 'face'|'front_card'|'back_card'
    if (!socketRef.current?.connected) return;
    socketRef.current.emit('agent-captured', { roomId, type });
  }

  const handleFaceCaptured = React.useCallback((imgObj) => {
    setCapturedImages(p => ({ ...p, face: imgObj }));
  }, []);

  const handleFaceStatus = React.useCallback((msg) => {
    // avoid stomping ID-scan hints if scanning
    if (!scanningSide) setOcrStatus(msg);
  }, [scanningSide]);
  const NGROK_HEADERS = { 'ngrok-skip-browser-warning': 'true' };

  // captures
  const [capturedImages, setCapturedImages] = useState({ face: null, front_card: null, back_card: null });
  const [faceResetTrigger, setFaceResetTrigger] = useState(0);
  // ONNX session
  const onnxSessionRef = useRef(null);
  const capturedImagesRef = useRef(capturedImages);
  useEffect(() => { capturedImagesRef.current = capturedImages; }, [capturedImages]);
  useEffect(() => { scanningSideRef.current = scanningSide; }, [scanningSide]);
  const isActiveSide = (side) => scanningSideRef.current && side === scanningSideRef.current;

  // verify flow sentinel
  const verifySentRef = useRef(false);

  // --- NEW: detection stability ---
  const stableRef = useRef({ box: null, count: 0, side: null, classId: null });
  const MIN_STABLE_FRAMES = 4; // require N consecutive frames before auto-capture

  const sendHintToRemote = (message) => {
    if (!guidanceActiveRef.current) return; // NEW: only send while scanning
    const now = Date.now();
    if (!message) return;
    if (message === lastHintRef.current.msg && now - lastHintRef.current.t < 1200) return;
    if (now - lastHintRef.current.t < 400) return;

    socketRef.current?.emit('ocr-hint', { roomId, from: userId, message });
    lastHintRef.current = { msg: message, t: now };
  };

  // helper: returns true if the message looks like guidance for card alignment/capture
  const isCardHint = (text) => {
    if (!text || typeof text !== 'string') return false;
    const t = text.toLowerCase();

    // minimal keyword list — tweak to match your app's messages
    const cardKeywords = [
      'card', 'align', 'align card', 'frame', 'fit', 'rotate', 'tilt',
      'hold card', 'hold still', 'place card', 'scan card', 'move card',
      'edge', 'crop', 'position', 'center card'
    ];

    // if any card keyword appears, treat as card guidance
    for (const kw of cardKeywords) {
      if (t.includes(kw)) return true;
    }
    return false;
  };

  useEffect(() => {
    if (!ocrStatus) return;

    // existing local hint behavior (unchanged)
    sendHintToRemote(ocrStatus);

    // only emit ocr-status to remote if the status looks like a card-related hint
    if (isCardHint(ocrStatus)) {
      emitSocket('ocr-status', { message: ocrStatus, timestamp: new Date().toISOString() });
    } else {
      // otherwise ignore (face hints, etc.) — do not send to remote
    }
  }, [ocrStatus]);


  // trigger send → poll once all 3 exist
 // trigger send → poll once all 3 exist AND when their ids change (handles recapture)
useEffect(() => {
  const faceBlob = capturedImages.face?.blob;
  const frontBlob = capturedImages.front_card?.blob;
  const backBlob = capturedImages.back_card?.blob;

  const faceId = capturedImages.face?.id ?? '';
  const frontId = capturedImages.front_card?.id ?? '';
  const backId = capturedImages.back_card?.id ?? '';

  const idsKey = `${faceId}|${frontId}|${backId}`;

  // if not all present, nothing to do
  if (!faceBlob || !frontBlob || !backBlob) {
    // If any image was removed while a verification was in progress, cancel it
    if (verifyInProgressRef.current) {
      verifyAbortRef.current.cancelled = true;
      verifyInProgressRef.current = false;
      lastSentIdsRef.current = ''; // allow re-send later when images are back
    }
    return;
  }

  // If we've already sent these exact images (ids string), don't resend
  if (idsKey === lastSentIdsRef.current) {
    return;
  }

  // start fresh upload — cancel any previous poll/upload in progress
  if (verifyInProgressRef.current) {
    verifyAbortRef.current.cancelled = true;
    // small delay not required; just mark cancelled and continue
  }
  verifyAbortRef.current = { cancelled: false };
  verifyInProgressRef.current = true;

  // remember we'll have sent these ids once we start (prevents races of concurrent starts)
  lastSentIdsRef.current = idsKey;

  setOcrStatus('Uploading images for verification...');
  (async () => {
    try {
      const taskId = await sendVerifyImages(frontBlob, backBlob, faceBlob);

      if (verifyAbortRef.current.cancelled) {
        // aborted — bail out
        console.log('[verify] aborted after upload (new capture arrived)');
        verifyInProgressRef.current = false;
        return;
      }

      setOcrStatus(`Images uploaded. Waiting for result (task: ${taskId})...`);

      // poll with awareness of abort flag
      const minimal = await pollVerifyResult(taskId, userId, {
        interval: 2000,
        maxAttempts: 20,
        abortRef: verifyAbortRef
      });

      if (verifyAbortRef.current.cancelled) {
        console.log('[verify] aborted after poll (new capture arrived)');
        verifyInProgressRef.current = false;
        return;
      }

      setVerifyMinimalResult(minimal);
      setOcrStatus('Verification complete.');
    } catch (e) {
      console.error(e);
      // If aborted, don't override lastSentIdsRef (we cleared it above when aborting)
      if (verifyAbortRef.current.cancelled) {
        console.log('[verify] upload/poll aborted:', e.message);
      } else {
        // allow retry/resend on next change by clearing lastSentIdsRef so effect can re-trigger
        lastSentIdsRef.current = '';
        setOcrStatus(`Verification failed: ${e.message}`);
      }
    } finally {
      verifyInProgressRef.current = false;
    }
  })();
}, [capturedImages, userId]); // re-run whenever capturedImages object changes


  

  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };

  // ===== Lifecycle: init canvas, load user details, load ONNX =====
  useEffect(() => {
    canvasRef.current = document.createElement('canvas');

    // (async () => {
    //   try {
    //     const res = await fetch(`${API_BASE_URL}/api/verification-results/${userId}`);
    //     const data = await res.json();
    //     const filled = Object.fromEntries(Object.entries(data || {}).map(([k, v]) => [k, v ?? 'null']));
    //     setUserDetails(filled);
    //   } catch { }
    // })();

    let cancelled = false;
    (async () => {
      try {
        setOcrLoading(true);
        setOcrStatus('Loading ID detector...');
        AGENT_LOG('Loading ONNX model from', MODEL_URL);

        ort.env.wasm.simd = true;
        const sess = await ort.InferenceSession.create(MODEL_URL, {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all'
        });
        if (cancelled) {
          try { sess.release(); } catch { }
          return;
        }
        onnxSessionRef.current = sess;
        AGENT_LOG('ONNX session created', { inputNames: sess.inputNames, outputNames: sess.outputNames, simd: ort.env.wasm.simd });

        setOcrStatus('ID detector loaded');
      } catch (e) {
        console.error('Failed to load ONNX model', e);
        setOcrStatus('Failed to load ID detector');
      } finally {
        setOcrLoading(false);
      }
    })();

    return () => {
      if (onnxSessionRef.current) {
        try { onnxSessionRef.current.release(); } catch { }
        onnxSessionRef.current = null;
      }
      canvasRef.current = null;
      cleanup();
    };
  }, [userId]);

  // ===== Cleanup =====
  const cleanup = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
    Object.values(capturedImages).forEach((img) => {
      if (img?.url) URL.revokeObjectURL(img.url);
    });
    pendingCandidatesRef.current = [];
    setScanningSide(null);
    stableRef.current = { box: null, count: 0, side: null, classId: null };
  };

  // ===== Call controls =====
  const toggleMute = () => {
    const track = localStreamRef.current?.getAudioTracks?.()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsMuted(!track.enabled);
  };
  const toggleVideo = () => {
    const track = localStreamRef.current?.getVideoTracks?.()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsVideoOff(!track.enabled);
  };
  const endCall = async () => {
    cleanup();
    setConnectionState('closed');
    try {
      await fetch(`${API_BASE_URL}/api/users/${userId}/claim-status-assign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'claim-to-review', assigned_to: agent, is_claim: true })
      });
    } catch (err) {
      console.error('Failed to update status:', err);
    }
    onClose?.();
  };

  // ===== Join / initialize call =====
  const handleJoinCall = async () => {
    if (!roomId || !userId) {
      setErrorMessage('Missing room ID or user ID');
      return;
    }
    setConnectionState('getting_media');
    setErrorMessage('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;AGENT_LOG('Attached local stream to localVideoRef', { videoReadyState: localVideoRef.current?.readyState });

      await initializeCall(stream);
      AGENT_LOG('getUserMedia ok', { tracks: stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled })) });

    }
     
    catch (e) {
      console.error('Media access failed', e);
      setConnectionState('media_error');
      setErrorMessage('Camera/microphone access required. Please check permissions.');
    }
  };

  // ===== Initialize WebRTC call (Agent side) =====
  const initializeCall = async (stream) => {
    try {
      setConnectionState('connecting');

      // Create RTCPeerConnection
      pcRef.current = new RTCPeerConnection(rtcConfig);
      stream.getTracks().forEach((track) => pcRef.current.addTrack(track, stream));

      // Handle remote media
      pcRef.current.ontrack = (evt) => {
        const remoteStream = evt.streams?.[0];
        if (remoteStream && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
          setConnectionState('connected');
        }
      };

      // Handle ICE candidates (local → server)
      pcRef.current.onicecandidate = (evt) => {
        if (evt.candidate && socketRef.current?.connected) {
          socketRef.current.emit('ice-candidate', { candidate: evt.candidate, roomId, userId });
        }
      };

      // ICE connection state change
      pcRef.current.oniceconnectionstatechange = () => {
        const s = pcRef.current?.iceConnectionState;
        if (s === 'failed') pcRef.current?.restartIce();
        else if (s === 'disconnected') setConnectionState('disconnected');
      };
      console.log('[VideoCall] SIGNAL_SERVER_URL=', SIGNAL_SERVER_URL);

      // Connect signaling socket
      socketRef.current = io("https://uaeid-stg.digitaltrusttech.com:3000", {
        path: '/videokyc/socket.io',         
        transports: ['websocket','polling'],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      // ---- SOCKET EVENTS ----

      // On successful connection
      socketRef.current.on('connect', () => {
        console.log('Agent socket connected:', socketRef.current.id);
        socketRef.current.emit('join-room', { roomId, userId, role: 'agent' });
        setConnectionState('waiting_for_offer');
      });

      // When join is acknowledged
      socketRef.current.on('joined', ({ roomId }) => {
        console.log(`Joined room ${roomId}, emitting ready`);
        socketRef.current.emit('ready', { roomId, userId });
      });

      // When user is ready — create and send offer
      socketRef.current.on('ready', async ({ userId: remoteUserId }) => {
        console.log('Agent received ready from', remoteUserId);

        if (pcRef.current.signalingState !== 'stable') {
          console.warn('Skipping offer since signalingState =', pcRef.current.signalingState);
          return;
        }

        try {
          const offer = await pcRef.current.createOffer();
          await pcRef.current.setLocalDescription(offer);
          socketRef.current.emit('offer', { offer, roomId, userId });
          console.log('Agent sent offer to user:', remoteUserId);
          setConnectionState('offer_sent');
        } catch (err) {
          console.error('Offer creation failed:', err);
          setErrorMessage('Offer creation failed: ' + err.message);
          setConnectionState('failed');
        }
      });

      // When answer arrives from user
      socketRef.current.on('answer', async ({ answer, senderId }) => {
        try {
          if (pcRef.current.signalingState === 'have-local-offer') {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
            console.log('Agent set remote description with answer');
            setConnectionState('connected');
          } else {
            console.warn('Skipping answer, invalid state:', pcRef.current.signalingState);
          }
        } catch (err) {
          console.error('Failed to handle answer:', err);
          setErrorMessage('Answer handling failed: ' + err.message);
        }
      });

      // Handle remote ICE candidates
      socketRef.current.on('ice-candidate', async ({ candidate }) => {
        if (!candidate || !pcRef.current) return;
        const ice = new RTCIceCandidate(candidate);
        try {
          if (pcRef.current.remoteDescription)
            await pcRef.current.addIceCandidate(ice);
          else
            pendingCandidatesRef.current.push(ice);
        } catch (err) {
          console.warn('Error adding ICE candidate:', err);
        }
      });

      // Handle call end from user
      socketRef.current.on('call-ended', () => {
        console.log('User ended the call');
        cleanup();
        setConnectionState('closed');
      });

      // Handle disconnection or error
      socketRef.current.on('disconnect', () => {
        console.warn('Agent socket disconnected');
        setConnectionState('disconnected');
      });

      socketRef.current.on('connect_error', (err) => {
        console.error('Socket connection error:', err);
        setConnectionState('failed');
        setErrorMessage('Connection error: ' + err.message);
      });

      // Handle offers from peer (edge case)
      socketRef.current.on('offer', async ({ offer, senderId }) => {
        const pc = pcRef.current;
        if (!pc) return;

        try {
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socketRef.current.emit('answer', { answer, roomId, userId });
          console.log('Processed secondary offer → sent answer');
        } catch (err) {
          console.error('Failed handling incoming offer:', err);
        }
      });

    } catch (err) {
      console.error('initializeCall Error:', err);
      setErrorMessage('Call setup failed: ' + err.message);
      setConnectionState('failed');
    }
  };

  // ===== Auto ID scan orchestration =====
  useEffect(() => {
    if (connectionState !== 'connected') return;
    if (!onnxSessionRef.current) return;
    setScanningSide('front'); // kick off front scan
  }, [connectionState]);

  useEffect(() => {
    if (!scanningSide) return;
    if (connectionState !== 'connected') return;
    (async () => {

      await scanFrame(scanningSide, true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanningSide, connectionState]);
  // === NEW: broadcast guidance phase ===
  useEffect(() => {
    if (scanningSide) {
      guidanceActiveRef.current = true;
      sendPhaseToRemote('start', scanningSide);   // tell user to show only model hints
    } else {
      guidanceActiveRef.current = false;
      sendPhaseToRemote('stop', null);            // tell user to restore normal UI
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanningSide]);

  // helper: convert blob → base64
  async function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      if (!blob) return resolve(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function sendVerifyImages(frontBlob, backBlob, faceBlob) {
    try {
      const [frontB64, backB64, faceB64] = await Promise.all([
        blobToBase64(frontBlob),
        blobToBase64(backBlob),
        blobToBase64(faceBlob),
      ]);
      const userId = session?.sessionId || session?.id || '';
      // const res1 = await fetch(`http://164.52.217.141:5000/get-id-number/${userId}`);

      // if (!res1.ok) {
      //   console.error('Failed to fetch id_number:', res1.statusText);
      // }

      // const id_data = await res1.json();
      // console.log('ID Number:', id_data.id_number);
      const payload = { user_id: userId, image1: frontB64, image2: backB64, image3: faceB64 };

      const response = await fetch(VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const raw = await response.text();
      if (!response.ok) throw new Error(`Verify API failed: ${response.status} ${raw}`);

      const data = JSON.parse(raw);
      if (!data?.task_id) throw new Error('No task_id returned');

      return data.task_id;
    } catch (err) {
      console.error('Error sending images:', err.message);
      throw err;
    }
  }

  async function fetchVerifyResult(taskId) {
    try {
      const response = await fetch(`${RESULT_URL}/${encodeURIComponent(taskId)}`, { method: 'GET', headers: NGROK_HEADERS });
      const raw = await response.text();
      if (!response.ok) throw new Error(`Result API failed: ${response.status} ${raw}`);
      const data = JSON.parse(raw);
      const result = data?.result || {};
      return {
        face_1N_verification: { matches_found: result.face_1N_verification?.matches_found ?? null },
        face_verification: { matched: result.face_verification?.matched ?? null, score: result.face_verification?.score ?? null },
        liveness: { score: result.liveness_check?.score ?? null },
      };
    } catch (err) {
      console.error('Error fetching result:', err.message);
      throw err;
    }
  }

  async function pollVerifyResult(taskId, userId, { interval = 2000, maxAttempts = 20, abortRef = { cancelled: false } } = {}) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (abortRef.cancelled) {
      throw new Error('Polling aborted');
    }

    const result = await fetchVerifyResult(taskId);

    if (abortRef.cancelled) {
      throw new Error('Polling aborted');
    }

    const hasAll = result.face_1N_verification.matches_found !== null &&
      result.face_verification.matched !== null &&
      result.face_verification.score !== null &&
      result.liveness.score !== null;

    if (hasAll) {
      try {
        // Save the result to your API (with existing behavior)
        const saveRes = await fetch(`${API_BASE_URL}/api/verification-results`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: (userId),
            result: {
              face_1N_verification: result.face_1N_verification,
              face_verification: result.face_verification,
              liveness: result.liveness,
            }
          })
        });
        if (!saveRes.ok) {
          const raw = await saveRes.text().catch(() => '');
          console.warn('Verification save failed:', raw);
        }
      } catch (err) {
        console.warn('Error saving result:', err.message);
      }
      return result;
    }

    // wait before next poll; check abort during waiting
    await new Promise(resolve => {
      const to = setTimeout(resolve, interval);
      // if aborted while waiting, clear timeout and resolve early
      const checkAbort = () => {
        if (abortRef.cancelled) {
          clearTimeout(to);
          resolve();
        } else {
          // no-op
        }
      };
      // small interval poll for abort (keeps implementation simple)
      const intCheck = setInterval(() => {
        if (abortRef.cancelled) {
          clearInterval(intCheck);
          clearTimeout(to);
          resolve();
        }
      }, 200);
    });
  }

  throw new Error('Verification timed out');
}


  // ===== NEW: stricter heuristics to prevent non-ID captures =====
  function passesCardHeuristics(side, cropBoxOrig, meta, outCanvas, score, classId) {
    const [x1, y1, x2, y2] = cropBoxOrig;
    const cropW = x2 - x1, cropH = y2 - y1;
    const frameArea = meta.vw * meta.vh;
    const areaRatio = (cropW * cropH) / frameArea; // between 0 and 1

    // aspect ratio (H/W) for horizontal ID cards ~ 0.63–0.72; allow some tolerance
    const ar = cropH / cropW;
    const minAR = 0.58, maxAR = 0.78;

    // area sanity (avoid tiny/huge boxes)
    const minArea = 0.14, maxArea = 0.65;

    // detector confidence (tightened)
    const minDetConf = 0.50;

    // lighting & blur
    const lit = lightOk(outCanvas);
    const notBlurry = !isImageBlurry(outCanvas, 120);

    // border edges strong enough
    const edge = borderEdgeScore(outCanvas);
    const minEdge = 8; // heuristic average gradient

    // stability check across frames (same side & class, similar bbox)
    const prev = stableRef.current;
    const sameSide = prev.side === side && prev.classId === classId && prev.box && iou(prev.box, cropBoxOrig) > 0.85;
    const count = sameSide ? prev.count + 1 : 1;
    stableRef.current = { box: cropBoxOrig, count, side, classId };

    const ok = ar >= minAR && ar <= maxAR && areaRatio >= minArea && areaRatio <= maxArea && score >= minDetConf && lit && notBlurry && edge >= minEdge && count >= MIN_STABLE_FRAMES;

    return { ok, reasons: { ar, areaRatio, score, lit, notBlurry, edge, stableFrames: count } };
  }

  // ===== Core scan (with letterbox + robust checks + stability) =====
  const scanFrame = async (side, delayFirst = false) => {
    if (!isActiveSide(side)) return;
    const session = onnxSessionRef.current;
    const video = remoteVideoRef.current;
    const canvas = canvasRef.current;
    if (!session || !video || !video.srcObject || !canvas) return;

     if (video.readyState !== 4) {
      if (isActiveSide(side)) setTimeout(() => scanFrame(side, false), 600);
      return;
    }
    if (delayFirst) await new Promise((r) => setTimeout(r, 800));
    if (!isActiveSide(side)) return;
    const IMG_SIZE = 640;
    canvas.width = IMG_SIZE; canvas.height = IMG_SIZE;
    const ctx = canvas.getContext('2d');

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

    try {
      const feeds = {}; feeds[session.inputNames[0]] = inputTensor;
      const results = await session.run(feeds);
      const output = results[session.outputNames[0]];

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
          setOcrStatus('Unexpected detector output shape');
          if (isActiveSide(side)) setTimeout(() => scanFrame(side, false), 800);
          return;
        }
      } else {
        setOcrStatus('Detector output shape error');
        if (isActiveSide(side)) setTimeout(() => scanFrame(side, false), 800);
        return;
      }

      // 2) Tighter thresholds + NMS
      const boxes_xywh_norm = rows.map((r) => r.slice(0, 4));
      const classScores = rows.map((r) => r.slice(4).map(sigmoid));
      const maxScores = classScores.map((sc) => Math.max(...sc));
      const classIds = classScores.map((sc) => sc.indexOf(Math.max(...sc)));
      const confThr = 0.50; // tightened from 0.40
      const mask = maxScores.map((s) => s >= confThr);

      const boxesF_norm = boxes_xywh_norm.filter((_, i) => mask[i]);
      const scoresF = maxScores.filter((_, i) => mask[i]);
      const classIdsF = classIds.filter((_, i) => mask[i]);

      if (!boxesF_norm.length) {
        setOcrStatus(`Hold steady… detecting ${side} ID`);
        if (isActiveSide(side)) setTimeout(() => scanFrame(side, false), 120);
        return;
      }

      // Convert to 640px space (if model is normalized)
      const boxes_px_640 = xywh2xyxy(
        boxesF_norm.map(([x, y, w, h]) => [x * IMG_SIZE, y * IMG_SIZE, w * IMG_SIZE, h * IMG_SIZE])
      );

      // 3) NMS in 640-space
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
        setOcrStatus(`Show the ${side} side clearly (good light, fill frame)`);
        if (isActiveSide(side)) setTimeout(() => scanFrame(side, false), 150);
        return;
      }

      // 4) Map crop back to original frame
      const cropOrig = unletterboxBox(crop640, meta, true);
      let [x1, y1, x2, y2] = cropOrig;
      const cropW = x2 - x1, cropH = y2 - y1;

      if (cropW <= 0 || cropH <= 0) {
        setOcrStatus(`Reposition the ${side} side in frame`);
        if (isActiveSide(side)) setTimeout(() => scanFrame(side, false), 150);
        return;
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

      // Heuristic gates (AR, area, light, blur, edges, stability)
      const { ok, reasons } = passesCardHeuristics(side, cropOrig, meta, outCanvas, cropScore ?? 0, cropClass);
      if (!ok) {
        const msg = [];
        if (reasons.stableFrames < MIN_STABLE_FRAMES) msg.push('hold steady');
        if (!reasons.notBlurry) msg.push('avoid blur');
        if (!reasons.lit) msg.push('more light');
        setOcrStatus(msg.length ? msg.join(' • ') : 'Align the card horizontally');
        if (isActiveSide(side)) setTimeout(() => scanFrame(side, false), 120);
        return;
      }

      // Convert to blob and store (no local download)
      const dataURL = outCanvas.toDataURL('image/png');
      const blob = await (await fetch(dataURL)).blob();
      const url = URL.createObjectURL(blob);
      const imgObj = { id: Date.now(), url, blob, timestamp: new Date().toISOString(), type: side === 'front' ? 'front_card' : 'back_card' };
      setCapturedImages((prev) => ({ ...prev, [side === 'front' ? 'front_card' : 'back_card']: imgObj }));
      emitAgentCaptured(side === 'front' ? 'front_card' : 'back_card');

      setPreviewImage(imgObj);
      setShowImagePreview(true);
      if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = setTimeout(() => setShowImagePreview(false), 1500);

      setOcrStatus(`${side === 'front' ? 'Front' : 'Back'} ID captured!`);
      setScanningSide(null);
      stableRef.current = { box: null, count: 0, side: null, classId: null }; // reset stability for next scan

      // Chain to back after front
     if (side === 'front') {
        if (!capturedImagesRef.current.back_card) {
          setTimeout(() => {
            // only start back scan if user hasn't started another scan and back is still missing
            if (!capturedImagesRef.current.back_card && !scanningSideRef.current) {
              setScanningSide('back');
            }
          }, 600);
        }
      }
    } catch (e) {
      console.error('ONNX inference error', e);
      setOcrStatus('Processing error. Retrying…');
      if (isActiveSide(side)) setTimeout(() => scanFrame(side, false), 250);
    }
  };

  // ===== Manual capture (kept for face only) =====
  const captureImage = async () => {
    if (activeCaptureType !== 'face') {
      setOcrStatus('Card captures are automatic. Switch to Face to take a manual photo.');
      return;
    }
    const video = remoteVideoRef.current;
    const canvas = canvasRef.current;
    if (!video || !video.srcObject || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const img = { id: Date.now(), url, blob, timestamp: new Date().toISOString(), type: activeCaptureType };
        setCapturedImages((prev) => ({ ...prev, [activeCaptureType]: img }));
        setPreviewImage(img);
        setShowImagePreview(true);
        if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
        previewTimeoutRef.current = setTimeout(() => setShowImagePreview(false), 2000);
      },
      'image/jpeg', 0.9
    );
  };

  // (Optional) legacy save to your server
  // (Updated) save to your server
 const saveAllImagesToDatabase = async () => {
  setIsSavingImage(true);

  const blobToBase64 = (blob) =>
    new Promise((resolve) => {
      if (!blob) return resolve("");
      const reader = new FileReader();
      reader.onloadend = () => {
        let result = (reader.result || "").toString();
        // Remove the "data:image/...;base64," prefix if it exists
        const base64 = result.replace(/^data:.*;base64,/, "");
        resolve(base64);
      };
      reader.readAsDataURL(blob);
    });

  try {
    // Convert all blobs to plain Base64
    const [frontB64, backB64, faceB64] = await Promise.all([
      blobToBase64(capturedImages.front_card?.blob),
      blobToBase64(capturedImages.back_card?.blob),
      blobToBase64(capturedImages.face?.blob),
    ]);

    // Prepare payload as required
    const payload = {
      user_id: userId || "",
      agent_document_front_base64: frontB64 || "",
      agent_document_back_base64: backB64 || "",
      captured_image_base64: faceB64 || "",
    };

    console.log("Payload to send:", payload);

    // Send request
    const res = await fetch(
      "https://staging.digitaltrusttech.com/face-bknd/uploadimages",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) throw new Error("Failed to save images");
    setOcrStatus("Images saved to server");
  } catch (e) {
    console.error(e);
    setOcrStatus("Save failed");
  } finally {
    setIsSavingImage(false);
  }
};


  // ===== UI helpers =====
  const connectionStatusText = (
    {
      idle: 'Ready to join',
      getting_media: 'Accessing camera...',
      connecting: 'Connecting...',
      waiting_for_offer: 'Waiting for call...',
      connected: 'Connected',
      disconnected: 'Disconnected',
      failed: 'Connection failed',
      media_error: 'Camera access required',
      closed: 'Call ended'
    }[connectionState]
  );

  const getCaptureTypeLabel = (t) => t === 'face' ? 'Face' : t === 'front_card' ? 'Front ID' : t === 'back_card' ? 'Back ID' : t;

  // ===== Render =====
  if (connectionState === 'idle') {
    return (
      <div className="vc-modal-overlay">
        <div className="vc-modal-container">
          <div className="vc-modal-header">
            <div className="vc-modal-icon-container">
              <Video className="vc-modal-icon" size={40} />
            </div>
            <h2 className="vc-modal-title">Join Video Call</h2>
            <p className="vc-modal-with-text">with {userName}</p>
            <p className="vc-modal-room-id">Room ID: {roomId}</p>
          </div>
          <div className="vc-modal-button-group">
            <button onClick={handleJoinCall} className="vc-modal-join-button">
              <Video size={20} className="vc-button-icon" />
              <span>Join Call</span>
            </button>
            <button onClick={onClose} className="vc-modal-cancel-button">Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="vc-call-container">
      <style>{`
      :root { --panel-width: 320px; --capture-panel-width: 280px; --video-width: 640px; --video-height: 550px; }
      .vc-call-container { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: #000; display: flex; flex-direction: column; z-index: 1000; overflow: hidden; }
      .vc-call-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 20px; background: rgba(0,0,0,.7); color: #fff; z-index: 10; height: 60px; flex-shrink: 0; }
      .vc-call-status { display: flex; align-items: center; gap: 8px; }
      .vc-status-dot { width: 10px; height: 10px; border-radius: 50%; }
      .vc-connected { background: #4CAF50; box-shadow: 0 0 8px #4CAF50; }
      .vc-connecting { background: #FFC107; box-shadow: 0 0 8px #FFC107; animation: pulse 1.5s infinite; }
      .vc-face-overlay{position:absolute; top:0; left:0; width:100%; height:100%;pointer-events:none;}
      .vc-failed { background: #F44336; box-shadow: 0 0 8px #F44336; }
      .vc-status-text { font-size: 14px; }
      .vc-call-info { display: flex; align-items: center; gap: 15px; }
      .vc-close-button { background: none; border: none; color: #fff; cursor: pointer; padding: 5px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
      .vc-close-button:hover { background: rgba(255,255,255,.2); }
      .vc-main-content { display: flex; flex: 1; overflow: hidden; position: relative; }
      .vc-video-center { flex: 1; display: flex; justify-content: center; align-items: center; background: #000; position: relative; }
      .vc-video-container { position: relative; width: var(--video-width); height: var(--video-height); background: #000; }
      .vc-remote-video { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; }
      .vc-remote-video.vc-hidden { visibility: hidden; }
      .vc-face-overlay{ position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; }
      .vc-local-video-container { position: absolute; bottom: 10px; right: 10px; width: 200px; height: 180px; border-radius: 8px; overflow: hidden; border: 2px solid rgba(255,255,255,.5); box-shadow: 0 4px 12px rgba(0,0,0,.3); background: #000; z-index: 20; }
      .vc-local-video { width: 100%; height: 100%; object-fit: cover; }
      .vc-video-off-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.7); color: #fff; }
      .vc-video-label { position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,.7); color: #fff; font-size: 12px; padding: 3px; text-align: center; }
      .vc-captures-panel { width: var(--capture-panel-width); background: rgba(0,0,0,.85); backdrop-filter: blur(10px); padding: 20px; border-left: 1px solid rgba(255,255,255,.1); overflow-y: auto; }
      .vc-captures-header { font-size: 16px; font-weight: 600; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,.2); display: flex; align-items: center; gap: 10px; color: #fff; }
      .vc-captures-container { display: flex; flex-direction: column; gap: 20px; }
      .vc-capture-item { position: relative; width: 100%; height: 180px; border-radius: 8px; overflow: hidden; border: 2px solid rgba(255,255,255,.3); box-shadow: 0 4px 12px rgba(0,0,0,.3); transition: all .3s ease; cursor: pointer; background: rgba(0,0,0,.5); }
      .vc-capture-item.active { border-color: #4CAF50; box-shadow: 0 0 0 2px #4CAF50; }
      .vc-capture-image { width: 100%; height: 100%; object-fit: cover; }
      .vc-capture-placeholder { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: rgba(255,255,255,.7); font-size: 12px; text-align: center; padding: 5px; }
      .vc-capture-label { position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,.7); color: #fff; font-size: 12px; padding: 8px; text-align: center; }
      .vc-capture-actions { position: absolute; top: 0; right: 0; display: flex; gap: 5px; padding: 5px; opacity: 0; transition: opacity .2s; }
      .vc-capture-item:hover .vc-capture-actions { opacity: 1; }
      .vc-recapture-btn { background: rgba(0,0,0,.7); border: none; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; color: #fff; cursor: pointer; }
      .vc-ocr-status { position: absolute; bottom: 60px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,.7); color: #fff; padding: 8px 16px; border-radius: 20px; z-index: 20; font-size: 14px; white-space: nowrap; }
      .vc-ocr-controls { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); display: flex; gap: 10px; z-index: 20; }
      .vc-ocr-controls button { background: rgba(0,0,0,.7); color: #fff; border: 1px solid rgba(255,255,255,.3); border-radius: 4px; padding: 8px 16px; cursor: pointer; transition: all 0.2s; }
      .vc-ocr-controls button:hover { background: rgba(255,255,255,.1); }
      .vc-connection-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.8); z-index: 5; }
      .vc-connection-message { text-align: center; color: #fff; max-width: 300px; padding: 20px; }
      .vc-connecting-spinner { width: 40px; height: 40px; border: 4px solid rgba(255,255,255,.3); border-radius: 50%; border-top-color: #fff; animation: spin 1s ease-in-out infinite; margin: 0 auto; }
      .vc-controls-container { position: relative; padding: 15px 0; background: rgba(0,0,0,.7); display: flex; justify-content: center; z-index: 10; height: 50px; flex-shrink: 0; }
      .vc-controls-group { display: flex; gap: 20px; }
      .vc-control-button { display: flex; flex-direction: column; align-items: center; gap: 5px; background: none; border: none; color: #fff; cursor: pointer; min-width: 70px; padding: 8px; border-radius: 8px; transition: all 0.2s; }
      .vc-control-button:hover { background: rgba(255,255,255,.1); }
      .vc-control-button:disabled { opacity: .5; cursor: not-allowed; }
      .vc-control-button.vc-muted,.vc-control-button.vc-video-off { color: #F44336; }
      .vc-control-icon { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,.1); border-radius: 50%; }
      .vc-control-label { font-size: 12px; }
      .vc-end-call .vc-control-icon { background: #F44336; }
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
      @media (max-width: 1200px) { :root { --panel-width: 280px; --capture-panel-width: 240px; } }
      @media (max-width: 1024px) { :root { --panel-width: 240px; --capture-panel-width: 200px; --video-width: 540px; --video-height: 405px; } .vc-capture-item { height: 150px; } }
      @media (max-width: 900px) { :root { --panel-width: 220px; --capture-panel-width: 180px; --video-width: 480px; --video-height: 360px; } .vc-local-video-container { width: 140px; height: 105px; } }
    `}</style>

      <div className="vc-call-header">
        <div className="vc-call-status">
          <div className={`vc-status-dot ${connectionState === 'connected' ? 'vc-connected' : ['failed', 'disconnected'].includes(connectionState) ? 'vc-failed' : 'vc-connecting'}`}></div>
          <span className="vc-status-text">{connectionStatusText}</span>
        </div>
        <div className="vc-call-info">
          <span className="vc-call-with">Calling: <strong>{userName}</strong></span>
          <button onClick={endCall} className="vc-close-button" aria-label="Close call"><X size={20} /></button>
        </div>
      </div>

      <div className="vc-main-content">
        {/* Center Panel - Video Stream */}
        <div className="vc-video-center">
          <div className="vc-video-container">
            {/* Remote video */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`vc-remote-video ${connectionState === 'connected' ? '' : 'vc-hidden'}`}
            />
            <canvas ref={faceOverlayRef} className="vc-face-overlay" />

            {/* <FaceAutoCapture
              ref={faceAutoRef}
              remoteVideoRef={remoteVideoRef}
              overlayCanvasRef={faceOverlayRef}
              connectionState={connectionState}
              enabled={connectionState === 'connected' && !isVideoOff && !capturedImages.face}
              onFaceCaptured={async (img) => {
                try {
                  // 1) keep existing behaviour (store locally)
                  setCapturedImages(p => ({ ...p, face: img }));

                  // 4) update UI status
                  setOcrStatus('Face captured and sent');
                } catch (err) {
                  console.error('Failed to send captured face:', err);
                  setOcrStatus('Face captured (local) — send failed');
                }
              }}
              setStatus={setOcrStatus}
            /> */}
            <FaceAutoCapture
              ref={faceAutoRef}
              remoteVideoRef={remoteVideoRef}
              overlayCanvasRef={faceOverlayRef}
              connectionState={connectionState}
              enabled={connectionState === 'connected' && !isVideoOff && !capturedImages.face}
                onFaceCaptured={async (img) => {
                  try {
                    console.log('[modal] onFaceCaptured', img);

                    // store captured face locally
                    setCapturedImages(prev => ({ ...prev, face: img }));
                    emitAgentCaptured('face');
                    // clear any running scanning side and then start front scan
                    setScanningSide(null);                      // clear any previous scanner
                    setTimeout(() => {
                      // safety: only start front if user didn't cancel in the meantime
                      if (!capturedImagesRef.current.front_card) {
                        setScanningSide('front');               // will trigger scanFrame('front')
                      }
                    }, 600); // small delay to let UI show face preview
                    setOcrStatus('Face captured — scanning front ID…');
                  } catch (err) {
                    console.error('[modal] onFaceCaptured error', err);
                    setOcrStatus('Face captured');
                  }
                }}

              setStatus={setOcrStatus}
            />








            {connectionState !== 'connected' && (
              <div className="vc-connection-overlay">
                <div className="vc-connection-message">
                  {connectionState === 'media_error' ? (
                    <>
                      <div className="vc-error-icon"><X size={36} /></div>
                      <h3 className="vc-error-title">Permission Required</h3>
                      <p className="vc-error-message">{errorMessage || 'Camera/microphone access required'}</p>
                      <button onClick={handleJoinCall} className="vc-retry-button">Allow & Retry</button>
                    </>
                  ) : (
                    <>
                      <div className="vc-spinner-container">
                        {['failed', 'disconnected'].includes(connectionState) ? (
                          <div className="vc-error-icon"><X size={36} /></div>
                        ) : (
                          <div className="vc-connecting-spinner"></div>
                        )}
                      </div>
                      <h3 className="vc-connection-title">{['failed', 'disconnected'].includes(connectionState) ? 'Connection Lost' : connectionStatusText}</h3>
                      <p className="vc-connection-message">{errorMessage || 'Please wait while we connect your call'}</p>
                      {['failed', 'disconnected'].includes(connectionState) && (
                        <button onClick={handleJoinCall} className="vc-retry-button">Reconnect</button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* OCR status */}
            {!!ocrStatus && <div className="vc-ocr-status">{ocrStatus}</div>}

            {/* OCR controls */}
            <div className="vc-ocr-controls">
              {!scanningSide ? (
                <>
                  <button onClick={() => setScanningSide('front')} disabled={!onnxSessionRef.current || connectionState !== 'connected' || ocrLoading}>
                    {ocrLoading ? 'Loading…' : 'Scan Front ID'}
                  </button>
                  <button onClick={() => setScanningSide('back')} disabled={!onnxSessionRef.current || connectionState !== 'connected' || ocrLoading}>
                    {ocrLoading ? 'Loading…' : 'Scan Back ID'}
                  </button>
                </>
              ) : (
                <button onClick={() => { setScanningSide(null); stableRef.current = { box: null, count: 0, side: null, classId: null }; }}>Cancel Scan</button>
              )}
            </div>

            {/* Local self view */}
            <div className={`vc-local-video-container ${isVideoOff ? 'vc-video-off' : ''}`}>
              <video ref={localVideoRef} autoPlay playsInline muted className="vc-local-video" />
              {isVideoOff && (
                <div className="vc-video-off-overlay"><VideoOff size={28} /></div>
              )}
              <div className="vc-video-label">You</div>
            </div>
          </div>
        </div>

        {/* Right Panel - Captured Images */}
        <div className="vc-captures-panel">
          <div className="vc-captures-header"><Camera size={20} />Captured Images</div>
          <div className="vc-captures-container">
  {['face', 'front_card', 'back_card'].map((t) => (
    <div
      key={t}
      className={`vc-capture-item ${activeCaptureType === t ? 'active' : ''}`}
      onClick={() => setActiveCaptureType(t)}
    >
      {capturedImages[t] ? (
        <>
          <img
            src={capturedImages[t].url}
            alt={`${getCaptureTypeLabel(t)} capture`}
            className="vc-capture-image"
          />

          <div className="vc-capture-actions">
            <button
              className="vc-recapture-btn"
              title="Recapture"
              onClick={(e) => {
                e.stopPropagation();

                // revoke old blob URL if present
                try { if (capturedImages[t]?.url) URL.revokeObjectURL(capturedImages[t].url); } catch (err) { /* ignore */ }

                // Clear the captured image from state (and ref will sync via effect)
                setCapturedImages((prev) => ({ ...prev, [t]: null }));

                // Make this tile active in UI
                setActiveCaptureType(t);

                // Reset stability counters so old detections don't bleed over
                if (stableRef && stableRef.current) {
                  stableRef.current = { box: null, count: 0, side: null, classId: null };
                }

                // Clear any OCR status and set a friendly one
                if (t === 'face') {
                  setOcrStatus('Recapturing face…');

                  // Ensure we don't have card scanning running while re-capturing face
                  setScanningSide(null);

                  // Reset the FaceAutoCapture internals (it should be implemented with useImperativeHandle)
                  try {
                    faceAutoRef.current?.reset?.();
                  } catch (err) { console.warn('face reset failed', err); }

                  // Small delay to let UI update — FaceAutoCapture will auto-start because capturedImages.face is now null
                  setTimeout(() => {
                    // no-op required: the FaceAutoCapture component will detect face automatically based on props
                    // but keep scanningSide cleared to prioritize face mode
                    if (!scanningSideRef.current) {
                      setScanningSide(null);
                    }
                  }, 80);
                } else {
                  // front_card or back_card
                  setOcrStatus(`Recapturing ${t === 'front_card' ? 'front ID' : 'back ID'}…`);

                  // Start the appropriate automatic card scan after a short delay
                  const targetSide = t === 'front_card' ? 'front' : 'back';

                  // Clear face scanning if any, and start target card scanning
                  setScanningSide(null);
                  setTimeout(() => {
                    // Only start if user hasn't manually started/stopped another scan
                    if (!scanningSideRef.current) {
                      setScanningSide(targetSide);
                    }
                  }, 120);
                }
              }}
            >
              <RotateCcw size={14} />
            </button>
          </div>

          <div className="vc-capture-label">{getCaptureTypeLabel(t)}</div>
        </>
      ) : (
        <div className="vc-capture-placeholder">
          <div style={{ marginBottom: 8 }}><Camera size={24} /></div>
          {getCaptureTypeLabel(t)}
          <div style={{ fontSize: 10, marginTop: 5 }}>Not captured</div>
        </div>
      )}
    </div>
  ))}
</div>

        </div>
      </div>

      <div className="vc-controls-container">
        <div className="vc-controls-group">
          <button onClick={toggleMute} className={`vc-control-button ${isMuted ? 'vc-muted' : ''}`} aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}>
            <div className="vc-control-icon">{isMuted ? <MicOff size={24} /> : <Mic size={24} />}</div>
            <span className="vc-control-label">{isMuted ? 'Unmute' : 'Mute'}</span>
          </button>

          <button onClick={toggleVideo} className={`vc-control-button ${isVideoOff ? 'vc-video-off' : ''}`} aria-label={isVideoOff ? 'Turn on camera' : 'Turn off camera'}>
            <div className="vc-control-icon">{isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}</div>
            <span className="vc-control-label">{isVideoOff ? 'Video Off' : 'Video On'}</span>
          </button>

          {/* <button onClick={captureImage} className="vc-control-button" aria-label="Take picture" disabled={connectionState !== 'connected' || isSavingImage || !!scanningSide}>
            <div className="vc-control-icon">{isSavingImage ? <div className="vc-saving-spinner"></div> : <Camera size={24} />}</div>
            <span className="vc-control-label">{isSavingImage ? 'Saving…' : `Capture ${getCaptureTypeLabel(activeCaptureType)}`}</span>
          </button> */}

          <button onClick={saveAllImagesToDatabase} className="vc-control-button" disabled={!capturedImages.front_card || !capturedImages.back_card || isSavingImage || !!scanningSide}>
            <div className="vc-control-icon">{isSavingImage ? <div className="vc-saving-spinner"></div> : <span>💾</span>}</div>
            <span className="vc-control-label">{isSavingImage ? 'Saving…' : 'Save All'}</span>
          </button>

          <button onClick={endCall} className="vc-control-button vc-end-call" aria-label="End call">
            <div className="vc-control-icon"><PhoneOff size={24} /></div>
            <span className="vc-control-label">End Call</span>
          </button>
        </div>
      </div>
    </div>
  );
}