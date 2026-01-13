// --- CONFIGURATION ---

let delayStart = 30; // Pause before animation starts
let isDarkMode = true; 
let itemPadding = 20; 

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

// --- ANIMATION TIMING ---

// 1. SEQUENCE DURATION (Forward Animation)
const SEQ_DURATION = 60; 

// 2. HOLD DURATION (Pause at full width)
const HOLD_DURATION = 30; 

// DOM Elements

let uploadInput, exportBtn, recordBtn, resetBtn, themeBtn; 
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
  background(isDarkMode ? 0 : 255); 
  
  camera(0, 0, camDist, 0, 0, 0, 0, 1, 0);

  // --- 1. DETERMINE TIME (t) ---
  let t = 0; 
  
  if (isRecording) {
      if (recordingFrameCount > delayStart) {
          let activeFrame = recordingFrameCount - delayStart;
          
          if (activeFrame <= SEQ_DURATION) {
              t = activeFrame; // Forward
          } else if (activeFrame <= SEQ_DURATION + HOLD_DURATION) {
              t = SEQ_DURATION; // Hold
          } else {
              // Reverse
              let timeSinceHold = activeFrame - (SEQ_DURATION + HOLD_DURATION);
              t = SEQ_DURATION - timeSinceHold;
              if (t < 0) t = 0; 
          }

          let totalDuration = (SEQ_DURATION * 2) + HOLD_DURATION;
          if (activeFrame > totalDuration + 60) {
              stopVideoExport();
          }
      } else {
          t = 0; // Delay phase
      }
  } else {
      t = SEQ_DURATION; // Manual Mode
  }

  // --- 2. MEASURE TEXT EXACTLY ---
  push();
  textSize(40); 
  textFont(fontSerif); let wl = textWidth(leftText);
  textFont(fontSans);  let wr = textWidth(rightText);
  pop();

  // --- 3. DYNAMIC CONTENT CALCULATIONS ---
  
  let currentDynamicWidth = 0;
  let nodeSizes = []; 

  // Calculate width of images at current moment
  for (let i = 0; i < nodes.length; i++) {
      let s = getImageScaleAtTime(t, i);
      let currentW = nodes[i].w * s;
      let currentPad = (i < nodes.length - 1) ? (itemPadding * s) : 0;
      
      nodeSizes.push({ s, currentW, currentPad });
      currentDynamicWidth += currentW + currentPad;
  }

  // Calculate dynamic gap
  let dynamicGap = 0;
  if (nodes.length > 0 && nodeSizes[0]) {
      dynamicGap = 20 * nodeSizes[0].s;
  }

  let halfWidth = (currentDynamicWidth / 2) + dynamicGap;

  // --- 4. CENTERING & DYNAMIC ZOOM LOGIC ---

  let leftEdge = -halfWidth - wl;
  let rightEdge = halfWidth + wr;
  let centerOffset = (leftEdge + rightEdge) / 2;

  let currentTotalWidth = wl + dynamicGap + currentDynamicWidth + dynamicGap + wr;
  let safeScreenWidth = width * 0.85; 
  
  let zoom = 1;
  if (currentTotalWidth > safeScreenWidth) {
      zoom = safeScreenWidth / currentTotalWidth;
  }

  scale(zoom);
  translate(-centerOffset, 0, 0);


  // --- 5. DRAW ELEMENTS ---
  
  let leftTextX = -halfWidth;
  let rightTextX = halfWidth;

  // Draw Text
  push();
  fill(isDarkMode ? 255 : 0); 
  textSize(40); 
  noStroke();
  
  textFont(fontSerif); 
  textAlign(RIGHT, CENTER);
  text(leftText, leftTextX, 0); 
  
  textFont(fontSans); 
  textAlign(LEFT, CENTER);
  text(rightText, rightTextX, 0);
  pop();

  // Draw Images
  if (nodes.length > 0) {
      let currentX = -(currentDynamicWidth / 2);

      for (let i = 0; i < nodes.length; i++) {
          let n = nodes[i];
          let data = nodeSizes[i];

          if (data.s > 0.001) {
              push();
              let drawX = currentX + (data.currentW / 2);
              
              translate(drawX, 0, 0); 
              scale(data.s); 
              
              texture(n.img);
              plane(n.w, n.h);
              pop();

              currentX += data.currentW + data.currentPad;
          }
      }
  }

  if (isRecording) {
      recordingFrameCount++;
      if (recorder) recorder.capture(document.querySelector('canvas'));
  }
}

// --- HELPER: ANIMATION ---

function getImageScaleAtTime(t, index) {
    let startFrame = 0 + (index * 2); 
    let duration = 25; 
    
    if (t < startFrame) return 0;
    if (t > startFrame + duration) return 1;
    
    let p = map(t, startFrame, startFrame + duration, 0, 1, true);
    return easeInOutQuint(p); 
}

function easeInOutQuint(x) {
    return x < 0.5 ? 16 * x * x * x * x * x : 1 - Math.pow(-2 * x + 2, 5) / 2;
}

// --- CORE FUNCTIONS (THE FIX FOR VARIETY) ---

