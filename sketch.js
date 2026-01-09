let delayStart = 30;
let isDarkMode = true;
let itemPadding = 20;

let fontSans, fontSerif;
let leftText = "Coffee Houses ";
let rightText = "curated by @DAVIDSMITH";

let imgs = [];
let nodes = [];
let totalCarouselWidth = 0;
let uploadCounter = 0;

let camDist = 800;

let isRecording = false;
let recorder;
let recordingFrameCount = 0;

const SEQ_DURATION = 60;
const HOLD_DURATION = 30;

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

  let t = 0;

  if (isRecording) {
      if (recordingFrameCount > delayStart) {
          let activeFrame = recordingFrameCount - delayStart;

          if (activeFrame <= SEQ_DURATION) {
              t = activeFrame;
          } else if (activeFrame <= SEQ_DURATION + HOLD_DURATION) {
              t = SEQ_DURATION;
          } else {
              let timeSinceHold = activeFrame - (SEQ_DURATION + HOLD_DURATION);
              t = SEQ_DURATION - timeSinceHold;
              if (t < 0) t = 0;
          }

          let totalDuration = (SEQ_DURATION * 2) + HOLD_DURATION;
          if (activeFrame > totalDuration + 60) {
              stopVideoExport();
          }
      } else {
          t = 0;
      }
  } else {
      t = SEQ_DURATION;
  }

  push();
  textSize(40);
  textFont(fontSerif); let wl = textWidth(leftText);
  textFont(fontSans);  let wr = textWidth(rightText);
  pop();

  let currentDynamicWidth = 0;
  let nodeSizes = [];

  for (let i = 0; i < nodes.length; i++) {
      let s = getImageScaleAtTime(t, i);
      let currentW = nodes[i].w * s;
      let currentPad = (i < nodes.length - 1) ? (itemPadding * s) : 0;

      nodeSizes.push({ s, currentW, currentPad });
      currentDynamicWidth += currentW + currentPad;
  }

  let dynamicGap = 0;
  if (nodes.length > 0 && nodeSizes[0]) {
      dynamicGap = 20 * nodeSizes[0].s;
  }

  let halfWidth = (currentDynamicWidth / 2) + dynamicGap;

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

  let leftTextX = -halfWidth;
  let rightTextX = halfWidth;

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

function rebuildCarousel() {
  nodes = [];
  if (imgs.length === 0) {
      totalCarouselWidth = 0;
      return;
  }

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
