// --- CONFIGURATION ---
let carouselScroll = 0;       
let flipState = 0;            // 0 = Images visible, 1 = Images Hidden
let currentFlipAngle = 0;     

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
let prevMouseX, prevMouseY;
let isDragging = false;

// Video/Export State
let isRecording = false;
let recorder;
let recordingDuration = 300; 
let recordingStartFrame = 0;

// DOM Elements
let uploadInput, exportBtn, recordBtn, resetBtn;
let leftTextInput, rightTextInput; 
let isUIVisible = true;

// --- PRELOAD FONTS ---
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
  
  // 1. Calculate Flip Animation
  let targetAngle = flipState === 1 ? HALF_PI : 0;
  currentFlipAngle = lerp(currentFlipAngle, targetAngle, 0.08);

  // 2. Camera Setup
  camera(0, 0, camDist, 0, 0, 0, 0, 1, 0);

  // --- 3. TEXT SPACING LOGIC ---
  let textPadding = nodes.length > 0 ? 40 : 0; 
  let textGap = (totalCarouselWidth / 2) + textPadding; 

  // 4. Draw Text "Bookends"
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

  // 5. Scroll Interaction
  if (!isRecording && nodes.length > 0) {
      let scrollLimit = totalCarouselWidth / 2;
      let targetScroll = map(mouseX, 0, width, scrollLimit, -scrollLimit);
      carouselScroll = lerp(carouselScroll, targetScroll, 0.1);
  } else if (nodes.length === 0) {
      carouselScroll = 0;
  }

  // 6. Draw Images
  for (let n of nodes) {
      push();
      translate(n.xOff + carouselScroll, 0, 0);
      rotateY(currentFlipAngle);
      
      n.targetScale = lerp(n.targetScale, 1, 0.1);
      scale(n.targetScale);
      
      texture(n.img);
      plane(n.w, n.h);
      pop();
  }

  // 7. Video Capture
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
      
      // Assign random height
      roundedImg.randomH = random(250, 450);
      
      // Add to array (The array is cleared via onClick before this runs)
      imgs.push(roundedImg);
      rebuildCarousel();
      
      // Pop animation
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
  
  // *** KEY CHANGE: Clear images when user CLICKS the upload button ***
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

function positionUI() {
  let yRowText = height - 80; 
  let yRowControls = height - 40; 

  leftTextInput.position(20, yRowText);
  rightTextInput.position(180, yRowText);

  uploadInput.position(20, yRowControls);
  exportBtn.position(220, yRowControls);
  recordBtn.position(310, yRowControls); 
  resetBtn.position(400, yRowControls);  
}

function toggleUI(visible) {
    let d = visible ? 'block' : 'none';
    uploadInput.style('display', d);
    exportBtn.style('display', d); resetBtn.style('display', d);
    recordBtn.style('display', d);
    leftTextInput.style('display', d); rightTextInput.style('display', d);
}

function keyPressed() {
  if (key === 'h' || key === 'H') {
      isUIVisible = !isUIVisible;
      toggleUI(isUIVisible);
  }
}

function mousePressed() {
  if (mouseY > height - 100) return; 
  flipState = (flipState === 0) ? 1 : 0; 
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
