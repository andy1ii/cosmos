// --- CONFIGURATION ---
let carouselScroll = 0;        
let opticalOffset = 15; 
let delayStart = 20; // 1 Second Pause (30 frames)

// --- TEXT & FONTS ---
let fontSans, fontSerif;
let leftText = "Coffee Houses "; 
let rightText = "curated by @DAVIDSMITH";

// Image Management
let imgs = [];
let nodes = [];
let totalCarouselWidth = 0; 
let uploadCounter = 0;

// Camera & Interaction
let camDist = 800; 

// Video/Export State
let isRecording = false;
let recorder;
let recordingFrameCount = 0; 

// DOM Elements
let uploadInput, exportBtn, recordBtn, resetBtn;
let leftTextInput, rightTextInput; 

function preload() {
  fontSans = loadFont('resources/FTRegolaNeueTrial-Semibold.otf');
  fontSerif = loadFont('resources/ItemsTextTrial-Book.otf');
}

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  noStroke();
  textureMode(NORMAL); 
  
  if (typeof CCapture === 'undefined') {
      loadScript("https://unpkg.com/ccapture.js@1.1.0/build/CCapture.all.min.js", () => {
          console.log("CCapture loaded dynamically.");
      });
  }
  
  setupUI();
  rebuildCarousel();
}

function draw() {
  background(0); 
  
  camera(0, 0, camDist, 0, 0, 0, 0, 1, 0);

  // --- CALCULATE TEXT METRICS FIRST (Needed for positioning) ---
  push();
  textSize(40); 
  textFont(fontSerif); let wl = textWidth(leftText);
  textFont(fontSans);  let wr = textWidth(rightText);
  pop();

  // --- 1. ANIMATION LOGIC ---
  let targetGap = (nodes.length > 0) ? (totalCarouselWidth / 2) + 80 : 0;
  let currentTextGap = 0;
  let animProgress = 0; 

  if (isRecording) {
      // ** CHANGE: Logic only starts AFTER the delay **
      if (recordingFrameCount > delayStart) {
          let activeFrame = recordingFrameCount - delayStart;
          // Split happens fast (25 frames)
          animProgress = map(activeFrame, 0, 25, 0, 1, true);
          animProgress = easeOutExpo(animProgress); 
      } else {
          animProgress = 0; // Hold closed during pause
      }
      currentTextGap = targetGap * animProgress;
  } else {
      currentTextGap = targetGap; 
      animProgress = (nodes.length > 0) ? 1 : 0;
  }

  // --- 2. DRAW TEXT ---
  push();
  fill(255);
  textSize(40); 
  noStroke();
  
  // Optical Center Logic
  let startShift = ((wl - wr) / 2) + opticalOffset;
  let currentShift = lerp(startShift, 0, animProgress);

  // Left Text
  textFont(fontSerif); 
  textAlign(RIGHT, CENTER);
  text(leftText, -currentTextGap + carouselScroll + currentShift, 0); 
  
  // Right Text
  textFont(fontSans); 
  textAlign(LEFT, CENTER);
  // Note: We use this exact position math to calculate the landing later
  text(rightText, currentTextGap + carouselScroll + currentShift, 0);
  pop();

  // --- 3. DYNAMIC SCROLL LOGIC ---

  if (isRecording && nodes.length > 0) {
      recordingFrameCount++;

      // Only animate scroll after delay
      if (recordingFrameCount > delayStart) {
          let activeFrame = recordingFrameCount - delayStart;

          // PHASE 1: Quick Anticipation Pan (First 30 active frames)
          if (activeFrame <= 30) {
              let targetLeftPan = 300; 
              let progress = map(activeFrame, 0, 30, 0, 1, true);
              progress = easeOutExpo(progress); 
              carouselScroll = lerp(0, targetLeftPan, progress);
          }

          // PHASE 2: The "Velocity Curve" to the End
          if (activeFrame > 35) {
              // ** CALCULATE LANDING SPOT **
              // We want the Right Text (at +currentTextGap) to land at 0 (minus half width for visual center)
              let startScroll = 300;
              let endScroll = -targetGap - (wr / 2); 
              
              // Duration: 90 frames of travel
              let scrollProgress = map(activeFrame, 35, 125, 0, 1, true);
              scrollProgress = easeInOutQuint(scrollProgress); 
              
              carouselScroll = lerp(startScroll, endScroll, scrollProgress);
          }

          // Stop Condition (Extended to allow settling)
          if (activeFrame > 140) {
              stopVideoExport();
          }
      }
  } else if (!isRecording && nodes.length > 0) {
      // Manual Control
      let mouseLimit = totalCarouselWidth / 2;
      let targetScroll = map(mouseX, 0, width, mouseLimit, -mouseLimit);
      carouselScroll = lerp(carouselScroll, targetScroll, 0.1);
  } else if (nodes.length === 0) {
      carouselScroll = 0;
  }

  // --- 4. DRAW IMAGES ---
  for (let i = 0; i < nodes.length; i++) {
      let n = nodes[i];
      push();
      translate(n.xOff + carouselScroll, 0, 0);
      
      if (isRecording) {
          // Add delay to start frame as well
          let startFrame = delayStart + 5 + (i * 2); 
          
          if (recordingFrameCount > startFrame) {
              let popProgress = map(recordingFrameCount, startFrame, startFrame + 12, 0, 1, true);
              n.currentScale = easeOutBack(popProgress); 
          } else {
              n.currentScale = 0;
          }
      } else {
          n.currentScale = lerp(n.currentScale, 1, 0.1);
      }
      
      scale(n.currentScale);
      texture(n.img);
      plane(n.w, n.h);
      pop();
  }

  if (isRecording && recorder) {
      recorder.capture(document.querySelector('canvas'));
  }
}

