// import React, { useState, useEffect, useRef } from 'react';
// import { Video, VideoOff, Mic, MicOff, PhoneOff, X, Camera, RotateCcw } from 'lucide-react';
// import io from 'socket.io-client';

// const VideoCallModal = ({ roomId, session, onClose }) => {
//   const [connectionState, setConnectionState] = useState('idle');
//   const [isMuted, setIsMuted] = useState(false);
//   const [isVideoOff, setIsVideoOff] = useState(false);
//   const [callerId, setCallerId] = useState(null);
//   const [errorMessage, setErrorMessage] = useState('');
//   const [capturedImages, setCapturedImages] = useState({
//     face: null,
//     front_card: null,
//     back_card: null
//   });
//   const [activeCaptureType, setActiveCaptureType] = useState('face');
//   const [isSavingImage, setIsSavingImage] = useState(false);
//   const [showImagePreview, setShowImagePreview] = useState(false);
//   const [previewImage, setPreviewImage] = useState(null);
//   const [userDetails, setUserDetails] = useState(null);

//   const localVideoRef = useRef(null);
//   const remoteVideoRef = useRef(null);
//   const socketRef = useRef(null);
//   const pcRef = useRef(null);
//   const localStreamRef = useRef(null);
//   const pendingCandidatesRef = useRef([]);
//   const canvasRef = useRef(null);
//   const previewTimeoutRef = useRef(null);

//   const SIGNAL_SERVER_URL = "http://164.52.217.141:5000";
//   const API_BASE_URL = "http://164.52.217.141:5000";
//   const userId = session?.sessionId || session?.id || '';

//   // Initialize canvas
//   useEffect(() => {
//     canvasRef.current = document.createElement('canvas');
//     fetch(`http://164.52.217.141:5000/api/verification-results/${userId}`)
//       .then((res) => res.json())
//       .then((data) => {
//         const filledData = Object.fromEntries(
//           Object.entries(data).map(([key, value]) => [key, value ?? "null"])
//         );
//         setUserDetails(filledData);
//       })
//       .catch((err) => console.error(err));
//     return () => {
//       if (canvasRef.current) {
//         canvasRef.current = null;
//       }
//     };
//   }, [userId]);

//   const cleanup = () => {
//     if (localStreamRef.current) {
//       localStreamRef.current.getTracks().forEach(track => track.stop());
//       localStreamRef.current = null;
//     }
//     if (pcRef.current) {
//       pcRef.current.close();
//       pcRef.current = null;
//     }
//     if (socketRef.current) {
//       socketRef.current.disconnect();
//       socketRef.current = null;
//     }
//     if (previewTimeoutRef.current) {
//       clearTimeout(previewTimeoutRef.current);
//     }
//     Object.values(capturedImages).forEach(img => {
//       if (img?.url) {
//         URL.revokeObjectURL(img.url);
//       }
//     });
//     pendingCandidatesRef.current = [];
//   };

//   const endCall = () => {
//     cleanup();
//     setConnectionState('closed');
//     onClose();
//   };

//   const toggleMute = () => {
//     if (localStreamRef.current) {
//       const audioTrack = localStreamRef.current.getAudioTracks()[0];
//       if (audioTrack) {
//         audioTrack.enabled = !audioTrack.enabled;
//         setIsMuted(!audioTrack.enabled);
//       }
//     }
//   };

//   const toggleVideo = () => {
//     if (localStreamRef.current) {
//       const videoTrack = localStreamRef.current.getVideoTracks()[0];
//       if (videoTrack) {
//         videoTrack.enabled = !videoTrack.enabled;
//         setIsVideoOff(!videoTrack.enabled);
//       }
//     }
//   };

//   const rtcConfig = {
//     iceServers: [
//       { urls: 'stun:stun.l.google.com:19302' },
//       { urls: 'stun:stun1.l.google.com:19302' },
//       { urls: 'stun:stun2.l.google.com:19302' }
//     ]
//   };

//   useEffect(() => {
//     return () => cleanup();
//   }, []);

//   // const fetchUserDetails = async () => {
//   //   try {
//   //     const response = await fetch(`/api/user-card-details/${userId}`);
//   //     if (!response.ok) throw new Error('Failed to fetch user details');

//   //     const data = await response.json();
//   //     setUserDetails(data);
//   //   } catch (error) {
//   //     console.error("Error fetching user details:", error);
//   //   }
//   // };

//   // useEffect(() => {
//   //   fetchUserDetails();
//   // }, [userId]);

//   const captureImage = async () => {
//     if (!remoteVideoRef.current || !remoteVideoRef.current.srcObject) {
//       console.error('No remote video stream available');
//       return;
//     }

//     try {
//       const video = remoteVideoRef.current;
//       const canvas = canvasRef.current;

//       canvas.width = video.videoWidth;
//       canvas.height = video.videoHeight;

//       const ctx = canvas.getContext('2d');
//       ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

//       canvas.toBlob((blob) => {
//         if (!blob) return;

//         const imageUrl = URL.createObjectURL(blob);
//         const newImage = {
//           id: Date.now(),
//           url: imageUrl,
//           timestamp: new Date().toISOString(),
//           blob: blob,
//           type: activeCaptureType
//         };

//         setCapturedImages(prev => ({
//           ...prev,
//           [activeCaptureType]: newImage
//         }));

//         setPreviewImage(newImage);
//         setShowImagePreview(true);

//         if (previewTimeoutRef.current) {
//           clearTimeout(previewTimeoutRef.current);
//         }
//         previewTimeoutRef.current = setTimeout(() => {
//           setShowImagePreview(false);
//         }, 3000);

//         // Auto advance capture type
//         if (activeCaptureType === 'face' && !capturedImages.front_card) {
//           setActiveCaptureType('front_card');
//         } else if (activeCaptureType === 'front_card' && !capturedImages.back_card) {
//           setActiveCaptureType('back_card');
//         }
//       }, 'image/jpeg', 0.9);

//     } catch (error) {
//       console.error('Error capturing image:', error);
//     }
//   };

//   const recaptureImage = (type) => {
//     if (capturedImages[type]?.url) {
//       URL.revokeObjectURL(capturedImages[type].url);
//     }
//     setCapturedImages(prev => ({
//       ...prev,
//       [type]: null
//     }));
//     setActiveCaptureType(type);
//   };

//   const saveAllImagesToDatabase = async () => {
//     setIsSavingImage(true);

//     const blobToBase64 = (blob) => {
//       if (!blob) return null;
//       return new Promise((resolve) => {
//         const reader = new FileReader();
//         reader.onloadend = () => {
//           const dataUrl = reader.result;
//           resolve(dataUrl.split(',')[1] || null);
//         };
//         reader.readAsDataURL(blob);
//       });
//     };

//     try {
//       const [frontBase64, backBase64, faceBase64] = await Promise.all([
//         blobToBase64(capturedImages.front_card?.blob),
//         blobToBase64(capturedImages.back_card?.blob),
//         blobToBase64(capturedImages.face?.blob)
//       ]);

//       const response = await fetch(`${API_BASE_URL}/api/call-images`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           roomId,
//           userId,
//           images: {
//             front: frontBase64,
//             back: backBase64,
//             face: faceBase64
//           }
//         })
//       });

//       if (!response.ok) throw new Error('Failed to save images');
//       const result = await response.json();
//       console.log('Images saved successfully:', result);
//     } catch (error) {
//       console.error('Error saving images:', error);
//     } finally {
//       setIsSavingImage(false);
//     }
//   };

//   const handleJoinCall = async () => {
//     if (!roomId || !userId) {
//       setErrorMessage("Missing room ID or user ID");
//       return;
//     }

//     setConnectionState('getting_media');
//     setErrorMessage('');

//     try {
//       const stream = await navigator.mediaDevices.getUserMedia({
//         video: true,
//         audio: true
//       });
//       localStreamRef.current = stream;
//       if (localVideoRef.current) {
//         localVideoRef.current.srcObject = stream;
//       }
//       await initializeCall(stream);
//     } catch (error) {
//       console.error('Media access failed:', error);
//       setConnectionState('media_error');
//       setErrorMessage('Camera/microphone access required. Please check permissions.');
//     }
//   };

//   const initializeCall = async (stream) => {
//     try {
//       setConnectionState('connecting');

//       pcRef.current = new RTCPeerConnection(rtcConfig);

//       stream.getTracks().forEach(track => {
//         pcRef.current.addTrack(track, stream);
//       });

//       pcRef.current.ontrack = (event) => {
//         if (event.streams && event.streams[0]) {
//           const remoteStream = event.streams[0];
//           if (remoteVideoRef.current) {
//             remoteVideoRef.current.srcObject = remoteStream;
//             setConnectionState('connected');
//           }
//         }
//       };

