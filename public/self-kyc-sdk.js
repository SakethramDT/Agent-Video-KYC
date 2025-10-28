async function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}


async function loadDependencies() {
  await loadScript("https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.js");
}


window.initKYC = async function(divId, { onSubmit }) {

  const expiryDate = new Date('2025-09-30');
  const today = new Date();

  const container = document.getElementById(divId);
  if (!container) {
    console.error("Container div not found");
    return;
  }

  if (today > expiryDate) {
    container.innerHTML = `
      <div style="display:flex;justify-content:center;align-items:center;height:100vh;color:#b00020;font-size:24px;font-weight:bold;">
        License expired
      </div>
    `;
    return;
  }

  // Make container full screen
  // container.style.width = '100vw';
  // container.style.height = '100vh';
  container.style.margin = '0';
  container.style.padding = '0';
  container.style.overflow = 'hidden';

  let video, canvas;
  let capturedFront = null;
  let capturedBack = null;
  let currentStep = 1;

  await loadDependencies();
  const onnxSession = await ort.InferenceSession.create('models/id.onnx');

  // ALL ORIGINAL FUNCTIONS REMAIN EXACTLY THE SAME
  // async function startCamera(facingMode = 'environment') {
  //   try {
  //     const stream = await navigator.mediaDevices.getUserMedia({
  //       video: {
  //         facingMode: { ideal: facingMode },
  //         width: { ideal: 1280 },
  //         height: { ideal: 720 }
  //       }
  //     });
  //     video.srcObject = stream;
  //     video.setAttribute("playsinline", true);
  //     await video.play();
  //   } catch (err) {
  //     console.error("Camera error:", err);
  //   }
  // }
  async function startCamera(facingMode = 'environment', zoomLevel = 2) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });

    const video = document.querySelector('video');
    video.srcObject = stream;
    video.setAttribute("playsinline", true);
    await video.play();

  } catch (err) {
    console.error("Camera error:", err);
  }
}


  function stopCamera() {
    const dots = document.querySelectorAll('.corner');
    dots.forEach(dot => {
      // dot.style.animation = 'blinkColor 1s infinite alternate';
      dot.classList.remove('green-flash');
       
    });
    
      
   

    if (video.srcObject) {
      video.srcObject.getTracks().forEach(track => track.stop());
      video.srcObject = null;
    }
  }

  function dataURLtoBlob(dataurl) {
    const [meta, content] = dataurl.split(',');
    const mime = meta.match(/:(.*?);/)[1];
    const bin = atob(content);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }


async function submitKYC() {
    if (typeof onSubmit === 'function') {
    onSubmit({ frontImage: capturedFront, backImage: capturedBack });
    } else {
      console.warn("No onSubmit callback provided.");
    }
    
}

  function showResult(result) {
    container.innerHTML = `<pre>${JSON.stringify(result, null, 2)}</pre>`;
  }


  function flashDotsGreenOnceThenReset() {
  const dots = document.querySelectorAll('.corner');

  dots.forEach(dot => {
    dot.classList.add('green-flash');
  });

  
}

function isImageBlurry(canvas, threshold = 100) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const gray = [];

  // Convert to grayscale
  for (let i = 0; i < imageData.data.length; i += 4) {
    const r = imageData.data[i];
    const g = imageData.data[i + 1];
    const b = imageData.data[i + 2];
    const avg = 0.2989 * r + 0.5870 * g + 0.1140 * b;
    gray.push(avg);
  }

  // Compute Laplacian
  const laplacianKernel = [
    0,  1, 0,
    1, -4, 1,
    0,  1, 0
  ];

  const width = canvas.width;
  const height = canvas.height;
  const laplacian = [];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const weight = laplacianKernel[(ky + 1) * 3 + (kx + 1)];
          const pixel = gray[(y + ky) * width + (x + kx)];
          sum += weight * pixel;
        }
      }
      laplacian.push(sum);
    }
  }

  // Compute variance
  const mean = laplacian.reduce((a, b) => a + b, 0) / laplacian.length;
  const variance = laplacian.reduce((a, b) => a + (b - mean) ** 2, 0) / laplacian.length;

  return variance < threshold; // true if blurry
}


  // Automated OCR scan loop