// --- EASING FUNCTIONS ---

function easeOutExpo(x) {
    return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

function easeOutBack(x) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

function easeInOutQuint(x) {
    return x < 0.5 ? 16 * x * x * x * x * x : 1 - Math.pow(-2 * x + 2, 5) / 2;
}

// --- CORE FUNCTIONS ---

function rebuildCarousel() {
  nodes = [];
  if (imgs.length === 0) {
      totalCarouselWidth = 0;
      return;
  }

  let padding = 20; 
  let currentTotalW = 0;

  let sizingData = imgs.map(img => {
      if (!img.randomH) img.randomH = random(250, 450); 
      let h = img.randomH;
      let ratio = img.width / img.height;
      let w = h * ratio;
      currentTotalW += w;
      return { img, w, h };
  });

  if (sizingData.length > 0) {
      currentTotalW += (sizingData.length - 1) * padding;
  }
  
  totalCarouselWidth = currentTotalW;

  let startX = -totalCarouselWidth / 2;

  nodes = sizingData.map((d, index) => {
      let centerX = startX + (d.w / 2);
      let node = { 
          img: d.img, 
          xOff: centerX, 
          w: d.w,
          h: d.h,
          currentScale: 0
      };
      startX += d.w + padding;
      return node;
  });
}

function handleFileUpload(file) {
  if (file.type === 'image') {
    loadImage(file.data, (loadedImg) => {
      let roundedImg = makeRounded(loadedImg, 20);
      roundedImg.randomH = random(250, 450);
      imgs.push(roundedImg);
      rebuildCarousel();
      uploadCounter++;
    });
  }
}

function handleReset() {
  imgs = [];
  nodes = [];
  carouselScroll = 0;
  totalCarouselWidth = 0;
}

function handleExport() {
  save("layout_export.png");
}

function startVideoExport() {
    if (nodes.length === 0) {
        alert("⚠️ Please upload images first before hitting 'Save Video'!");
        return; 
    }

    if (typeof CCapture === 'undefined') { 
        alert("Video engine still loading... please wait 5 seconds and try again."); 
        return; 
    }
    
    carouselScroll = 0; 
    recordingFrameCount = 0; 

    for(let i=0; i<nodes.length; i++) {
        nodes[i].currentScale = 0; 
    }

    try {
        recorder = new CCapture({ format: 'webm', framerate: 30 });
        recorder.start();
        isRecording = true;
        recordBtn.html("Recording...");
        recordBtn.style('color', 'red');
    } catch(e) {
        alert("Could not start recording. Refresh and try again.");
        isRecording = false;
    }
}

function stopVideoExport() {
    if(recorder) {
        recorder.stop(); 
        recorder.save();
        isRecording = false; 
        
        recordBtn.html("Save Video");
        recordBtn.style('color', '#fff');
    }
}

function handleVideoToggle() {
    if (isRecording) stopVideoExport(); else startVideoExport();
}

function setupUI() {
  leftTextInput = createInput(leftText);
  leftTextInput.attribute('placeholder', 'Left Text');
  leftTextInput.input(() => { leftText = leftTextInput.value(); });

  rightTextInput = createInput(rightText);
  rightTextInput.attribute('placeholder', 'Right Text');
  rightTextInput.input(() => { rightText = rightTextInput.value(); });

  uploadInput = createFileInput(handleFileUpload);
  uploadInput.attribute('multiple', 'true'); 
  
  uploadInput.elt.onclick = () => { handleReset(); };
  
  exportBtn = createButton('Save Image');
  exportBtn.mousePressed(handleExport);
  
  recordBtn = createButton('Save Video');
  recordBtn.mousePressed(handleVideoToggle); 
  
  resetBtn = createButton('Reset');
  resetBtn.mousePressed(handleReset); 
  
  styleUIElement(uploadInput);
  styleUIElement(exportBtn); styleUIElement(resetBtn);
  styleUIElement(recordBtn);
  styleUIElement(leftTextInput); styleUIElement(rightTextInput);
  
  leftTextInput.style('width', '140px');
  rightTextInput.style('width', '140px');

  positionUI();
}

function positionUI() {
  let yPos = height - 40; 
  leftTextInput.position(20, yPos);
  rightTextInput.position(180, yPos);
  let rightMargin = width - 20;
  resetBtn.position(rightMargin - 60, yPos);
  recordBtn.position(rightMargin - 150, yPos);
  exportBtn.position(rightMargin - 240, yPos);
  uploadInput.position(rightMargin - 440, yPos);
}

function makeRounded(img, radius) {
  let mask = createGraphics(img.width, img.height);
  mask.clear(); mask.fill(255); mask.noStroke();
  mask.rect(0, 0, img.width, img.height, radius);
  let newImg = img.get();
  newImg.mask(mask);
  mask.remove();
  return newImg;
}

function styleUIElement(elt) {
  elt.style('background', 'transparent');
  elt.style('border', '1px solid #555');
  elt.style('color', '#fff');
  elt.style('padding', '4px');
  elt.style('font-family', 'sans-serif');
  elt.style('cursor', 'pointer');
}

function loadScript(url, callback){
    var script = document.createElement("script");
    script.type = "text/javascript";
    script.onload = function(){ callback(); };
    script.src = url;
    document.getElementsByTagName("head")[0].appendChild(script);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  positionUI();
}