//       pcRef.current.onicecandidate = (event) => {
//         if (event.candidate && socketRef.current) {
//           socketRef.current.emit('ice-candidate', {
//             candidate: event.candidate,
//             roomId,
//             userId
//           });
//         }
//       };

//       pcRef.current.oniceconnectionstatechange = () => {
//         if (pcRef.current.iceConnectionState === 'failed') {
//           console.warn("ICE connection failed, restarting...");
//           pcRef.current.restartIce();
//         } else if (pcRef.current.iceConnectionState === 'disconnected') {
//           setConnectionState('disconnected');
//         }
//       };

//       socketRef.current = io(SIGNAL_SERVER_URL, {
//         transports: ['websocket'],
//         reconnectionAttempts: 5,
//         reconnectionDelay: 1000
//       });

//       socketRef.current.on('connect', () => {
//         console.log('Socket connected:', socketRef.current.id);
//         socketRef.current.emit('join-room', { roomId, userId, role: 'agent' });
//         socketRef.current.emit('ready', { roomId, userId });
//         setConnectionState('waiting_for_offer');
//       });

//       socketRef.current.on('disconnect', () => {
//         setConnectionState('disconnected');
//       });

//       socketRef.current.on('connect_error', (err) => {
//         console.error('Socket connection error:', err);
//         setConnectionState('failed');
//         setErrorMessage('Connection error: ' + err.message);
//       });

//       socketRef.current.on('ice-candidate', async ({ candidate }) => {
//         if (candidate && pcRef.current) {
//           try {
//             const iceCandidate = new RTCIceCandidate(candidate);
//             if (pcRef.current.remoteDescription) {
//               await pcRef.current.addIceCandidate(iceCandidate);
//             } else {
//               pendingCandidatesRef.current.push(iceCandidate);
//             }
//           } catch (err) {
//             console.error('Error adding ICE candidate:', err);
//           }
//         }
//       });

//       socketRef.current.on('offer', async ({ offer, senderId }) => {
//         console.log("Received offer from:", senderId);
//         if (!callerId) setCallerId(senderId);

//         try {
//           const pc = pcRef.current;
//           if (!pc) return;

//           if (pc.signalingState !== 'stable') {
//             console.warn("Cannot set offer. Current signaling state:", pc.signalingState);
//             return;
//           }

//           await pc.setRemoteDescription(new RTCSessionDescription(offer));

//           // Add any pending ICE candidates
//           while (pendingCandidatesRef.current.length > 0) {
//             const cand = pendingCandidatesRef.current.shift();
//             try {
//               await pc.addIceCandidate(cand);
//             } catch (err) {
//               console.warn("Error adding buffered ICE candidate", err);
//             }
//           }

//           if (pc.signalingState === 'have-remote-offer') {
//             const answer = await pc.createAnswer();
//             await pc.setLocalDescription(answer);

//             socketRef.current.emit('answer', { answer, roomId, userId });
//             console.log("Sent answer");
//             setConnectionState('connected');
//           } else {
//             console.warn("Skipping createAnswer — signaling state:", pc.signalingState);
//           }
//         } catch (err) {
//           console.error('Failed to process offer:', err);
//           setConnectionState('failed');
//           setErrorMessage('Failed to process offer: ' + err.message);
//         }
//       });

//     } catch (err) {
//       console.error('Call setup failed:', err);
//       setConnectionState('failed');
//       setErrorMessage('Call setup failed: ' + err.message);
//     }
//   };

//   const connectionStatusText = {
//     idle: "Ready to join",
//     getting_media: "Accessing camera...",
//     connecting: "Connecting...",
//     waiting_for_offer: "Waiting for call...",
//     connected: "Connected",
//     disconnected: "Disconnected",
//     failed: "Connection failed",
//     media_error: "Camera access required",
//     closed: "Call ended"
//   }[connectionState];

//   const userName = session?.name || 'User';

//   const getCaptureTypeLabel = (type) => {
//     switch (type) {
//       case 'face': return 'Face';
//       case 'front_card': return 'Front ID';
//       case 'back_card': return 'Back ID';
//       default: return type;
//     }
//   };

//   if (connectionState === 'idle') {
//     return (
//       <div className="vc-modal-overlay">
//         <div className="vc-modal-container">
//           <div className="vc-modal-header">
//             <div className="vc-modal-icon-container">
//               <Video className="vc-modal-icon" size={40} />
//             </div>
//             <h2 className="vc-modal-title">Join Video Call</h2>
//             <p className="vc-modal-with-text">with {userName}</p>
//             <p className="vc-modal-room-id">Room ID: {roomId}</p>
//           </div>

//           <div className="vc-modal-button-group">
//             <button onClick={handleJoinCall} className="vc-modal-join-button">
//               <Video size={20} className="vc-button-icon" />
//               <span>Join Call</span>
//             </button>
//             <button onClick={onClose} className="vc-modal-cancel-button">
//               Cancel
//             </button>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="vc-call-container">
//       <style>{`
//         .vc-call-container {
//           position: fixed;
//           top: 0;
//           left: 0;
//           width: 100%;
//           height: 100%;
//           background-color: #000;
//           display: flex;
//           flex-direction: column;
//           z-index: 1000;
//         }
        
//         .vc-call-header {
//           display: flex;
//           justify-content: space-between;
//           align-items: center;
//           padding: 10px 20px;
//           background-color: rgba(0, 0, 0, 0.7);
//           color: white;
//           z-index: 10;
//         }
        
//         .vc-call-status {
//           display: flex;
//           align-items: center;
//           gap: 8px;
//         }
        
//         .vc-status-dot {
//           width: 10px;
//           height: 10px;
//           border-radius: 50%;
//         }
        
//         // .vc-status-dot.vc-connected {
//         //   background-color: #4CAF50;
//         // }
        
//         // .vc-status-dot.vc-connecting {
//         //   background-color: #FFC107;
//         //   animation: pulse 1.5s infinite;
//         // }
        
//         // .vc-status-dot.vc-failed {
//         //   background-color: #F44336;
//         // }
        
//         .vc-status-text {
//           font-size: 14px;
//         }
        
//         .vc-call-info {
//           display: flex;
//           align-items: center;
//           gap: 15px;
//         }
        
//         .vc-call-with {
//           font-size: 14px;
//         }
        
//         .vc-close-button {
//           background: none;
//           border: none;
//           color: white;
//           cursor: pointer;
//           padding: 5px;
//           border-radius: 50%;
//           display: flex;
//           align-items: center;
//           justify-content: center;
//         }
        
//         .vc-close-button:hover {
//           background-color: rgba(255, 255, 255, 0.2);
//         }
        
//         .vc-video-container {
//           position: relative;
//           flex: 1;
//           overflow: hidden;
//         }
        
//         .vc-remote-video {
//           position: absolute;
//           top: 0;
//           left: 0;
//           width: 100%;
//           height: 100%;
//           object-fit: cover;
//         }
        
//         .vc-remote-video.vc-hidden {
//           visibility: hidden;
//         }
        
//         .vc-local-video-container {
//           position: absolute;
//           bottom: 5px;
//           right: 10px;
//           width: 160px;
//           height: 120px;
//           border-radius: 8px;
//           overflow: hidden;
//           border: 2px solid rgba(255, 255, 255, 0.5);
//           box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
//           background-color: #000;
//         }
        
//         .vc-local-video {
//           width: 100%;
//           height: 100%;
//           object-fit: cover;
//         }
        
//         .vc-video-off-overlay {
//           position: absolute;
//           top: 0;
//           left: 0;
//           width: 100%;
//           height: 100%;
//           display: flex;
//           align-items: center;
//           justify-content: center;
//           background-color: rgba(0, 0, 0, 0.7);
//           color: white;
//         }
        
//         .vc-video-label {
//           position: absolute;
//           bottom: 0;
//           left: 0;
//           right: 0;
//           background: rgba(0, 0, 0, 0.7);
//           color: white;
//           font-size: 12px;
//           padding: 3px;
//           text-align: center;
//         }
        
//         .vc-controls-container {
//           position: relative;
//           padding: 15px 0;
//           background-color: rgba(0, 0, 0, 0.7);
//           display: flex;
//           justify-content: center;
//           z-index: 10;
//         }
        
//         .vc-controls-group {
//           display: flex;
//           gap: 20px;
//         }
        
//         .vc-control-button {
//           display: flex;
//           flex-direction: column;
//           align-items: center;
//           gap: 5px;
//           background: none;
//           border: none;
//           color: white;
//           cursor: pointer;
//           min-width: 60px;
//         }
        
//         .vc-control-button:disabled {
//           opacity: 0.5;
//           cursor: not-allowed;
//         }
        