window.scanFrame = async function (
  scanningSide,
  videoRef,
  canvasRef,
  setCapturedFront,
  setCapturedBack,
  stopCamera,
  onnxSession,
  delayFirst = true
) {
  if (!scanningSide || !onnxSession || !videoRef || !canvasRef) return;

  const CLASS_NAMES = ['back', 'front','logo'];
  const video = videoRef;
  const canvas = canvasRef;
  const ctx = canvas.getContext("2d");

  if (video.readyState !== 4) {
    setTimeout(() => {
      window.scanFrame(scanningSide, videoRef, canvasRef, setCapturedFront, setCapturedBack, stopCamera, onnxSession);
    }, 1000);
    return;
  }

  if (delayFirst) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  const videoWidth = video.videoWidth;
  const videoHeight = video.videoHeight;

  canvas.width = 640;
  canvas.height = 640;

  const IMG_SIZE = 640;

// Draw video frame to canvas (already done)
ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

// Get image data from canvas (returns in RGBA format)
const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
const { data, width, height } = imageData;

// Resize image data to IMG_SIZE x IMG_SIZE (if not already)
const resizedCanvas = document.createElement("canvas");
resizedCanvas.width = IMG_SIZE;
resizedCanvas.height = IMG_SIZE;
const resizedCtx = resizedCanvas.getContext("2d");

// Resize image using drawImage
resizedCtx.drawImage(canvas, 0, 0, IMG_SIZE, IMG_SIZE);
const resizedData = resizedCtx.getImageData(0, 0, IMG_SIZE, IMG_SIZE).data;

// Convert RGBA to normalized RGB and then to CHW
const chw = new Float32Array(3 * IMG_SIZE * IMG_SIZE);

for (let i = 0; i < IMG_SIZE * IMG_SIZE; i++) {
  const r = resizedData[i * 4] / 255;
  const g = resizedData[i * 4 + 1] / 255;
  const b = resizedData[i * 4 + 2] / 255;

  chw[i] = r;                             // Channel 0 - R
  chw[IMG_SIZE * IMG_SIZE + i] = g;      // Channel 1 - G
  chw[2 * IMG_SIZE * IMG_SIZE + i] = b; // Channel 2 - B
}

// Create ONNX tensor
const inputTensor = new ort.Tensor('float32', chw, [1, 3, IMG_SIZE, IMG_SIZE]);


  try {
    const feeds = {};
    feeds[onnxSession.inputNames ? onnxSession.inputNames[0] : Object.keys(onnxSession.inputNames)[0]] = inputTensor;

    const results = await onnxSession.run(feeds);
    const output = results[onnxSession.outputNames ? onnxSession.outputNames[0]  : Object.keys(results)[0]];
    let predArr = [];
    if (output.dims.length === 3) {
        if (output.dims[1] === 7) {
            // [1,6,N]
            for (let i = 0; i < output.dims[2]; i++) {
                let row = [];
                for (let j = 0; j < output.dims[1]; j++) {
                    row.push(output.data[j * output.dims[2] + i]);
                }
                predArr.push(row);
            }
        } else if (output.dims[2] === 7) {
            // [1,N,6]
            for (let i = 0; i < output.dims[1]; i++) {
                let row = [];
                for (let j = 0; j < output.dims[2]; j++) {
                    row.push(output.data[i * output.dims[2] + j]);
                }
                predArr.push(row);
            }
        } else {
            alert("Unexpected ONNX output shape: " + output.dims);
            return;
        }
    } else {
        alert("ONNX output shape is not 3D: " + output.dims);
        return;
    }
    let boxes = predArr.map(r => r.slice(0, 4));
    let classScores = predArr.map(r => r.slice(4).map(sigmoid));
    let maxScores = classScores.map(sc => Math.max(...sc));
    let classIds = classScores.map(sc => sc.indexOf(Math.max(...sc)));
    let mask = maxScores.map(s => s > 0.65);
    let boxesF = boxes.filter((_, i) => mask[i]);
    let scoresF = maxScores.filter((_, i) => mask[i]);
    let classIdsF = classIds.filter((_, i) => mask[i]);
    let boxesXYXY = xywh2xyxy(boxesF);

    console.log(boxesXYXY)
    let orig_w = videoWidth,
    orig_h = videoHeight;
    for (let box of boxesXYXY) {
        box[0] *= orig_w;
        box[2] *= orig_w;
        box[1] *= orig_h;
        box[3] *= orig_h;
        box[0] = Math.max(0, Math.min(orig_w, box[0]));
        box[2] = Math.max(0, Math.min(orig_w, box[2]));
        box[1] = Math.max(0, Math.min(orig_h, box[1]));
        box[3] = Math.max(0, Math.min(orig_h, box[3]));
    }

    let nmsIdx = nonMaxSuppression(boxesXYXY, scoresF,0.45 );
    
    let backs = [];
    let fronts = [];
    let logos = [];
    for (let i of nmsIdx) {
        if (classIdsF[i] === 0) backs.push(i);
        if (classIdsF[i] === 1) fronts.push(i);
        if (classIdsF[i] === 2) logos.push(i);
    }

    if (nmsIdx.length > 0) {
        let maxIdx = nmsIdx.reduce((a, b) => scoresF[a] > scoresF[b] ? a : b);
        nmsIdx = [maxIdx];
    }

    var cropX = 0;
    var cropY = 0;
    var cropWidth = 0;
    var cropHeight = 0;
    var Label = "";

    if (scanningSide === 'front') {
      for (let idx of fronts) {
          let frontBox = boxesXYXY[idx].map(Math.round);
          let foundLogo = null;
          for (let lIdx of logos) {
              let logoBox = boxesXYXY[lIdx].map(Math.round);
              if (boxInside(logoBox, frontBox)) {
                  foundLogo = lIdx;
                  break;
              }
          }
          if (foundLogo !== null) {
              // Draw the front
              let score = scoresF[idx];
              let label = 'front';
              
              console.log(frontBox,score,label)
              if( score >0.7){
              cropX = frontBox[0];
              cropY = frontBox[1];
              cropWidth =  frontBox[2] - frontBox[0];
              cropHeight =  frontBox[3] -  frontBox[1];
              Label = label;
              break;
              }
          }
      }

    } else {
      for (let idx of backs) {
          let box = boxesXYXY[idx].map(Math.round);
          let score = scoresF[idx];
          let label = 'back';
          console.log(box,score,label)
          if( score > 0.7){
          cropX = box[0];
          cropY = box[1];
          cropWidth =  box[2] - box[0];
          cropHeight =  box[3] -  box[1];
          Label = label;
          break;
          }
      }
    }
   

    if (0.61 <= (cropHeight/cropWidth) <= 0.66){
      setTimeout(() => {
        window.scanFrame(scanningSide, videoRef, canvasRef, setCapturedFront, setCapturedBack, stopCamera, onnxSession, false);
      }, 1000);
      return;
    }

    if (Label != scanningSide) {
      console.log("Rejected: different side detected");
      statusMsg.textContent = `Please show ${scanningSide} side of ID card`;
      document.querySelectorAll('.corner').forEach(corner => corner.classList.add('flash-red'));
      setTimeout(() => {
        document.querySelectorAll('.corner').forEach(corner => corner.classList.remove('flash-red'));
        window.scanFrame(scanningSide, videoRef, canvasRef, setCapturedFront, setCapturedBack, stopCamera, onnxSession, false);
      }, 1000);
      return;
    }
    

    if (cropWidth <= cropHeight) {
      console.log("Rejected: Not horizontal");
      statusMsg.textContent = "Please show a horizontal ID card";
      
      setTimeout(() => {
        
        window.scanFrame(scanningSide, videoRef, canvasRef, setCapturedFront, setCapturedBack, stopCamera, onnxSession, false);
      }, 1000);
      return;
    }

    if (cropWidth <= videoWidth / 2) {
      statusMsg.textContent = "Please bring the ID card closer to the camera";
      document.querySelectorAll('.corner').forEach(corner => corner.classList.add('flash-red'));
      setTimeout(() => {
        document.querySelectorAll('.corner').forEach(corner => corner.classList.remove('flash-red'));
        window.scanFrame(scanningSide, videoRef, canvasRef, setCapturedFront, setCapturedBack, stopCamera, onnxSession, false);
      }, 1000);
      return;
    }

    flashDotsGreenOnceThenReset();
    await new Promise(resolve => setTimeout(resolve, 1000));

    const fullCanvas = document.createElement('canvas');
    fullCanvas.width = videoWidth;
    fullCanvas.height = videoHeight;
    const fullCtx = fullCanvas.getContext('2d');
    fullCtx.drawImage(video, 0, 0, videoWidth, videoHeight);
    const croppedImage = fullCtx.getImageData(cropX, cropY, cropWidth, cropHeight);

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = cropWidth;
    outputCanvas.height = cropHeight;
    outputCanvas.getContext('2d').putImageData(croppedImage, 0, 0);
    const dataURL = outputCanvas.toDataURL('image/png');


    if (isImageBlurry(outputCanvas)) {
      console.log("Rejected: Image is blurry");
      statusMsg.textContent = "Image is blurry. Please hold steady.";
      document.querySelectorAll('.corner').forEach(corner => corner.classList.add('flash-red'));
      setTimeout(() => {
        document.querySelectorAll('.corner').forEach(corner => corner.classList.remove('flash-red'));
        window.scanFrame(scanningSide, videoRef, canvasRef, setCapturedFront, setCapturedBack, stopCamera, onnxSession, false);
      }, 1000);
      return;
    }

    if (scanningSide === 'front') {
      setCapturedFront(dataURL);
    } else {
      setCapturedBack(dataURL);
    }

    stopCamera();
    loader.style.display = "none";
    return;

  } 
  catch (err) {
    console.error("ONNX inference error or no detection:", err);
    loader.style.display = "none";
    setTimeout(() => {
      window.scanFrame(scanningSide, videoRef, canvasRef, setCapturedFront, setCapturedBack, stopCamera, onnxSession);
    }, 1500);
  }

  

  function sigmoid(x) {
            return 1 / (1 + Math.exp(-x));
        }

  function xywh2xyxy(x) {
      return x.map(box => [
          box[0] - box[2] / 2, box[1] - box[3] / 2,
          box[0] + box[2] / 2, box[1] + box[3] / 2
      ]);
  }

  function iou(boxA, boxB) {
      const [xA, yA, xA2, yA2] = boxA, [xB, yB, xB2, yB2] = boxB;
      const x1 = Math.max(xA, xB),
          y1 = Math.max(yA, yB);
      const x2 = Math.min(xA2, xB2),
          y2 = Math.min(yA2, yB2);
      const interArea = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
      const boxAArea = Math.max(0, xA2 - xA) * Math.max(0, yA2 - yA);
      const boxBArea = Math.max(0, xB2 - xB) * Math.max(0, yB2 - yB);
      return interArea / (boxAArea + boxBArea - interArea + 1e-6);
  }

  function nonMaxSuppression(boxes, scores, iouThreshold) {
      let idxs = Array.from(Array(boxes.length).keys());
      idxs.sort((a, b) => scores[b] - scores[a]);
      const keep = [];
      while (idxs.length > 0) {
          let curr = idxs.shift();
          keep.push(curr);
          idxs = idxs.filter(i => iou(boxes[curr], boxes[i]) < iouThreshold);
      }
      return keep;
  }


  function boxInside(inner, outer) {
            // True if inner box is fully inside outer box
            const [xi1, yi1, xi2, yi2] = inner;
            const [xo1, yo1, xo2, yo2] = outer;
            return xi1 >= xo1 && yi1 >= yo1 && xi2 <= xo2 && yi2 <= yo2;
        }
};




  // NEW UI IMPLEMENTATION
  container.innerHTML = `
    <div class="kyc-app">
    
      
      <main class="kyc-content">
        <h1 class="kyc-title">ID Validation</h1>
        
        <div class="kyc-stepper">
          <div class="progress-line" id="progress-line"></div>
          <div class="kyc-step active" id="step1">
            <div class="step-circle">1</div>
            <div class="step-label">Front ID</div>
          </div>
          <div class="kyc-step" id="step2">
            <div class="step-circle">2</div>
            <div class="step-label">Back ID</div>
          </div>
          <div class="kyc-step" id="step3">
            <div class="step-circle">3</div>
            <div class="step-label">Review</div>
          </div>
        </div>
        
        <!-- Capture View -->
        <div class="kyc-video-container" id="capture-view">
        <div style="position: relative;">
          <video id="kyc-video" autoplay playsinline class="kyc-video"></video>
          <div class="corner top-left"></div>
  <div class="corner top-right"></div>
  <div class="corner bottom-right"></div>
  <div class="corner bottom-left"></div>
        </div>
          <p class="kyc-status" id="status-msg">Please position the front of your ID card within the frame</p>
          <div class="kyc-loader" id="kyc-loader">
            <div class="loader-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
        
        <!-- Review View -->
        <div class="kyc-review" id="review-view" style="display: none;">
          <div class="kyc-preview-container">
            <div class="kyc-preview-item">
              <p>Front ID</p>
              <img id="front-preview" src="" alt="Front ID Preview">
              <button class="kyc-button recapture" id="recapture-front">Recapture Front</button>
            </div>
            <div class="kyc-preview-item">
              <p>Back ID</p>
              <img id="back-preview" src="" alt="Back ID Preview">
              <button class="kyc-button recapture" id="recapture-back">Recapture Back</button>
            </div>
          </div>
          
          <button class="kyc-button submit" id="submit-btn">Submit</button>
        </div>
      </main>
      
      
    </div>

    <style>
      /* Full-screen styles */
      html, body, .kyc-app {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        font-family: 'IBM Plex Sans Arabic', sans-serif;
        overflow: hidden;
      }
      
      .kyc-app {
        display: flex;
        flex-direction: column;
        background-color: #f9f7ed;
      }
      
      .kyc-header {
        background-color: #cba344;
        color: white;
        padding: 15px;
        display: flex;
        justify-content: center;
        align-items: center;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      
      .header-logo {
        height: 36px;
      }
      
      .kyc-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        padding: 20px;
        padding: 25px;
        overflow-y: auto;
      }
      
      .kyc-title {
        text-align: center;
        color: #cba344;
        margin-bottom: 20px;
      }
      
      /* Enhanced Stepper Styles */
.kyc-stepper {
  display: flex;
  justify-content: space-between;
  position: relative;
  margin: 0 auto 30px;
  width: 100%;
  max-width: 600px;
}

.kyc-stepper::before {
  content: '';
  position: absolute;
  top: 15px;
  left: 0;
  right: 0;
  height: 2px;
  background-color: #e1e1e1; /* Light gray for incomplete portion */
  z-index: 0;
}

.progress-line {
  position: absolute;
  top: 15px;
  left: 0;
  height: 2px;
  background-color: #cba344; /* Gold color for completed portion */
  z-index: 1;
  transition: width 0.3s ease;
}

.kyc-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 2;
}

.step-circle {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background-color: #e1e1e1; /* Default inactive color */
  color: #666;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  transition: all 0.3s ease;
}

.kyc-step.active .step-circle {
  background-color: #cba344; /* Gold for current step */
  color: white;
}

.kyc-step.completed .step-circle {
  background-color: #cba344; /* Gold for completed steps */
  color: white;
}

.step-label {
  margin-top: 8px;
  font-size: 14px;
  color: #666; /* Default inactive color */
  transition: all 0.3s ease;
}

.kyc-step.active .step-label {
  color: #333; /* Dark for current step */
  font-weight: 600;
}

.kyc-step.completed .step-label {
  color: #cba344; /* Gold for completed steps */
  font-weight: 500;
}
      /* Video capture area */
      .kyc-video-container {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        
      }
      
      .corner {
  width: 20px;
  height: 20px;
  position: absolute;
  z-index: 10;
}

.corner::before,
.corner::after {
  content: '';
  position: absolute;
  background-color: rgb(243 164 23);
  animation: blinkColor 1s infinite alternate;
}

.corner::before {
  width: 100%;
  height: 4px;
}

.corner::after {
  width: 4px;
  height: 100%;
}

.top-left {
  top: -8px;
  left: -8px;
}

.top-left::before {
  top: 0;
  left: 0;
}

.top-left::after {
  top: 0;
  left: 0;
}

.top-right {
  top: -8px;
  right: -8px;
  transform: rotate(90deg);
}

.bottom-right {
  bottom: -4px;
  right: -8px;
  transform: rotate(180deg);
}

.bottom-left {
  bottom: -4px;
  left: -8px;
  transform: rotate(270deg);
}

@keyframes blinkColor {
  0% {
    background-color: #c6b8b8;
  }
  100% {
    background-color: rgb(243 164 23);
  }
}


.corner.green-flash::before,
.corner.green-flash::after {
  background-color: #28a745 !important; /* green */
  animation: none !important;
}

.corner.flash-red::before,
.corner.flash-red::after {
  background-color: red !important;
  animation: none !important;
}


      .kyc-video {
        width: 100%;
        max-width: 600px;
        max-height: 60vh;
        background-color: #f5f5f5;
        border-radius: 8px;
        aspect-ratio: 16 / 9;
        object-fit: cover;
      }
      
      .kyc-status {
        text-align: center;
        color: #cba344;
        margin: 15px 0;
        min-height: 24px;
      }
      
      /* Review page styles */
      .kyc-review {
        display: none;
        flex-direction: column;
        align-items: center;
        padding: 20px;
      }
      
      .kyc-preview-container {
        display: flex;
        flex-wrap: nowrap;
        justify-content: center;
        gap: 20px;
        margin-bottom: 30px;
      }
      
      .kyc-preview-item {
        background: white;
        padding: 15px;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        width: 100%;
        max-width: 400px;
        text-align: center;
      }
      
      .kyc-preview-item img {
        width: 100%;
        max-height: 40vh;
        object-fit: contain;
        border-radius: 4px;
        margin-bottom: 15px;
      }
      
      /* Buttons */
      .kyc-actions {
        display: flex;
        justify-content: center;
        gap: 15px;
        margin-top: 20px;
      }
      
      .kyc-button {
        padding: 12px 24px;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
        border: none;
        transition: all 0.2s;
      }
      
      .kyc-button.recapture {
        background-color: #f0f0f0;
        color: #333;
      }
      
      .kyc-button.next {
        background-color: #cba344;
        color: white;
      }
      
      .kyc-button.submit {
        background-color: #cba344;
        color: white;
        padding: 12px 40px;
      }
      
      /* Loader */
      .kyc-loader {
        display: none;
        text-align: center;
        margin: 15px 0;
      }
      
      .loader-dots {
        display: inline-flex;
        gap: 6px;
      }
      
      .loader-dots span {
        width: 10px;
        height: 10px;
        background: #cba344;
        border-radius: 50%;
        display: inline-block;
        animation: bounce 1s infinite alternate;
      }
      
      .loader-dots span:nth-child(2) { animation-delay: 0.2s; }
      .loader-dots span:nth-child(3) { animation-delay: 0.4s; }
      
      @keyframes bounce {
        to { transform: translateY(-6px); }
      }
      
      /* Footer */
      .kyc-footer {
        background-color: #cba344;
        color: white;
        padding: 15px;
        text-align: center;
        font-size: 14px;
      }
    </style>
  `;

  // Initialize elements
  video = document.getElementById('kyc-video');
  canvas = document.createElement('canvas');
  canvas.style.display="none";
  document.body.appendChild(canvas);
  
  const statusMsg = document.getElementById('status-msg');
  const frontPreview = document.getElementById('front-preview');
  const backPreview = document.getElementById('back-preview');
  const captureView = document.getElementById('capture-view');
  const reviewView = document.getElementById('review-view');
  const recaptureFrontBtn = document.getElementById('recapture-front');
  const recaptureBackBtn = document.getElementById('recapture-back');
  const submitBtn = document.getElementById('submit-btn');
  const progressLine = document.getElementById('progress-line');
  const loader = document.getElementById('kyc-loader');

  // Update stepper UI with enhanced coloring
