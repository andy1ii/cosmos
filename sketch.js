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
let recordingDuration = 300; 
let recordingStartFrame = 0;

// DOM Elements
let uploadInput, exportBtn, recordBtn, resetBtn;
let leftTextInput, rightTextInput; 

// --- PRELOAD FONTS ---
function preload() {
  fontSans = loadFont('resources/FTRegolaNeueTrial-Semibold.otf');
  fontSerif = loadFont('resources/ItemsTextTrial-Book.otf');
}

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  noStroke();
  textureMode(NORMAL); 
  
  // --- Load CCapture for Video ---
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
  
  // 1. Camera Setup
  camera(0, 0, camDist, 0, 0, 0, 0, 1, 0);

  // --- 2. TEXT SPACING LOGIC ---
  let textPadding = nodes.length > 0 ? 40 : 0; 
  let textGap = (totalCarouselWidth / 2) + textPadding; 

  // 3. Draw Text "Bookends"
  push();
  fill(255);
  textSize(40); 
  noStroke();
  
  // Calculate text widths for accurate centering
  textFont(fontSerif);
  let wLeft = textWidth(leftText);
  textFont(fontSans);
  let wRight = textWidth(rightText);
  let totalTextW = wLeft + wRight;

  if (nodes.length === 0) {
      // --- CENTERED MODE (Start Screen) ---
      let startX = -totalTextW / 2;

      textFont(fontSerif); 
      textAlign(LEFT, CENTER);
      text(leftText, startX, 0); 
      
      textFont(fontSans);
      textAlign(LEFT, CENTER);
      text(rightText, startX + wLeft, 0);

  } else {
      // --- SPLIT MODE (Carousel Active) ---
      
      // LEFT TEXT (Serif)
      textFont(fontSerif); 
      textAlign(RIGHT, CENTER);
      text(leftText, -textGap + carouselScroll, 0); 
      
      // RIGHT TEXT (Sans)
      textFont(fontSans);
      textAlign(LEFT, CENTER);
      text(rightText, textGap + carouselScroll, 0);
  }
  pop();

  // 4. Scroll Interaction
  if (!isRecording && nodes.length > 0) {
      let scrollLimit = totalCarouselWidth / 2;
      let targetScroll = map(mouseX, 0, width, scrollLimit, -scrollLimit);
      carouselScroll = lerp(carouselScroll, targetScroll, 0.1);
  } else if (nodes.length === 0) {
      carouselScroll = 0;
  }

  // 5. Draw Images (ALWAYS FLAT)
  for (let n of nodes) {
      push();
      translate(n.xOff + carouselScroll, 0, 0);
      // REMOVED rotateY here. Images will stay flat facing front.
      
      n.targetScale = lerp(n.targetScale, 1, 0.1);
      scale(n.targetScale);
      
      texture(n.img);
      plane(n.w, n.h);
      pop();
  }

  // 6. Video Capture
  if (isRecording) {
      recorder.capture(document.querySelector('canvas'));
      if (frameCount - recordingStartFrame > recordingDuration) stopVideoExport();
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

  // 1. First Pass: Calculate total width
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

  // 2. Second Pass: Positions
  let startX = -totalCarouselWidth / 2;

  nodes = sizingData.map(d => {
      let centerX = startX + (d.w / 2);
      let node = { 
          img: d.img, 
          xOff: centerX, 
          w: d.w,
          h: d.h,
          targetScale: 1 
      };
      startX += d.w + padding;
      return node;
  });
}

// --- FILE HANDLING ---

function handleFileUpload(file) {
  if (file.type === 'image') {
    loadImage(file.data, (loadedImg) => {
      let roundedImg = makeRounded(loadedImg, 20);
      roundedImg.randomH = random(250, 450);
      
      imgs.push(roundedImg);
      rebuildCarousel();
      
      if (nodes.length > 0) {
        nodes[nodes.length - 1].targetScale = 0.1;
      }
      
      uploadCounter++;
    });
  }
}

// --- RESET FUNCTION ---
function handleReset() {
  imgs = [];
  nodes = [];
  carouselScroll = 0;
  totalCarouselWidth = 0;
}

// --- EXPORT FUNCTIONS ---

function handleExport() {
  save("layout_export.png");
}

function startVideoExport() {
    if (typeof CCapture === 'undefined') { alert("Loading video engine..."); return; }
    
    recorder = new CCapture({ format: 'webm', framerate: 30 });
    recorder.start();
    isRecording = true;
    recordingStartFrame = frameCount;
    
    recordBtn.html("Stop");
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
  
  // Click handler to clear images on new upload
  uploadInput.elt.onclick = () => {
      imgs = [];
      nodes = [];
      carouselScroll = 0;
      totalCarouselWidth = 0;
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

// --- UI POSITIONING ---
function positionUI() {
  let yPos = height - 40; 

  // 1. Text Inputs ALIGNED LEFT
  leftTextInput.position(20, yPos);
  rightTextInput.position(180, yPos);

  // 2. Buttons ALIGNED RIGHT
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