//         .vc-control-button.vc-muted {
//           color: #F44336;
//         }
        
//         .vc-control-button.vc-video-off {
//           color: #F44336;
//         }
        
//         .vc-control-button.vc-end-call {
//           background-color: #F44336;
//           border-radius: 50%;
//           width: 50px;
//           height: 50px;
//           justify-content: center;
//         }
        
//         .vc-control-icon {
//           display: flex;
//           align-items: center;
//           justify-content: center;
//         }
        
//         .vc-control-label {
//           font-size: 12px;
//         }
        
//         .vc-connection-overlay {
//           position: absolute;
//           top: 0;
//           left: 0;
//           width: 100%;
//           height: 100%;
//           display: flex;
//           align-items: center;
//           justify-content: center;
//           background-color: rgba(0, 0, 0, 0.8);
//           z-index: 5;
//         }
        
//         .vc-connection-message {
//           text-align: center;
//           color: white;
//           max-width: 300px;
//           padding: 20px;
//         }
        
//         .vc-error-icon {
//           margin-bottom: 15px;
//         }
        
//         .vc-error-title {
//           margin-bottom: 10px;
//           font-size: 18px;
//         }
        
//         .vc-error-message {
//           margin-bottom: 20px;
//           font-size: 14px;
//         }
        
//         .vc-retry-button {
//           background-color: #2196F3;
//           color: white;
//           border: none;
//           padding: 8px 16px;
//           border-radius: 4px;
//           cursor: pointer;
//           font-size: 14px;
//         }
        
//         .vc-retry-button:hover {
//           background-color: #0b7dda;
//         }
        
//         .vc-spinner-container {
//           margin-bottom: 15px;
//         }
        
//         .vc-connecting-spinner {
//           width: 40px;
//           height: 40px;
//           border: 4px solid rgba(255, 255, 255, 0.3);
//           border-radius: 50%;
//           border-top-color: white;
//           animation: spin 1s ease-in-out infinite;
//           margin: 0 auto;
//         }
        
//         .vc-connection-title {
//           margin-bottom: 10px;
//           font-size: 18px;
//         }
        
//         .vc-saving-spinner {
//           width: 20px;
//           height: 20px;
//           border: 2px solid rgba(255,255,255,0.3);
//           border-radius: 50%;
//           border-top-color: white;
//           animation: spin 1s ease-in-out infinite;
//         }

//         @keyframes spin {
//           to { transform: rotate(360deg); }
//         }

//         .vc-captures-container {
//           position: absolute;
//           right: 20px;
//           top: 50%;
//           transform: translateY(-50%);
//           z-index: 10;
//           display: flex;
//           flex-direction: column;
//           gap: 10px;
//         }

//         .vc-capture-item {
            
//           width: 120px;
//           height: 90px;
//           border-radius: 8px;
//           overflow: hidden;
//           border: 2px solid rgba(255, 255, 255, 0.5);
//           box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
//           transition: all 0.3s ease;
//           cursor: pointer;
//         }

//         .vc-capture-item.active {
//           border-color: #4CAF50;
//           box-shadow: 0 0 0 2px #4CAF50;
//         }

//         .vc-capture-image {
//           width: 100%;
//           height: 100%;
//           object-fit: cover;
//         }

//         .vc-capture-placeholder {
//           width: 100%;
//           height: 100%;
//           background: rgba(0, 0, 0, 0.5);
//           display: flex;
//           flex-direction: column;
//           align-items: center;
//           justify-content: center;
//           color: rgba(255, 255, 255, 0.7);
//           font-size: 12px;
//           text-align: center;
//           padding: 5px;
//         }

//         .vc-capture-label {
//           position: absolute;
//           bottom: 0;
//           left: 0;
//           right: 0;
//           background: rgba(0, 0, 0, 0.7);
//           color: white;
//           font-size: 11px;
//           padding: 3px;
//           text-align: center;
//         }

//         .vc-capture-actions {
//           position: absolute;
//           top: 0;
//           right: 0;
//           display: flex;
//           gap: 5px;
//           padding: 5px;
//           opacity: 0;
//           transition: opacity 0.2s;
//         }

//         .vc-capture-item:hover .vc-capture-actions {
//           opacity: 1;
//         }

//         .vc-recapture-btn {
//           background: rgba(0, 0, 0, 0.7);
//           border: none;
//           border-radius: 50%;
//           width: 24px;
//           height: 24px;
//           display: flex;
//           align-items: center;
//           justify-content: center;
//           color: white;
//           cursor: pointer;
//         }

//         .vc-recapture-btn:hover {
//           background: rgba(0, 0, 0, 0.9);
//         }

//         .vc-image-preview {
//           position: absolute;
//           top: 50%;
//           left: 50%;
//           transform: translate(-50%, -50%);
//           max-width: 70vw;
//           max-height: 70vh;
//           border: 4px solid white;
//           border-radius: 12px;
//           box-shadow: 0 0 30px rgba(0, 0, 0, 0.5);
//           z-index: 20;
//           animation: fadeInOut 3s forwards;
//           object-fit: contain;
//         }

//         @keyframes fadeInOut {
//           0% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
//           10% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
//           90% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
//           100% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
//         }

//         .vc-capture-progress {
//           position: absolute;
//           bottom: 20px;
//           left: 50%;
//           transform: translateX(-50%);
//           display: flex;
//           gap: 10px;
//           z-index: 10;
//         }

//         .vc-progress-step {
//           width: 12px;
//           height: 12px;
//           border-radius: 50%;
//           background: rgba(255, 255, 255, 0.3);
//           border: 1px solid rgba(255, 255, 255, 0.5);
//         }

//         .vc-progress-step.active {
//           background: #4CAF50;
//           border-color: white;
//         }

//         .vc-progress-step.completed {
//           background: rgba(76, 175, 80, 0.5);
//         }

//         /* User Details Panel Styles */
//         .vc-user-details-panel {
//           position: absolute;
//           left: 20px;
//           top: 80px;
//           width: 280px;
//           background: rgba(0, 0, 0, 0.7);
//           backdrop-filter: blur(10px);
//           border-radius: 16px;
//           padding: 20px;
//           color: white;
//           z-index: 10;
//           border: 1px solid rgba(255, 255, 255, 0.1);
//           box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
//           max-height: calc(100% - 200px);
//           overflow-y: auto;
//         }
        
//         .vc-user-details-title {
//           font-size: 18px;
//           font-weight: 600;
//           margin-bottom: 15px;
//           padding-bottom: 10px;
//           border-bottom: 1px solid rgba(255, 255, 255, 0.2);
//           display: flex;
//           align-items: center;
//         }
        
//         .vc-detail-row {
//           display: flex;
//           margin-bottom: 12px;
//           font-size: 14px;
//         }
        
//         .vc-detail-label {
//           font-weight: 600;
//           min-width: 120px;
//           opacity: 0.8;
//         }
        
//         .vc-detail-value {
//           flex: 1;
//           word-break: break-word;
//         }
        
//         .vc-flag-indicator {
//           width: 24px;
//           height: 16px;
//           background: linear-gradient(to bottom, #FF9933, white, #138808);
//           margin-right: 10px;
//           border-radius: 2px;
//           position: relative;
//           overflow: hidden;
//         }
        
//         .vc-flag-indicator::after {
//           content: "";
//           position: absolute;
//           top: 0;
//           left: 0;
//           width: 8px;
//           height: 8px;
//           background: #000080;
//           border-radius: 50%;
//           transform: translate(50%, 50%);
//         }
        
//         /* Adjust video container to accommodate user details */
//         .vc-video-container {
//           position: relative;
//           height: 100%;
//           padding-left: 320px;
//         }
        
//         @media (max-width: 1200px) {
//           .vc-user-details-panel {
//             width: 240px;
//             padding: 15px;
//           }
          
//           .vc-video-container {
//             padding-left: 260px;
//           }
//         }
        
//         @media (max-width: 900px) {
//           .vc-user-details-panel {
//             position: relative;
//             width: 100%;
//             top: 0;
//             left: 0;
//             margin-bottom: 20px;
//             max-height: 200px;
//           }
          
//           .vc-video-container {
//             padding-left: 0;
//           }

//           .vc-captures-container {
//             flex-direction: row;
//             top: auto;
//             bottom: 100px;
//             left: 50%;
//             transform: translateX(-50%);
//             right: auto;
//           }

//           .vc-capture-item {
//             width: 80px;
//             height: 60px;
//           }
//         }
//       `}</style>

//       <div className="vc-call-header">
//         <div className="vc-call-status">
//           <div className={`vc-status-dot ${connectionState === 'connected' ? 'vc-connected' :
//             ['failed', 'disconnected'].includes(connectionState) ? 'vc-failed' : 'vc-connecting'
//             }`}></div>
//           <span className="vc-status-text">{connectionStatusText}</span>
//         </div>