function rebuildCarousel() {
  nodes = [];
  if (imgs.length === 0) {
      totalCarouselWidth = 0;
      return;
  }

  let currentTotalW = 0;
  
  // Define 3 Distinct Buckets to ensure contrast but allow variety
  // We include gaps between them (e.g. 280-320 is dead space) to ensure visual difference
  const buckets = [
      { id: 0, min: 150, max: 280 }, // Small
      { id: 1, min: 320, max: 440 }, // Medium
      { id: 2, min: 480, max: 620 }  // Large
  ];

  let lastBucketId = -1; // Track the previous bucket

  let sizingData = imgs.map((img, index) => {
      
      // If height hasn't been assigned yet, assign it now
      if (!img.randomH) {
          
          // 1. Filter out the bucket we just used
          let availableBuckets = buckets.filter(b => b.id !== lastBucketId);
          
          // 2. Pick a random bucket from the remaining valid ones
          let selectedBucket = random(availableBuckets);
          
          // 3. Pick a random height within that bucket
          img.randomH = random(selectedBucket.min, selectedBucket.max);
          
          // 4. Update memory for the next iteration
          // We store the bucket ID on the image object so it persists if we re-run this function
          img.bucketId = selectedBucket.id;
      }
      
      // If we are rebuilding but the image already has data, update our 'lastBucketId' tracker
      // so the NEXT new image (if added) respects the sequence
      if (img.bucketId !== undefined) {
          lastBucketId = img.bucketId;
      }

      let h = img.randomH;
      let ratio = img.width / img.height;
      let w = h * ratio;
      currentTotalW += w;
      return { img, w, h };
  });

  if (sizingData.length > 0) {
      currentTotalW += (sizingData.length - 1) * itemPadding; 
  }
  
  totalCarouselWidth = currentTotalW;
  
  nodes = sizingData.map((d) => {
      return { 
          img: d.img, 
          w: d.w,
          h: d.h
      };
  });
}

function handleFileUpload(file) {
  if (file.type === 'image') {
    loadImage(file.data, (loadedImg) => {
      let roundedImg = makeRounded(loadedImg, 20);
      imgs.push(roundedImg);
      rebuildCarousel();
      uploadCounter++;
    });
  }
}

function handleReset() {
  imgs = [];
  nodes = [];
  totalCarouselWidth = 0;
}

function handleExport() {
  save("layout_export.png");
}

function startVideoExport() {
    if (nodes.length === 0) {
        alert("⚠️ Please upload images first!");
        return; 
    }
    if (typeof CCapture === 'undefined') { 
        alert("Video engine loading..."); 
        return; 
    }
    recordingFrameCount = 0; 
    isRecording = true;

    try {
        recorder = new CCapture({ format: 'webm', framerate: 30 });
        recorder.start();
        recordBtn.html("Recording...");
        recordBtn.style('color', 'red');
    } catch(e) {
        isRecording = false;
        alert("Recording failed to start.");
    }
}

function stopVideoExport() {
    if(recorder) {
        recorder.stop(); 
        recorder.save();
        isRecording = false; 
        recordBtn.html("Save Video");
        updateThemeStyling();
    }
}

function handleVideoToggle() {
    if (isRecording) stopVideoExport(); else startVideoExport();
}

function toggleTheme() {
    isDarkMode = !isDarkMode;
    updateThemeStyling();
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
  uploadInput.elt.onclick = () => { handleReset(); };
  
  exportBtn = createButton('Save Image');
  exportBtn.mousePressed(handleExport);
  
  recordBtn = createButton('Save Video');
  recordBtn.mousePressed(handleVideoToggle); 
  
  resetBtn = createButton('Reset');
  resetBtn.mousePressed(handleReset); 
  
  themeBtn = createButton('Light');
  themeBtn.mousePressed(toggleTheme);
  
  styleUIElement(uploadInput);
  styleUIElement(exportBtn); 
  styleUIElement(resetBtn);
  styleUIElement(recordBtn);
  styleUIElement(themeBtn);
  styleUIElement(leftTextInput); 
  styleUIElement(rightTextInput);
  
  leftTextInput.style('width', '140px');
  rightTextInput.style('width', '140px');

  updateThemeStyling(); 
  positionUI();
}

function updateThemeStyling() {
    let txtCol = isDarkMode ? '#fff' : '#000';
    let bordCol = isDarkMode ? '#555' : '#aaa';
    let els = [uploadInput, exportBtn, recordBtn, resetBtn, themeBtn, leftTextInput, rightTextInput];
    
    for(let e of els) {
        e.style('color', txtCol);
        e.style('border', '1px solid ' + bordCol);
    }
    if (themeBtn) themeBtn.html(isDarkMode ? "Light" : "Dark");
    if(isRecording) recordBtn.style('color', 'red');
}

function positionUI() {
  let yPos = height - 40; 
  leftTextInput.position(20, yPos);
  rightTextInput.position(180, yPos);
  let rightMargin = width - 20;
  themeBtn.position(rightMargin - 60, yPos);
  resetBtn.position(rightMargin - 120, yPos);
  recordBtn.position(rightMargin - 210, yPos);
  exportBtn.position(rightMargin - 300, yPos);
  uploadInput.position(rightMargin - 500, yPos);
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