function updateStepper(step) {
  currentStep = step;
  const steps = document.querySelectorAll('.kyc-step');
  const progressLine = document.getElementById('progress-line');
  
  steps.forEach((stepEl, index) => {
    const circle = stepEl.querySelector('.step-circle');
    const label = stepEl.querySelector('.step-label');
    
    // Reset all steps first
    circle.style.backgroundColor = '#e1e1e1';
    circle.style.color = '#666';
    label.style.color = '#666';
    label.style.fontWeight = '400';
    stepEl.classList.remove('active', 'completed');
    
    // Current step (active)
    if (index + 1 === step) {
      circle.style.backgroundColor = '#cba344';
      circle.style.color = 'white';
      label.style.color = '#333';
      label.style.fontWeight = '600';
      stepEl.classList.add('active');
    } 
    // Completed steps
    else if (index + 1 < step) {
      circle.style.backgroundColor = '#cba344';
      circle.style.color = 'white';
      label.style.color = '#cba344';
      label.style.fontWeight = '500';
      stepEl.classList.add('completed');
    }
  });
  
  // Update progress line (gold color for completed portion)
  progressLine.style.width = `${((step - 1) / 2) * 100}%`;
  progressLine.style.backgroundColor = '#cba344';
  
  // Special case for final step (100% completion)
  if (step === 3) {
    progressLine.style.width = '100%';
  }
}

  // ORIGINAL SET CAPTURED FRONT FUNCTION (with UI updates)
  function setCapturedFront(img) {
    capturedFront = img;
    frontPreview.src = img;
    statusMsg.textContent = "Front ID captured successfully!";
    loader.style.display = "none";
    updateStepper(2);
    
    // Show back capture after delay
    setTimeout(() => {
      statusMsg.textContent = "Please position the back of your ID card within the frame";
      startCamera();
      // window.scanFrame('back', video, canvas, window.Tesseract, setCapturedFront, setCapturedBack, stopCamera);
      // window.scanFrame('back', video, canvas, setCapturedFront, setCapturedBack, stopCamera, onnxSession);
      window.scanFrame('back', video, canvas, setCapturedFront, setCapturedBack, stopCamera, onnxSession, true);


    }, 1500);
  }

  // ORIGINAL SET CAPTURED BACK FUNCTION (with UI updates)
  function setCapturedBack(img) {
    capturedBack = img;
    backPreview.src = img;
    stopCamera();
    loader.style.display = "none";
    updateStepper(3);
    
    // Switch to review view
    captureView.style.display = 'none';
    reviewView.style.display = 'flex';
  }

  // ORIGINAL RECAPTURE FUNCTIONS (with UI updates)
  recaptureFrontBtn.onclick = async () => {
    reviewView.style.display = 'none';
    captureView.style.display = 'flex';
    updateStepper(1);
    statusMsg.textContent = "Please position the front of your ID card within the frame";
    loader.style.display = "block";
    await startCamera();
    // window.scanFrame('front', video, canvas, window.Tesseract, setCapturedFront, setCapturedBack, stopCamera);
    // window.scanFrame('front', video, canvas, setCapturedFront, setCapturedBack, stopCamera, onnxSession);
    window.scanFrame('front', video, canvas, setCapturedFront, setCapturedBack, stopCamera, onnxSession, true);


  };

  recaptureBackBtn.onclick = async () => {
    reviewView.style.display = 'none';
    captureView.style.display = 'flex';
    updateStepper(2);
    statusMsg.textContent = "Please position the back of your ID card within the frame";
    loader.style.display = "block";
    await startCamera();
    // window.scanFrame('back', video, canvas, window.Tesseract, setCapturedFront, setCapturedBack, stopCamera);
    // window.scanFrame('back', video, canvas, setCapturedFront, setCapturedBack, stopCamera, onnxSession);
    window.scanFrame('back', video, canvas, setCapturedFront, setCapturedBack, stopCamera, onnxSession, true);


  };

  // ORIGINAL SUBMIT FUNCTION
  submitBtn.onclick = submitKYC;

  // Start the process
  updateStepper(1);
  loader.style.display = "block";
  await startCamera();
  // window.scanFrame('front', video, canvas, window.Tesseract, setCapturedFront, setCapturedBack, stopCamera);
  // window.scanFrame('front', video, canvas, setCapturedFront, setCapturedBack, stopCamera, onnxSession);
  window.scanFrame('front', video, canvas, setCapturedFront, setCapturedBack, stopCamera, onnxSession, true);


};





























