//         <div className="vc-call-info">
//           <span className="vc-call-with">Calling: <strong>{userName}</strong></span>
//           <button
//             onClick={endCall}
//             className="vc-close-button"
//             aria-label="Close call"
//           >
//             <X size={20} />
//           </button>
//         </div>
//       </div>

//       <div className="vc-video-container">
//         {/* User Details Panel */}
//         <div className="vc-user-details-panel">
//           <div className="vc-user-details-title">
//             <div className="vc-flag-indicator"></div>
//             User Identity
//           </div>

//           <div className="vc-detail-row">
//             <div className="vc-detail-label">Nationality</div>
//             <div className="vc-detail-value">{userDetails?.Nationality ?? "null"}</div>
//           </div>

//           <div className="vc-detail-row">
//             <div className="vc-detail-label">Full Name</div>
//             <div className="vc-detail-value">{userDetails?.["Full Name"] ?? "null"}</div>
//           </div>

//           <div className="vc-detail-row">
//             <div className="vc-detail-label">ID Number</div>
//             <div className="vc-detail-value">{userDetails?.["Identity Card Number"] ?? "null"}</div>
//           </div>

//           <div className="vc-detail-row">
//             <div className="vc-detail-label">Date of Birth</div>
//             <div className="vc-detail-value">{userDetails?.["Date of Birth"] ?? "null"}</div>
//           </div>

//           <div className="vc-detail-row">
//             <div className="vc-detail-label">Date of Issue</div>
//             <div className="vc-detail-value">{userDetails?.["Date of Issue"] ?? "null"}</div>
//           </div>

//           <div className="vc-detail-row">
//             <div className="vc-detail-label">Date of Expiry</div>
//             <div className="vc-detail-value">{userDetails?.["Date of Expiry"] ?? "null"}</div>
//           </div>

//           <div className="vc-detail-row">
//             <div className="vc-detail-label">Issuing State</div>
//             <div className="vc-detail-value">
//               {userDetails?.["Issuing State Name"] ??
//                 (userDetails?.["Issuing State Code"] ? `Code: ${userDetails["Issuing State Code"]}` : "null")}
//             </div>
//           </div>

//           <div className="vc-detail-row">
//             <div className="vc-detail-label">Name (Arabic)</div>
//             <div
//               className="vc-detail-value"
//               style={{ direction: "rtl", fontFamily: "sans-serif" }}
//             >
//               {userDetails?.["Full Name-Arabic (U.A.E.)"] ?? "null"}
//             </div>
//           </div>
//         </div>


//         <video
//           ref={remoteVideoRef}
//           autoPlay
//           playsInline
//           className={`vc-remote-video ${connectionState === 'connected' ? '' : 'vc-hidden'}`}
//         />

//         {connectionState !== 'connected' && (
//           <div className="vc-connection-overlay">
//             <div className="vc-connection-message">
//               {connectionState === 'media_error' ? (
//                 <>
//                   <div className="vc-error-icon">
//                     <X size={36} />
//                   </div>
//                   <h3 className="vc-error-title">Permission Required</h3>
//                   <p className="vc-error-message">{errorMessage || 'Camera/microphone access required'}</p>
//                   <button onClick={handleJoinCall} className="vc-retry-button">
//                     Allow & Retry
//                   </button>
//                 </>
//               ) : (
//                 <>
//                   <div className="vc-spinner-container">
//                     {['failed', 'disconnected'].includes(connectionState) ? (
//                       <div className="vc-error-icon">
//                         <X size={36} />
//                       </div>
//                     ) : (
//                       <div className="vc-connecting-spinner"></div>
//                     )}
//                   </div>
//                   <h3 className="vc-connection-title">
//                     {['failed', 'disconnected'].includes(connectionState)
//                       ? 'Connection Lost'
//                       : connectionStatusText}
//                   </h3>
//                   <p className="vc-connection-message">
//                     {errorMessage || 'Please wait while we connect your call'}
//                   </p>
//                   {['failed', 'disconnected'].includes(connectionState) && (
//                     <button onClick={handleJoinCall} className="vc-retry-button">
//                       Reconnect
//                     </button>
//                   )}
//                 </>
//               )}
//             </div>
//           </div>
//         )}

//         <div className="vc-captures-container">
//           {['face', 'front_card', 'back_card'].map((type) => (
//             <div
//               key={type}
//               className={`vc-capture-item ${activeCaptureType === type ? 'active' : ''}`}
//               onClick={() => setActiveCaptureType(type)}
//             >
//               {capturedImages[type] ? (
//                 <>
//                   <img
//                     src={capturedImages[type].url}
//                     alt={`${getCaptureTypeLabel(type)} capture`}
//                     className="vc-capture-image"
//                   />
//                   <div className="vc-capture-actions">
//                     <button
//                       className="vc-recapture-btn"
//                       onClick={(e) => {
//                         e.stopPropagation();
//                         recaptureImage(type);
//                       }}
//                       title="Recapture"
//                     >
//                       <RotateCcw size={14} />
//                     </button>
//                   </div>
//                   <div className="vc-capture-label">
//                     {getCaptureTypeLabel(type)}
//                   </div>
//                 </>
//               ) : (
//                 <div className="vc-capture-placeholder">
//                   {getCaptureTypeLabel(type)}
//                   <div style={{ fontSize: 10 }}>Not captured</div>
//                 </div>
//               )}
//             </div>
//           ))}
//         </div>

//         {showImagePreview && previewImage && (
//           <img
//             src={previewImage.url}
//             alt="Preview"
//             className="vc-image-preview"
//           />
//         )}

        

//         <div className={`vc-local-video-container ${isVideoOff ? 'vc-video-off' : ''}`}>
//           <video
//             ref={localVideoRef}
//             autoPlay
//             playsInline
//             muted
//             className="vc-local-video"
//           />
//           {isVideoOff && (
//             <div className="vc-video-off-overlay">
//               <VideoOff size={28} />
//             </div>
//           )}
//           <div className="vc-video-label">You</div>
//         </div>
//       </div>

//       <div className="vc-controls-container">
//         <div className="vc-controls-group">
//           <button
//             onClick={toggleMute}
//             className={`vc-control-button ${isMuted ? 'vc-muted' : ''}`}
//             aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
//           >
//             <div className="vc-control-icon">
//               {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
//             </div>
//             <span className="vc-control-label">{isMuted ? "Unmute" : "Mute"}</span>
//           </button>

//           <button
//             onClick={toggleVideo}
//             className={`vc-control-button ${isVideoOff ? 'vc-video-off' : ''}`}
//             aria-label={isVideoOff ? "Turn on camera" : "Turn off camera"}
//           >
//             <div className="vc-control-icon">
//               {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
//             </div>
//             <span className="vc-control-label">
//               {isVideoOff ? "Video Off" : "Video On"}
//             </span>
//           </button>

//           <button
//             onClick={captureImage}
//             className="vc-control-button"
//             aria-label="Take picture"
//             disabled={connectionState !== 'connected' || isSavingImage}
//           >
//             <div className="vc-control-icon">
//               {isSavingImage ? (
//                 <div className="vc-saving-spinner"></div>
//               ) : (
//                 <Camera size={24} />
//               )}
//             </div>
//             <span className="vc-control-label">
//               {isSavingImage ? "Saving..." : `Capture ${getCaptureTypeLabel(activeCaptureType)}`}
//             </span>
//           </button>

//           <button
//             onClick={saveAllImagesToDatabase}
//             className="vc-control-button"
//             disabled={!capturedImages.face || !capturedImages.front_card || !capturedImages.back_card || isSavingImage}
//           >
//             <div className="vc-control-icon">
//               {isSavingImage ? (
//                 <div className="vc-saving-spinner"></div>
//               ) : (
//                 <span>💾</span>
//               )}
//             </div>
//             <span className="vc-control-label">
//               {isSavingImage ? "Saving..." : "Save All"}
//             </span>
//           </button>

//           <button
//             onClick={endCall}
//             className="vc-control-button vc-end-call"
//             aria-label="End call"
//           >
//             <div className="vc-control-icon">
//               <PhoneOff size={24} />
//             </div>
//             <span className="vc-control-label">End Call</span>
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default VideoCallModal;

// //hash routing
// -------------------------------------------
import React, { useEffect, useRef, useState } from 'react';
import { Check,Video, VideoOff, Mic, MicOff, PhoneOff, X, Camera, RotateCcw } from 'lucide-react';
import io from 'socket.io-client';
import * as ort from 'onnxruntime-web';

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
const MODEL_URL = '/models/id.onnx'; // ensure file exists at public/models/id.onnx
const SIGNAL_SERVER_URL = 'http://164.52.217.141:5000';
const API_BASE_URL = 'http://164.52.217.141:5000';

