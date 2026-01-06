// --- CONFIGURATION ---
let carouselScroll = 0;       

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

  // --- 1. ANIMATION LOGIC (Text Split) ---
  let targetGap = (nodes.length > 0) ? (totalCarouselWidth / 2) + 60 : 0;
  let currentTextGap = 0;

  if (isRecording) {
      // FAST OPEN: Text splits open quickly (0-30 frames)
      let splitProgress = map(recordingFrameCount, 0, 30, 0, 1, true);
      // Smooth Easing (Cubic Out)
      splitProgress = 1 - Math.pow(1 - splitProgress, 3);
      currentTextGap = targetGap * splitProgress;
  } else {
      currentTextGap = targetGap; 
  }

  // --- 2. DRAW TEXT ---
  push();
  fill(255);
  textSize(40); 
  noStroke();
  
  textFont(fontSerif); 
  textAlign(RIGHT, CENTER);
  text(leftText, -currentTextGap + carouselScroll, 0); 
  
  textFont(fontSans); 
  textAlign(LEFT, CENTER);
  text(rightText, currentTextGap + carouselScroll, 0);
  pop();

  // --- 3. CINEMATIC SCROLL LOGIC ---
  let scrollLimit = (totalCarouselWidth / 2) + 400; 

  if (isRecording && nodes.length > 0) {
      recordingFrameCount++;

      // PHASE 1: Quick Start Pan (0-40 frames)
      if (recordingFrameCount <= 40) {
          let targetLeftPan = 300; 
          let progress = map(recordingFrameCount, 0, 40, 0, 1, true);
          progress = 1 - Math.pow(1 - progress, 3); 
          carouselScroll = lerp(0, targetLeftPan, progress);
      }

      // PHASE 2: Overlap Scroll (Start moving right at frame 40)
      if (recordingFrameCount > 40) {
          // Faster Scroll Speed
          carouselScroll -= 6; 
      }

      // Stop Condition
      if (carouselScroll < -scrollLimit) {
          stopVideoExport();
      }
  } else if (!isRecording && nodes.length > 0) {
      // Manual Control
      let mouseLimit = totalCarouselWidth / 2;
      let targetScroll = map(mouseX, 0, width, mouseLimit, -mouseLimit);
      carouselScroll = lerp(carouselScroll, targetScroll, 0.1);
  } else if (nodes.length === 0) {
      carouselScroll = 0;
  }

  // --- 4. DRAW IMAGES (FAST WAVE EFFECT) ---
  for (let i = 0; i < nodes.length; i++) {
      let n = nodes[i];
      push();
      translate(n.xOff + carouselScroll, 0, 0);
      
      if (isRecording) {
          // START WAVE MUCH SOONER: Frame 10 base delay
          if (recordingFrameCount > (10 + n.waveDelay)) {
              // Snappy pop up
              n.currentScale = lerp(n.currentScale, 1, 0.2); 
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

  // --- 5. VIDEO CAPTURE ---
  if (isRecording) {
      recorder.capture(document.querySelector('canvas'));
  }
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
          currentScale: 0,
          waveDelay: 0
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

// --- RECORDING LOGIC ---

function startVideoExport() {
    if (typeof CCapture === 'undefined') { alert("Loading video engine..."); return; }
    
    // 1. RESET STATE
    carouselScroll = 0; 
    recordingFrameCount = 0; 

    // 2. SETUP WAVE ANIMATION
    for(let i=0; i<nodes.length; i++) {
        nodes[i].currentScale = 0; 
        // FAST WAVE: Only 5 frames delay between images
        nodes[i].waveDelay = i * 5; 
    }

    // 3. START
    recorder = new CCapture({ format: 'webm', framerate: 30 });
    recorder.start();
    isRecording = true;
    
    recordBtn.html("Recording...");
    recordBtn.style('color', 'red');
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

// --- UI SETUP ---

function setupUI() {
  leftTextInput = createInput(leftText);
  leftTextInput.attribute('placeholder', 'Left Text');
  leftTextInput.input(() => { leftText = leftTextInput.value(); });

  rightTextInput = createInput(rightText);
  rightTextInput.attribute('placeholder', 'Right Text');
  rightTextInput.input(() => { rightText = rightTextInput.value(); });

  uploadInput = createFileInput(handleFileUpload);
  uploadInput.attribute('multiple', 'true'); 
  
  uploadInput.elt.onclick = () => {
      handleReset(); 
  };
  
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

// --- HELPERS ---

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