// Replace with your live ngrok host
const VERIFY_URL = 'https://6783182a3341.ngrok-free.app/verify_images';
const RESULT_URL = 'https://6783182a3341.ngrok-free.app/result';

export default function VideoCallModal({ roomId, session, onClose }) {
  // call state
  console.log(session);
  const [connectionState, setConnectionState] = useState('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeCaptureType, setActiveCaptureType] = useState('face');
  const [isSavingImage, setIsSavingImage] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [ocrStatus, setOcrStatus] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [scanningSide, setScanningSide] = useState(null); // 'front' | 'back' | null
  const [verifyMinimalResult, setVerifyMinimalResult] = useState(null);

  // media & rtc refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const canvasRef = useRef(null);
  const pcRef = useRef(null);
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const previewTimeoutRef = useRef(null);

  const NGROK_HEADERS = { 'ngrok-skip-browser-warning': 'true' };

  // captures
  const [capturedImages, setCapturedImages] = useState({ face: null, front_card: null, back_card: null });

  // ONNX session
  const onnxSessionRef = useRef(null);

  // verify flow sentinel
  const verifySentRef = useRef(false);

  // trigger send → poll once all 3 exist
  useEffect(() => {
    const faceBlob = capturedImages.face?.blob;
    const frontBlob = capturedImages.front_card?.blob;
    const backBlob = capturedImages.back_card?.blob;

    if (faceBlob && frontBlob && backBlob && !verifySentRef.current) {
      verifySentRef.current = true; // prevent duplicate sends
      setOcrStatus('Uploading images for verification...');

      (async () => {
        try {
          const taskId = await sendVerifyImages(frontBlob, backBlob, faceBlob);
          setOcrStatus(`Images uploaded. Waiting for result (task: ${taskId})...`);
          const minimal = await pollVerifyResult(taskId);
          setVerifyMinimalResult(minimal);
          setOcrStatus('Verification complete.');
        } catch (e) {
          console.error(e);
          setOcrStatus(`Verification failed: ${e.message}`);
          verifySentRef.current = false; // allow retry
        }
      })();
    }
  }, [capturedImages]);

  const userId = session?.sessionId || session?.id || '';
  const userName = session?.name || 'User';

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

    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/verification-results/${userId}`);
        const data = await res.json();
        const filled = Object.fromEntries(Object.entries(data || {}).map(([k, v]) => [k, v ?? 'null']));
        setUserDetails(filled);
      } catch { }
    })();

    let cancelled = false;
    (async () => {
      try {
        setOcrLoading(true);
        setOcrStatus('Loading OCR model...');
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
        setOcrStatus('OCR model loaded');
      } catch (e) {
        console.error('Failed to load ONNX model', e);
        setOcrStatus('Failed to load OCR model');
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
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
    Object.values(capturedImages).forEach((img) => {
      if (img?.url) URL.revokeObjectURL(img.url);
    });
    pendingCandidatesRef.current = [];
    setScanningSide(null);
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
      await fetch(`${API_BASE_URL}/api/users/${userId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'claim-to-review', assigned_to:'' })
    });
  } catch (err) {
    console.error("Failed to update status:", err);
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
      // If you want to prefer 640x480 local camera, add width/height constraints here
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      await initializeCall(stream);
    } catch (e) {
      console.error('Media access failed', e);
      setConnectionState('media_error');
      setErrorMessage('Camera/microphone access required. Please check permissions.');
    }
  };

  const initializeCall = async (stream) => {
    try {
      setConnectionState('connecting');
      pcRef.current = new RTCPeerConnection(rtcConfig);
      stream.getTracks().forEach((t) => pcRef.current.addTrack(t, stream));

      pcRef.current.ontrack = (evt) => {
        const remoteStream = evt.streams?.[0];
        if (remoteStream && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
          setConnectionState('connected');
        }
      };

      pcRef.current.onicecandidate = (evt) => {
        if (evt.candidate && socketRef.current) {
          socketRef.current.emit('ice-candidate', { candidate: evt.candidate, roomId, userId });
        }
      };

      pcRef.current.oniceconnectionstatechange = () => {
        const s = pcRef.current?.iceConnectionState;
        if (s === 'failed') pcRef.current?.restartIce();
        else if (s === 'disconnected') setConnectionState('disconnected');
      };

      socketRef.current = io(SIGNAL_SERVER_URL, {
        transports: ['websocket'],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });
      socketRef.current.on('connect', () => {
        socketRef.current.emit('join-room', { roomId, userId, role: 'agent' });
        socketRef.current.emit('ready', { roomId, userId });
        setConnectionState('waiting_for_offer');
      });
      socketRef.current.on('disconnect', () => setConnectionState('disconnected'));
      socketRef.current.on('connect_error', (err) => {
        setConnectionState('failed');
        setErrorMessage('Connection error: ' + err.message);
      });

      socketRef.current.on('ice-candidate', async ({ candidate }) => {
        if (!candidate || !pcRef.current) return;
        const ice = new RTCIceCandidate(candidate);
        try {
          if (pcRef.current.remoteDescription) await pcRef.current.addIceCandidate(ice);
          else pendingCandidatesRef.current.push(ice);
        } catch (e) {
          console.warn('addIceCandidate failed', e);
        }
      });

      socketRef.current.on('offer', async ({ offer }) => {
        const pc = pcRef.current;
        if (!pc) return;
        if (pc.signalingState !== 'stable') return;
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        while (pendingCandidatesRef.current.length) {
          const c = pendingCandidatesRef.current.shift();
          try {
            await pc.addIceCandidate(c);
          } catch { }
        }
        if (pc.signalingState === 'have-remote-offer') {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socketRef.current?.emit('answer', { answer, roomId, userId });
          setConnectionState('connected');
        }
      });
    } catch (e) {
      console.error('Call setup failed', e);
      setConnectionState('failed');
      setErrorMessage('Call setup failed: ' + e.message);
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

  // helper: convert blob → base64 (without the data URL prefix if you prefer)
  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      if (!blob) return resolve(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        // reader.result is like "data:image/png;base64,AAAA..."
        const base64 = reader.result.split(',')[1]; // remove "data:*/*;base64,"
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // --- send base64 strings in JSON ---
  async function sendVerifyImages(frontBlob, backBlob, faceBlob) {
    const [frontB64, backB64, faceB64] = await Promise.all([
      blobToBase64(frontBlob),
      blobToBase64(backBlob),
      blobToBase64(faceBlob),
    ]);

    const payload = {
      image1: frontB64,
      image2: backB64,
      image3: faceB64,
    };

    console.log('[verify] POST ->', VERIFY_URL);
    console.log('[verify] payload preview:', {
      front: frontB64?.slice(0, 30) + '...',
      back: backB64?.slice(0, 30) + '...',
      face: faceB64?.slice(0, 30) + '...',
    });

    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const raw = await res.text();
    if (!res.ok) {
      throw new Error(`Verify API failed: ${res.status} ${res.statusText} @ ${res.url}\n${raw}`);
    }

    let data = {};
    try { data = JSON.parse(raw); } catch { }
    if (!data?.task_id) throw new Error('No task_id returned from verify API');
    return data.task_id;
  }

  async function fetchVerifyResult(taskId) {
    const url = `${RESULT_URL}/${encodeURIComponent(taskId)}`;
    console.log('[result] GET ->', url);

    const res = await fetch(url, { method: 'GET', headers: NGROK_HEADERS, });
    const raw = await res.text();

    if (!res.ok) {
      throw new Error(`Result API failed: ${res.status} ${res.statusText} @ ${res.url}\n${raw}`);
    }

    let data = {};
    try {
      data = JSON.parse(raw);
    } catch (err) {
      throw new Error(`Invalid JSON in result API response @ ${res.url}\n${raw}`);
    }

    const result = data.result ?? {};
    console.log(result);
    return {
      face_1N_verification: {
        matches_found: result.face_1N_verification?.matches_found ?? null
      },
      face_verification: {
        matched: result.face_verification?.matched ?? null,
        score: result.face_verification?.score ?? null
      },
      liveness_score:{
        score:result.liveness_check.score ?? null
      }
    };
  }

  async function pollVerifyResult(taskId, { interval = 2000, maxAttempts = 20 } = {}) {
    for (let i = 0; i < maxAttempts; i++) {
      const minimal = await fetchVerifyResult(taskId);

      // matches_found can be 0 (valid), so only check for null
      const has1N = minimal.face_1N_verification.matches_found !== null;
      const has1to1 = minimal.face_verification.matched !== null &&
        minimal.face_verification.score !== null;
      const liveness = minimal.liveness_score.score!== null;
      if (has1N && has1to1 && liveness) {
        // ✅ Only save once the result is fully available
        try {
          const resp = await fetch(`${API_BASE_URL}/api/verification-results`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: Number(userId), // must be integer for your schema
              result: {
                face_1N_verification: {
                  matches_found: minimal.face_1N_verification.matches_found
                },
                face_verification: {
                  matched: minimal.face_verification.matched,
                  score: minimal.face_verification.score
                },
                liveness:
                {
                  score:minimal.liveness_score.score
                }
              }
            })
          });

          if (!resp.ok) {
            const raw = await resp.text().catch(() => '');
            console.warn('DB save failed:', resp.status, resp.statusText, raw);
          }
        } catch (err) {
          console.warn('DB save error:', err);
        }

        return minimal; // stop polling and return the result
      }

      // wait for next poll
      await new Promise(r => setTimeout(r, interval));
    }

    throw new Error('Timed out waiting for verification result');
  }


  // ===== Core scan (with letterbox + robust checks) =====
  const scanFrame = async (side, delayFirst = false) => {
    const session = onnxSessionRef.current;
    const video = remoteVideoRef.current;
    const canvas = canvasRef.current;
    if (!session || !video || !video.srcObject || !canvas) return;

    if (video.readyState !== 4) {
      setTimeout(() => scanFrame(side, false), 600);
      return;
    }
    if (delayFirst) await new Promise((r) => setTimeout(r, 800));

    const IMG_SIZE = 640;
    canvas.width = IMG_SIZE;
    canvas.height = IMG_SIZE;
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
      const feeds = {};
      feeds[session.inputNames[0]] = inputTensor;
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
          setOcrStatus('Unexpected ONNX output shape');
          setTimeout(() => scanFrame(side, false), 800);
          return;
        }
      } else {
        setOcrStatus('ONNX output shape error');
        setTimeout(() => scanFrame(side, false), 800);
        return;
      }

      // 2) More tolerant thresholds
      const boxes_xywh_norm = rows.map((r) => r.slice(0, 4));
      const classScores = rows.map((r) => r.slice(4).map(sigmoid));
      const maxScores = classScores.map((sc) => Math.max(...sc));
      const classIds = classScores.map((sc) => sc.indexOf(Math.max(...sc)));
      const confThr = 0.40; // was 0.65
      const mask = maxScores.map((s) => s >= confThr);

      const boxesF_norm = boxes_xywh_norm.filter((_, i) => mask[i]);
      const scoresF = maxScores.filter((_, i) => mask[i]);
      const classIdsF = classIds.filter((_, i) => mask[i]);

      if (!boxesF_norm.length) {
        setOcrStatus(`Hold steady… detecting ${side} ID`);
        setTimeout(() => scanFrame(side, false), 600);
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
      let crop640 = null;
      if (side === 'front') {
        let chosen = null, best = -1;
        for (const i of fronts) {
          const b = boxes_px_640[i].map(Math.round);
          const s = scoresF[i];
          const hasLogoInside = logos.some((l) => boxInside(boxes_px_640[l].map(Math.round), b));
          const scoreBoost = hasLogoInside ? 0.15 : 0.0;
          const score = s + scoreBoost;
          if (score > best) { best = score; chosen = b; }
        }
        crop640 = chosen;
      } else {
        let chosen = null, best = -1;
        for (const i of backs) {
          const b = boxes_px_640[i].map(Math.round);
          const s = scoresF[i];
          if (s > best) { best = s; chosen = b; }
        }
        crop640 = chosen;
      }

      if (!crop640) {
        setOcrStatus(`Show the ${side} side clearly (good light, fill frame)`);
        setTimeout(() => scanFrame(side, false), 700);
        return;
      }

      // 4) Map crop back to original frame
      const cropOrig = unletterboxBox(crop640, meta, true);
      let [x1, y1, x2, y2] = cropOrig;
      const cropW = x2 - x1, cropH = y2 - y1;

      // sanity checks (permissive)
      if (cropW <= 0 || cropH <= 0) {
        setOcrStatus(`Reposition the ${side} side in frame`);
        setTimeout(() => scanFrame(side, false), 700);
        return;
      }

      // Accept typical ID aspect ratios; wider tolerance
      const ar = cropH / cropW; // H/W
      const minAR = 0.55, maxAR = 0.80;
      if (ar < minAR || ar > maxAR) {
        setOcrStatus(`Rotate/align the ${side} ID to be horizontal`);
        setTimeout(() => scanFrame(side, false), 700);
        return;
      }

      // Require reasonably large crop
      if (cropW < meta.vw * 0.35) {
        setOcrStatus('Bring the ID closer to the camera');
        setTimeout(() => scanFrame(side, false), 700);
        return;
      }

      // Crop at full video resolution
      const full = document.createElement('canvas');
      full.width = meta.vw;
      full.height = meta.vh;
      const fctx = full.getContext('2d');
      fctx.drawImage(video, 0, 0, meta.vw, meta.vh);
      const crop = fctx.getImageData(x1, y1, cropW, cropH);

      const outCanvas = document.createElement('canvas');
      outCanvas.width = cropW;
      outCanvas.height = cropH;
      outCanvas.getContext('2d').putImageData(crop, 0, 0);

      // Blur check
      if (isImageBlurry(outCanvas, 90)) {
        setOcrStatus('Image is blurry — hold steady a moment');
        setTimeout(() => scanFrame(side, false), 800);
        return;
      }

      // Convert to blob and store (no local download)
      const dataURL = outCanvas.toDataURL('image/png');
      const blob = await (await fetch(dataURL)).blob();
      const url = URL.createObjectURL(blob);
      const imgObj = {
        id: Date.now(),
        url,
        blob,
        timestamp: new Date().toISOString(),
        type: side === 'front' ? 'front_card' : 'back_card'
      };
      setCapturedImages((prev) => ({
        ...prev,
        [side === 'front' ? 'front_card' : 'back_card']: imgObj
      }));

      setPreviewImage(imgObj);
      setShowImagePreview(true);
      if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = setTimeout(() => setShowImagePreview(false), 1500);

      setOcrStatus(`${side === 'front' ? 'Front' : 'Back'} ID captured!`);
      setScanningSide(null);

      // Chain to back after front
      if (side === 'front' && !capturedImages.back_card) {
        setTimeout(() => setScanningSide('back'), 800);
      }
    } catch (e) {
      console.error('ONNX inference error', e);
      setOcrStatus('OCR processing error. Retrying…');
      setTimeout(() => scanFrame(side, false), 1000);
    }
  };

  // ===== Manual capture (kept for face) =====
  const captureImage = async () => {
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
        const img = {
          id: Date.now(),
          url,
          blob,
          timestamp: new Date().toISOString(),
          type: activeCaptureType
        };
        setCapturedImages((prev) => ({ ...prev, [activeCaptureType]: img }));
        setPreviewImage(img);
        setShowImagePreview(true);
        if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
        previewTimeoutRef.current = setTimeout(() => setShowImagePreview(false), 2000);
      },
      'image/jpeg',
      0.9
    );
  };

  // (Optional) legacy save to your server
  const saveAllImagesToDatabase = async () => {
    setIsSavingImage(true);
    const blobToBase64 = (blob) =>
      new Promise((resolve) => {
        if (!blob) return resolve(null);
        const r = new FileReader();
        r.onloadend = () => resolve((r.result || '').toString());
        r.readAsDataURL(blob);
      });
    try {
      const [frontB64, backB64, faceB64] = await Promise.all([
        blobToBase64(capturedImages.front_card?.blob),
        blobToBase64(capturedImages.back_card?.blob),
        blobToBase64(capturedImages.face?.blob)
      ]);
      const res = await fetch(`${API_BASE_URL}/api/call-images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, userId, images: { front: frontB64, back: backB64, face: faceB64 } })
      });
      if (!res.ok) throw new Error('Failed to save images');
      setOcrStatus('Images saved to server');
    } catch (e) {
      console.error(e);
      setOcrStatus('Save failed');
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

  const getCaptureTypeLabel = (t) =>
    t === 'face' ? 'Face' : t === 'front_card' ? 'Front ID' : t === 'back_card' ? 'Back ID' : t;

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
            <button onClick={onClose} className="vc-modal-cancel-button">
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
  <div className="vc-call-container">
    <style>{`
      :root {
        --panel-width: 320px;
        --capture-panel-width: 280px;
        --video-width: 640px;
        --video-height: 480px;
      }
      
      .vc-call-container {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: #000;
        display: flex;
        flex-direction: column;
        z-index: 1000;
        overflow: hidden;
      }
      
      .vc-call-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 20px;
        background: rgba(0,0,0,.7);
        color: #fff;
        z-index: 10;
        height: 60px;
        flex-shrink: 0;
      }
      
      .vc-call-status {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .vc-status-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
      }
      
      .vc-connected {
        background: #4CAF50;
        box-shadow: 0 0 8px #4CAF50;
      }
      
      .vc-connecting {
        background: #FFC107;
        box-shadow: 0 0 8px #FFC107;
        animation: pulse 1.5s infinite;
      }
      
      .vc-failed {
        background: #F44336;
        box-shadow: 0 0 8px #F44336;
      }
      
      .vc-status-text {
        font-size: 14px;
      }
      
      .vc-call-info {
        display: flex;
        align-items: center;
        gap: 15px;
      }
      
      .vc-close-button {
        background: none;
        border: none;
        color: #fff;
        cursor: pointer;
        padding: 5px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .vc-close-button:hover {
        background: rgba(255,255,255,.2);
      }
      
      .vc-main-content {
        display: flex;
        flex: 1;
        overflow: hidden;
        position: relative;
      }
      
      .vc-user-panel {
        width: var(--panel-width);
        background: rgba(0,0,0,.85);
        backdrop-filter: blur(10px);
        padding: 20px;
        color: #fff;
        z-index: 10;
        border-right: 1px solid rgba(255,255,255,.1);
        // overflow-y: auto;
        display: flex;
        flex-direction: column;
      }
      
      .vc-user-details-title {
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 15px;
        padding-bottom: 10px;
        border-bottom: 1px solid rgba(255,255,255,.2);
        display: flex;
        align-items: center;
        gap: 10px;
      }
      
      .vc-detail-row {
        display: flex;
        margin-bottom: 12px;
        font-size: 14px;
      }
      
      .vc-detail-label {
        font-weight: 600;
        min-width: 120px;
        opacity: .8;
      }
      
      .vc-flag-indicator {
        width: 24px;
        height: 16px;
        background: linear-gradient(to bottom,#FF9933,white,#138808);
        border-radius: 2px;
        position: relative;
        overflow: hidden;
      }
      
      .vc-flag-indicator::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 8px;
        height: 8px;
        background: #000080;
        border-radius: 50%;
        transform: translate(50%,50%);
      }
      
      .vc-verification-section {
        margin-top: 25px;
        padding-top: 20px;
        border-top: 1px solid rgba(255,255,255,.2);
      }
      
      .vc-verification-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 15px;
      }
      
      .vc-verification-icon {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: rgba(76,175,80,.2);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .vc-verification-title {
        font-size: 16px;
        font-weight: 600;
      }
      
      .vc-verification-result {
        background: rgba(255,255,255,.07);
        border-radius: 10px;
        padding: 15px;
      }
      
      .vc-result-item {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid rgba(255,255,255,.1);
      }
      
      .vc-result-label {
        opacity: .8;
      }
      
      .vc-result-value {
        font-weight: 600;
      }
      
      .vc-score-container {
        height: 6px;
        background: rgba(255,255,255,.1);
        border-radius: 3px;
        margin-top: 15px;
        overflow: hidden;
      }
      
      .vc-score-bar {
        height: 100%;
        background: #4CAF50;
        border-radius: 3px;
      }
      
      .vc-video-center {
        flex: 1;
        display: flex;
        justify-content: center;
        align-items: center;
        background: #000;
        position: relative;
      }
      
      .vc-video-container {
        position: relative;
        width: var(--video-width);
        height: var(--video-height);
        background: #000;
      }
      
      .vc-remote-video {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      
      .vc-remote-video.vc-hidden {
        visibility: hidden;
      }
      
      .vc-local-video-container {
        position: absolute;
        bottom: 10px;
        right: 10px;
        width: 160px;
        height: 120px;
        border-radius: 8px;
        overflow: hidden;
        border: 2px solid rgba(255,255,255,.5);
        box-shadow: 0 4px 12px rgba(0,0,0,.3);
        background: #000;
        z-index: 20;
      }
      
      .vc-local-video {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      
      .vc-video-off-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0,0,0,.7);
        color: #fff;
      }
      
      .vc-video-label {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: rgba(0,0,0,.7);
        color: #fff;
        font-size: 12px;
        padding: 3px;
        text-align: center;
      }
      
      .vc-captures-panel {
        width: var(--capture-panel-width);
        background: rgba(0,0,0,.85);
        backdrop-filter: blur(10px);
        padding: 20px;
        border-left: 1px solid rgba(255,255,255,.1);
        overflow-y: auto;
      }
      
      .vc-captures-header {
        font-size: 16px;
        font-weight: 600;
        margin-bottom: 15px;
        padding-bottom: 10px;
        border-bottom: 1px solid rgba(255,255,255,.2);
        display: flex;
        align-items: center;
        gap: 10px;
        color: #fff;
      }
      
      .vc-captures-container {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      
      .vc-capture-item {
        position: relative;
        width: 100%;
        height: 180px;
        border-radius: 8px;
        overflow: hidden;
        border: 2px solid rgba(255,255,255,.3);
        box-shadow: 0 4px 12px rgba(0,0,0,.3);
        transition: all .3s ease;
        cursor: pointer;
        background: rgba(0,0,0,.5);
      }
      
      .vc-capture-item.active {
        border-color: #4CAF50;
        box-shadow: 0 0 0 2px #4CAF50;
      }
      
      .vc-capture-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      
      .vc-capture-placeholder {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: rgba(255,255,255,.7);
        font-size: 12px;
        text-align: center;
        padding: 5px;
      }
      
      .vc-capture-label {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: rgba(0,0,0,.7);
        color: #fff;
        font-size: 12px;
        padding: 8px;
        text-align: center;
      }
      
      .vc-capture-actions {
        position: absolute;
        top: 0;
        right: 0;
        display: flex;
        gap: 5px;
        padding: 5px;
        opacity: 0;
        transition: opacity .2s;
      }
      
      .vc-capture-item:hover .vc-capture-actions {
        opacity: 1;
      }
      
      .vc-recapture-btn {
        background: rgba(0,0,0,.7);
        border: none;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        cursor: pointer;
      }
      
      .vc-ocr-status {
        position: absolute;
        bottom: 60px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,.7);
        color: #fff;
        padding: 8px 16px;
        border-radius: 20px;
        z-index: 20;
        font-size: 14px;
        white-space: nowrap;
      }
      
      .vc-ocr-controls {
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 10px;
        z-index: 20;
      }
      
      .vc-ocr-controls button {
        background: rgba(0,0,0,.7);
        color: #fff;
        border: 1px solid rgba(255,255,255,.3);
        border-radius: 4px;
        padding: 8px 16px;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .vc-ocr-controls button:hover {
        background: rgba(255,255,255,.1);
      }
      
      .vc-connection-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0,0,0,.8);
        z-index: 5;
      }
      
      .vc-connection-message {
        text-align: center;
        color: #fff;
        max-width: 300px;
        padding: 20px;
      }
      
      .vc-connecting-spinner {
        width: 40px;
        height: 40px;
        border: 4px solid rgba(255,255,255,.3);
        border-radius: 50%;
        border-top-color: #fff;
        animation: spin 1s ease-in-out infinite;
        margin: 0 auto;
      }
      
      .vc-controls-container {
        position: relative;
        padding: 15px 0;
        background: rgba(0,0,0,.7);
        display: flex;
        justify-content: center;
        z-index: 10;
        height: 80px;
        flex-shrink: 0;
      }
      
      .vc-controls-group {
        display: flex;
        gap: 20px;
      }
      
      .vc-control-button {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 5px;
        background: none;
        border: none;
        color: #fff;
        cursor: pointer;
        min-width: 70px;
        padding: 8px;
        border-radius: 8px;
        transition: all 0.2s;
      }
      
      .vc-control-button:hover {
        background: rgba(255,255,255,.1);
      }
      
      .vc-control-button:disabled {
        opacity: .5;
        cursor: not-allowed;
      }
      
      .vc-control-button.vc-muted,.vc-control-button.vc-video-off {
        color: #F44336;
      }
      
      .vc-control-icon {
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255,255,255,.1);
        border-radius: 50%;
      }
      
      .vc-control-label {
        font-size: 12px;
      }
      
      .vc-end-call .vc-control-icon {
        background: #F44336;
      }
      
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      
      @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.5; }
        100% { opacity: 1; }
      }
      
      @media (max-width: 1200px) {
        :root {
          --panel-width: 280px;
          --capture-panel-width: 240px;
        }
      }
      
      @media (max-width: 1024px) {
        :root {
          --panel-width: 240px;
          --capture-panel-width: 200px;
          --video-width: 540px;
          --video-height: 405px;
        }
        
        .vc-capture-item {
          height: 150px;
        }
      }
      
      @media (max-width: 900px) {
        :root {
          --panel-width: 220px;
          --capture-panel-width: 180px;
          --video-width: 480px;
          --video-height: 360px;
        }
        
        .vc-local-video-container {
          width: 140px;
          height: 105px;
        }
      }
    `}</style>

    <div className="vc-call-header">
      <div className="vc-call-status">
        <div
          className={`vc-status-dot ${connectionState === 'connected'
            ? 'vc-connected'
            : ['failed', 'disconnected'].includes(connectionState)
              ? 'vc-failed'
              : 'vc-connecting'
            }`}
        ></div>
        <span className="vc-status-text">{connectionStatusText}</span>
      </div>
      <div className="vc-call-info">
        <span className="vc-call-with">
          Calling: <strong>{userName}</strong>
        </span>
        <button onClick={endCall} className="vc-close-button" aria-label="Close call">
          <X size={20} />
        </button>
      </div>
    </div>

    <div className="vc-main-content">
      {/* Left Panel - User Details */}
      <div className="vc-user-panel">
        <div className="vc-user-details-title">
          <div className="vc-flag-indicator"></div>
          User Identity
        </div>
        
        <div className="vc-detail-row">
          <div className="vc-detail-label">Nationality</div>
          <div className="vc-detail-value">{userDetails?.Nationality ?? 'N/A'}</div>
        </div>
        <div className="vc-detail-row">
          <div className="vc-detail-label">Full Name</div>
          <div className="vc-detail-value">{userDetails?.['Full Name'] ?? 'N/A'}</div>
        </div>
        <div className="vc-detail-row">
          <div className="vc-detail-label">ID Number</div>
          <div className="vc-detail-value">{userDetails?.['Identity Card Number'] ?? 'N/A'}</div>
        </div>
        <div className="vc-detail-row">
          <div className="vc-detail-label">Date of Birth</div>
          <div className="vc-detail-value">{userDetails?.['Date of Birth'] ?? 'N/A'}</div>
        </div>
        <div className="vc-detail-row">
          <div className="vc-detail-label">Date of Issue</div>
          <div className="vc-detail-value">{userDetails?.['Date of Issue'] ?? 'N/A'}</div>
        </div>
        <div className="vc-detail-row">
          <div className="vc-detail-label">Date of Expiry</div>
          <div className="vc-detail-value">{userDetails?.['Date of Expiry'] ?? 'N/A'}</div>
        </div>
        <div className="vc-detail-row">
          <div className="vc-detail-label">Issuing State</div>
          <div className="vc-detail-value">
            {userDetails?.['Issuing State Name'] ??
              (userDetails?.['Issuing State Code'] ? `Code: ${userDetails['Issuing State Code']}` : 'N/A')}
          </div>
        </div>
        
        {verifyMinimalResult && (
          <div className="vc-verification-section">
            <div className="vc-verification-header">
              <div className="vc-verification-icon">
                <Check size={20} color="#4CAF50" />
              </div>
              <div className="vc-verification-title">Face Verification</div>
            </div>
            
            <div className="vc-verification-result">
              <div className="vc-result-item">
                <span className="vc-result-label">Matches 1:N </span>
                <span className="vc-result-value">
                  {verifyMinimalResult.face_1N_verification.matches_found ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="vc-result-item">
                <span className="vc-result-label">Match 1:1</span>
                <span className="vc-result-value">
                  {verifyMinimalResult.face_verification.matched ? 'Yes' : 'No'}
                </span>
              </div>
               
              
              <div className="vc-score-container">
                <div 
                  className="vc-score-bar" 
                  style={{ width: `${Math.min(100, Math.round(verifyMinimalResult.face_verification.score))}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}
      </div>
      
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

          {connectionState !== 'connected' && (
            <div className="vc-connection-overlay">
              <div className="vc-connection-message">
                {connectionState === 'media_error' ? (
                  <>
                    <div className="vc-error-icon">
                      <X size={36} />
                    </div>
                    <h3 className="vc-error-title">Permission Required</h3>
                    <p className="vc-error-message">{errorMessage || 'Camera/microphone access required'}</p>
                    <button onClick={handleJoinCall} className="vc-retry-button">
                      Allow & Retry
                    </button>
                  </>
                ) : (
                  <>
                    <div className="vc-spinner-container">
                      {['failed', 'disconnected'].includes(connectionState) ? (
                        <div className="vc-error-icon">
                          <X size={36} />
                        </div>
                      ) : (
                        <div className="vc-connecting-spinner"></div>
                      )}
                    </div>
                    <h3 className="vc-connection-title">
                      {['failed', 'disconnected'].includes(connectionState) ? 'Connection Lost' : connectionStatusText}
                    </h3>
                    <p className="vc-connection-message">
                      {errorMessage || 'Please wait while we connect your call'}
                    </p>
                    {['failed', 'disconnected'].includes(connectionState) && (
                      <button onClick={handleJoinCall} className="vc-retry-button">
                        Reconnect
                      </button>
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
                <button
                  onClick={() => setScanningSide('front')}
                  disabled={!onnxSessionRef.current || connectionState !== 'connected' || ocrLoading}
                >
                  {ocrLoading ? 'Loading...' : 'Scan Front ID'}
                </button>
                <button
                  onClick={() => setScanningSide('back')}
                  disabled={!onnxSessionRef.current || connectionState !== 'connected' || ocrLoading}
                >
                  {ocrLoading ? 'Loading...' : 'Scan Back ID'}
                </button>
              </>
            ) : (
              <button onClick={() => setScanningSide(null)}>Cancel Scan</button>
            )}
          </div>

          {/* Local self view */}
          <div className={`vc-local-video-container ${isVideoOff ? 'vc-video-off' : ''}`}>
            <video ref={localVideoRef} autoPlay playsInline muted className="vc-local-video" />
            {isVideoOff && (
              <div className="vc-video-off-overlay">
                <VideoOff size={28} />
              </div>
            )}
            <div className="vc-video-label">You</div>
          </div>
        </div>
      </div>
      
      {/* Right Panel - Captured Images */}
      <div className="vc-captures-panel">
        <div className="vc-captures-header">
          <Camera size={20} />
          Captured Images
        </div>
        
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
                      onClick={(e) => {
                        e.stopPropagation();
                        URL.revokeObjectURL(capturedImages[t].url);
                        setCapturedImages((p) => ({ ...p, [t]: null }));
                        setActiveCaptureType(t);
                      }}
                      title="Recapture"
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                  <div className="vc-capture-label">{getCaptureTypeLabel(t)}</div>
                </>
              ) : (
                <div className="vc-capture-placeholder">
                  <div style={{ marginBottom: 8 }}>
                    <Camera size={24} />
                  </div>
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
        <button
          onClick={toggleMute}
          className={`vc-control-button ${isMuted ? 'vc-muted' : ''}`}
          aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          <div className="vc-control-icon">{isMuted ? <MicOff size={24} /> : <Mic size={24} />}</div>
          <span className="vc-control-label">{isMuted ? 'Unmute' : 'Mute'}</span>
        </button>

        <button
          onClick={toggleVideo}
          className={`vc-control-button ${isVideoOff ? 'vc-video-off' : ''}`}
          aria-label={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
        >
          <div className="vc-control-icon">{isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}</div>
          <span className="vc-control-label">{isVideoOff ? 'Video Off' : 'Video On'}</span>
        </button>

        <button
          onClick={captureImage}
          className="vc-control-button"
          aria-label="Take picture"
          disabled={connectionState !== 'connected' || isSavingImage || !!scanningSide}
        >
          <div className="vc-control-icon">
            {isSavingImage ? <div className="vc-saving-spinner"></div> : <Camera size={24} />}
          </div>
          <span className="vc-control-label">
            {isSavingImage ? 'Saving...' : `Capture ${getCaptureTypeLabel(activeCaptureType)}`}
          </span>
        </button>

        <button
          onClick={saveAllImagesToDatabase}
          className="vc-control-button"
          disabled={!capturedImages.front_card || !capturedImages.back_card || isSavingImage || !!scanningSide}
        >
          <div className="vc-control-icon">{isSavingImage ? <div className="vc-saving-spinner"></div> : <span>💾</span>}</div>
          <span className="vc-control-label">{isSavingImage ? 'Saving...' : 'Save All'}</span>
        </button>

        <button onClick={endCall} className="vc-control-button vc-end-call" aria-label="End call">
          <div className="vc-control-icon">
            <PhoneOff size={24} />
          </div>
          <span className="vc-control-label">End Call</span>
        </button>
      </div>
    </div>
  </div>
);
}