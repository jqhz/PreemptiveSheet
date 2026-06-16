// Canvas Setup
const mainCanvas = document.getElementById("mainCanvas");
const ctx = mainCanvas.getContext("2d");

const wallpaperCanvas = document.getElementById("wallpaperCanvas");
const wpCtx = wallpaperCanvas.getContext("2d");
const appRoot = document.querySelector(".app");

const VISUAL_ONLY_MODE = false;

const wallpaperEditor = document.getElementById("wallpaperEditor");
const toggleBtn = document.getElementById("toggleWallpaperBtn");
const bgColorInput = document.getElementById("bgColor");
const bgBorderRadiusInput = document.getElementById("bgBorderRadius");
const outlineColorInput = document.getElementById("outlineColor");
const outlineWidthInput = document.getElementById("outlineWidth");
const pieOutlineColorInput = document.getElementById("pieOutlineColor");
const pieOutlineWidthInput = document.getElementById("pieOutlineWidth");
const textSizeInput = document.getElementById("textSize");
const textOutlineWidthInput = document.getElementById("textOutlineWidth");
const showOrangeCheckbox = document.getElementById("showOrange");
const showPinkCheckbox = document.getElementById("showPink");
const showGreenCheckbox = document.getElementById("showGreen");
const PIE_POSITIONS = [
  [340, 130],
  [730, 130],
  [340, 380],
  [730, 380]
];
const PIE_RADIUS = 100;

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clampNumberInputToBounds(inputEl) {
  if (!inputEl || inputEl.type !== "number" || inputEl.value === "") return;

  const current = toNumber(inputEl.value, NaN);
  if (!Number.isFinite(current)) return;

  const min = inputEl.min === "" ? -Infinity : toNumber(inputEl.min, -Infinity);
  const max = inputEl.max === "" ? Infinity : toNumber(inputEl.max, Infinity);
  const clamped = clamp(current, min, max);

  if (clamped === current) return;

  const step = inputEl.step;
  const hasFixedDecimals = step && step !== "any" && step.includes(".");
  const decimals = hasFixedDecimals ? step.split(".")[1].length : null;
  inputEl.value = decimals !== null ? clamped.toFixed(decimals) : String(clamped);
}

function clampTextSizeInput() {
  const clamped = clamp(toNumber(textSizeInput.value, 60), 20, 60);
  if (toNumber(textSizeInput.value, 60) !== clamped || textSizeInput.value === "") {
    textSizeInput.value = String(clamped);
  }
}

function setupCustomNumberSteppers() {
  const numberInputs = document.querySelectorAll('input[type="number"]');

  numberInputs.forEach(inputEl => {
    if (inputEl.parentElement && inputEl.parentElement.classList.contains("num-wrap")) return;

    const wrap = document.createElement("span");
    wrap.className = "num-wrap";
    inputEl.parentNode.insertBefore(wrap, inputEl);
    wrap.appendChild(inputEl);

    const createStep = (label, direction) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "num-step";
      btn.textContent = label;

      let holdTimeout = null;
      let holdInterval = null;

      const runStep = () => {
        try {
          if (direction > 0) {
            inputEl.stepUp(1);
          } else {
            inputEl.stepDown(1);
          }
        } catch {
          const step = toNumber(inputEl.step, 1);
          const min = inputEl.min === "" ? -Infinity : toNumber(inputEl.min);
          const max = inputEl.max === "" ? Infinity : toNumber(inputEl.max);
          const decimals = String(step).includes(".") ? String(step).split(".")[1].length : 0;
          const current = toNumber(inputEl.value, min === -Infinity ? 0 : min);
          const next = clamp(current + direction * step, min, max);
          inputEl.value = decimals > 0 ? next.toFixed(decimals) : String(Math.round(next));
        }
        inputEl.dispatchEvent(new Event("input", { bubbles: true }));
        inputEl.dispatchEvent(new Event("change", { bubbles: true }));
      };

      const stopHold = () => {
        if (holdTimeout) {
          clearTimeout(holdTimeout);
          holdTimeout = null;
        }
        if (holdInterval) {
          clearInterval(holdInterval);
          holdInterval = null;
        }
      };

      const startHold = () => {
        runStep();
        holdTimeout = setTimeout(() => {
          holdInterval = setInterval(runStep, 55);
        }, 260);
      };

      btn.addEventListener("click", e => e.preventDefault());
      btn.addEventListener("pointerdown", e => {
        e.preventDefault();
        btn.setPointerCapture(e.pointerId);
        startHold();
      });
      btn.addEventListener("pointerup", stopHold);
      btn.addEventListener("pointercancel", stopHold);
      btn.addEventListener("pointerleave", stopHold);
      btn.addEventListener("lostpointercapture", stopHold);

      return btn;
    };

    wrap.appendChild(createStep("▲", 1));
    wrap.appendChild(createStep("▼", -1));
  });
}

function roundedRectPath(ctxEl, x, y, width, height, radius) {
  const safeRadius = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
  ctxEl.beginPath();
  ctxEl.moveTo(x + safeRadius, y);
  ctxEl.lineTo(x + width - safeRadius, y);
  ctxEl.arcTo(x + width, y, x + width, y + safeRadius, safeRadius);
  ctxEl.lineTo(x + width, y + height - safeRadius);
  ctxEl.arcTo(x + width, y + height, x + width - safeRadius, y + height, safeRadius);
  ctxEl.lineTo(x + safeRadius, y + height);
  ctxEl.arcTo(x, y + height, x, y + height - safeRadius, safeRadius);
  ctxEl.lineTo(x, y + safeRadius);
  ctxEl.arcTo(x, y, x + safeRadius, y, safeRadius);
  ctxEl.closePath();
}

// Template image
const templateImage = new Image();
templateImage.src = "images/template.png";

// Wait for fonts and template
Promise.all([new Promise(res => templateImage.onload = res), document.fonts.ready])
  .then(() => draw())
  .catch(() => draw());

// Background toggle
const showBgCheckbox = document.getElementById("showBackground");
const bgSettings = document.getElementById("backgroundSettings");

function toggleBackgroundSettings() {
  bgSettings.style.display = showBgCheckbox.checked ? "block" : "none";
  draw();
}
showBgCheckbox.addEventListener("change", toggleBackgroundSettings);
showBgCheckbox.addEventListener("change", drawWallpaper);
toggleBackgroundSettings();

// --- CHEAT SHEET DRAW FUNCTIONS ---
function draw(customCanvas = null, customCtx = null) {
  const canvasEl = customCanvas || mainCanvas;
  const ctxEl = customCtx || ctx;
  ctxEl.clearRect(0, 0, canvasEl.width, canvasEl.height);

  if (showBgCheckbox.checked) {
    const bgColor = bgColorInput.value;
    const bgRadius = toNumber(bgBorderRadiusInput.value);
    const outlineColor = outlineColorInput.value;
    const outlineWidth = toNumber(outlineWidthInput.value);

    ctxEl.fillStyle = bgColor;
    if (bgRadius > 0) {
      roundedRectPath(ctxEl, 0, 0, canvasEl.width, canvasEl.height, bgRadius);
      ctxEl.fill();
    } else {
      ctxEl.fillRect(0, 0, canvasEl.width, canvasEl.height);
    }

    if (outlineWidth > 0) {
      ctxEl.strokeStyle = outlineColor;
      ctxEl.lineWidth = outlineWidth;
      if (bgRadius > 0) {
        roundedRectPath(ctxEl, 0, 0, canvasEl.width, canvasEl.height, bgRadius);
        ctxEl.stroke();
      } else {
        ctxEl.strokeRect(0, 0, canvasEl.width, canvasEl.height);
      }
    }
  }

  ctxEl.drawImage(templateImage, 0, 0, canvasEl.width, canvasEl.height);

  const pieOutlineColor = pieOutlineColorInput.value;
  const pieOutlineWidth = toNumber(pieOutlineWidthInput.value);

  for (let i = 0; i < 4; i++) {
    drawPie(ctxEl, PIE_POSITIONS[i][0], PIE_POSITIONS[i][1], PIE_RADIUS, pieOutlineColor, pieOutlineWidth, i);
  }
}

function drawPie(ctxEl, x, y, radius, outlineColor, outlineWidth, index) {
  const showOrange = showOrangeCheckbox.checked;
  const showPink = showPinkCheckbox.checked;
  const showGreen = showGreenCheckbox.checked;

  const orangeInput = document.getElementById(`orange_${index}`);
  const greenInput = document.getElementById(`green_${index}`);

  let orange = Math.max(0, Math.min(100, toNumber(orangeInput.value)));
  let green = Math.max(0, Math.min(100, toNumber(greenInput.value)));

  if (orange + green > 100) {
    if (document.activeElement === orangeInput) {
      green = 100 - orange;
      greenInput.value = green;
    } else {
      orange = 100 - green;
      orangeInput.value = orange;
    }
  }

  const pink = 100 - (orange + green);

  const slices = [
    { value: orange, color: "#e76f51" },
    { value: pink, color: "#d84bbf" },
    { value: green, color: "#4cc96c" }
  ];

  const pieSlices = [...slices].sort((a, b) => b.value - a.value);
  let startAngle = -Math.PI / 2;

  pieSlices.forEach(slice => {
    if (slice.value <= 0) return;
    const sliceAngle = (slice.value / 100) * 2 * Math.PI;
    ctxEl.beginPath();
    ctxEl.moveTo(x, y);
    ctxEl.arc(x, y, radius, startAngle, startAngle + sliceAngle);
    ctxEl.closePath();
    ctxEl.fillStyle = slice.color;
    ctxEl.fill();
    if (outlineWidth > 0) {
      ctxEl.strokeStyle = outlineColor;
      ctxEl.lineWidth = outlineWidth;
      ctxEl.stroke();
    }
    startAngle += sliceAngle;
  });

  if (outlineWidth > 0) {
    ctxEl.beginPath();
    ctxEl.arc(x, y, radius, 0, 2 * Math.PI);
    ctxEl.strokeStyle = outlineColor;
    ctxEl.lineWidth = outlineWidth;
    ctxEl.stroke();
  }

  drawStackedText(ctxEl, x, y, radius, [
    { value: orange, color: "#f3a94e", show: showOrange },
    { value: pink, color: "#e88cff", show: showPink },
    { value: green, color: "#45cc65", show: showGreen }
  ]);
}

function drawStackedText(ctxEl, x, y, radius, slices) {
  const textSize = toNumber(textSizeInput.value);
  const textOutlineWidth = toNumber(textOutlineWidthInput.value);

  const visibleSlices = slices.filter(s => s.show && s.value > 0);
  if (!visibleSlices.length) return;

  const lineGap = 4;
  ctxEl.font = `bold ${textSize}px Minecraft`;
  ctxEl.textAlign = "center";
  ctxEl.textBaseline = "alphabetic";

  // Use actual glyph bounds so vertical centering stays correct for 1/2/3 lines.
  const lines = visibleSlices.map(slice => {
    const text = String(slice.value);
    const metrics = ctxEl.measureText(text);
    const ascent = metrics.actualBoundingBoxAscent || textSize * 0.8;
    const descent = metrics.actualBoundingBoxDescent || textSize * 0.2;
    return {
      ...slice,
      text,
      ascent,
      descent,
      height: ascent + descent
    };
  });

  const totalHeight = lines.reduce((sum, line) => sum + line.height, 0) + (lines.length - 1) * lineGap;
  let top = y - totalHeight / 2;

  lines.forEach(line => {
    const baselineY = top + line.ascent;
    if (textOutlineWidth > 0) {
      ctxEl.lineWidth = textOutlineWidth;
      ctxEl.strokeStyle = "#000000";
      ctxEl.strokeText(line.text, x + radius * 0.45, baselineY);
    }
    ctxEl.fillStyle = line.color;
    ctxEl.fillText(line.text, x + radius * 0.45, baselineY);
    top += line.height + lineGap;
  });
}

// --- WALLPAPER EDITOR ---
let offsetX = 200;
let offsetY = 200;
let scale = 1;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;

const wpX = document.getElementById('wpX');
const wpY = document.getElementById('wpY');
const wpScale = document.getElementById('wpScale');
const wpBgColor = document.getElementById('wpBgColor');
const wpBgType = document.getElementById('wpBgType');
const wpColorControls = document.getElementById('wpColorControls');
const wpGradientControls = document.getElementById('wpGradientControls');
const wpGradientColor1 = document.getElementById('wpGradientColor1');
const wpGradientColor2 = document.getElementById('wpGradientColor2');
const wpGradientRotation = document.getElementById('wpGradientRotation');
const wpGradientOffset = document.getElementById('wpGradientOffset');
const wpFade = document.getElementById('wpFade');
const wpImageControls = document.getElementById('wpImageControls');
const wpBgImageInput = document.getElementById('wpBgImageInput');
const wpThinPreview = document.getElementById('wpThinPreview');
let wallpaperBgImage = null;
const thinPreviewImage = new Image();
thinPreviewImage.src = "images/thin_screenshot.png";
thinPreviewImage.onload = () => {
  if (wpThinPreview && wpThinPreview.checked) drawWallpaper();
};
const MIN_SCALE = 0.1;
const MAX_SCALE = 5;

// Draw wallpaper function
function drawWallpaper(includeThinPreview = true) {
  wpCtx.clearRect(0, 0, wallpaperCanvas.width, wallpaperCanvas.height);

  if (wpBgType.value === 'color') {
    wpCtx.fillStyle = wpBgColor.value;
    wpCtx.fillRect(0, 0, wallpaperCanvas.width, wallpaperCanvas.height);
  } else if (wpBgType.value === 'gradient') {
    const angleRad = toNumber(wpGradientRotation.value) * Math.PI / 180;
    const x2 = wallpaperCanvas.width * Math.cos(angleRad);
    const y2 = wallpaperCanvas.height * Math.sin(angleRad);

    const grad = wpCtx.createLinearGradient(0, 0, x2, y2);

    // --- NEW: calculate offset & softness ---
    const offset = toNumber(wpGradientOffset.value);   // -1 to 1
    const softness = toNumber(wpFade.value);           // 0 to 1

    // map offset to 0-1 range
    const middle = 0.5 + offset / 2; // 0.5 is center

    // apply softness to create two stops around middle
    const stop1 = Math.max(0, middle - softness / 2);
    const stop2 = Math.min(1, middle + softness / 2);

    const color1 = wpGradientColor1.value;
    const color2 = wpGradientColor2.value;

    grad.addColorStop(0, color1);     // start
    grad.addColorStop(stop1, color1); // hold first color until softened middle
    grad.addColorStop(stop2, color2); // transition to second color
    grad.addColorStop(1, color2);     // end

    wpCtx.fillStyle = grad;
    wpCtx.fillRect(0, 0, wallpaperCanvas.width, wallpaperCanvas.height);
  } else if (wpBgType.value === 'image') {
    if (wallpaperBgImage && wallpaperBgImage.complete) {
      const imgScale = Math.max(
        wallpaperCanvas.width / wallpaperBgImage.width,
        wallpaperCanvas.height / wallpaperBgImage.height
      );
      const drawWidth = wallpaperBgImage.width * imgScale;
      const drawHeight = wallpaperBgImage.height * imgScale;
      const drawX = (wallpaperCanvas.width - drawWidth) / 2;
      const drawY = (wallpaperCanvas.height - drawHeight) / 2;
      wpCtx.drawImage(wallpaperBgImage, drawX, drawY, drawWidth, drawHeight);
    } else {
      wpCtx.fillStyle = wpBgColor.value;
      wpCtx.fillRect(0, 0, wallpaperCanvas.width, wallpaperCanvas.height);
    }
  }

  // Draw cheat sheet
  wpCtx.save();
  wpCtx.translate(offsetX, offsetY);
  wpCtx.scale(scale, scale);
  wpCtx.drawImage(mainCanvas, 0, 0);
  wpCtx.restore();

  if (
    includeThinPreview &&
    wpThinPreview &&
    wpThinPreview.checked &&
    thinPreviewImage.complete &&
    thinPreviewImage.naturalWidth > 0 &&
    thinPreviewImage.naturalHeight > 0
  ) {
    const maxWidth = wallpaperCanvas.width * 0.92;
    const maxHeight = wallpaperCanvas.height * 0.92;
    const overlayScale = Math.min(
      1,
      maxWidth / thinPreviewImage.naturalWidth,
      maxHeight / thinPreviewImage.naturalHeight
    );
    const overlayWidth = thinPreviewImage.naturalWidth * overlayScale;
    const overlayHeight = thinPreviewImage.naturalHeight * overlayScale;
    const overlayX = (wallpaperCanvas.width - overlayWidth) / 2;
    const overlayY = (wallpaperCanvas.height - overlayHeight) / 2;
    wpCtx.drawImage(thinPreviewImage, overlayX, overlayY, overlayWidth, overlayHeight);
  }

  // Sync number inputs
  wpX.value = Math.round(offsetX);
  wpY.value = Math.round(offsetY);
  wpScale.value = parseFloat(scale.toFixed(2));
}

// Initialize wallpaper editor
updateWallpaperBgControls();
drawWallpaper();

// --- Helpers ---
function updateWallpaperBgControls() {
  if (!wpBgType) return;
  wpColorControls.style.display = wpBgType.value === 'color' ? 'flex' : 'none';
  wpGradientControls.style.display = wpBgType.value === 'gradient' ? 'flex' : 'none';
  wpImageControls.style.display = wpBgType.value === 'image' ? 'flex' : 'none';
}

function redrawAll() {
  clampTextSizeInput();
  draw();
  drawWallpaper();
}

// Resize dropdown
function resizeWpBgType() {
  const temp = document.createElement('span');
  temp.style.visibility = 'hidden';
  temp.style.whiteSpace = 'pre';
  temp.style.font = window.getComputedStyle(wpBgType).font;
  temp.textContent = wpBgType.options[wpBgType.selectedIndex].text;
  document.body.appendChild(temp);
  wpBgType.style.width = Math.max(temp.getBoundingClientRect().width + 40, 210) + 'px';
  document.body.removeChild(temp);
}
resizeWpBgType();
wpBgType.addEventListener('change', () => {
  updateWallpaperBgControls();
  resizeWpBgType();
  drawWallpaper();
});

if (wpBgImageInput) {
  wpBgImageInput.addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    if (!file) {
      wallpaperBgImage = null;
      drawWallpaper();
      return;
    }

    if (!file.type.startsWith('image/')) {
      wallpaperBgImage = null;
      drawWallpaper();
      return;
    }

    const reader = new FileReader();
    reader.onload = loadEvent => {
      const img = new Image();
      img.onload = () => {
        wallpaperBgImage = img;
        drawWallpaper();
      };
      img.onerror = () => {
        wallpaperBgImage = null;
        drawWallpaper();
      };
      img.src = loadEvent.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// Toggle wallpaper editor
let isWallpaperVisible = false;
function toggleWallpaper() {
  isWallpaperVisible = !isWallpaperVisible;
  wallpaperEditor.classList.toggle('is-open', isWallpaperVisible);
  toggleBtn.textContent = isWallpaperVisible ? 'Remove Wallpaper' : 'Add Wallpaper';
  if (isWallpaperVisible) drawWallpaper();
}
toggleBtn.addEventListener('click', toggleWallpaper);

// Wallpaper dragging & zoom
function getMousePos(e) {
  const rect = wallpaperCanvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (wallpaperCanvas.width / rect.width),
    y: (e.clientY - rect.top) * (wallpaperCanvas.height / rect.height)
  };
}

wallpaperCanvas.addEventListener('mousedown', e => {
  isDragging = true;
  const pos = getMousePos(e);
  dragStartX = pos.x - offsetX;
  dragStartY = pos.y - offsetY;
});
wallpaperCanvas.addEventListener('mousemove', e => {
  if (!isDragging) return;
  const pos = getMousePos(e);
  offsetX = pos.x - dragStartX;
  offsetY = pos.y - dragStartY;
  drawWallpaper();
});
wallpaperCanvas.addEventListener('mouseup', () => isDragging = false);
wallpaperCanvas.addEventListener('mouseleave', () => isDragging = false);
wallpaperCanvas.addEventListener('wheel', e => {
  e.preventDefault();
  scale += e.deltaY * -0.001;
  scale = Math.min(Math.max(MIN_SCALE, scale), MAX_SCALE);
  drawWallpaper();
});

// Number input events
[wpX, wpY, wpScale].forEach(el => {
  if (!el) return;
  el.addEventListener('input', () => {
    offsetX = toNumber(wpX.value, offsetX);
    offsetY = toNumber(wpY.value, offsetY);
    scale = Math.min(Math.max(MIN_SCALE, toNumber(wpScale.value, scale)), MAX_SCALE);
    drawWallpaper();
  });
});

// Input events to redraw main canvas & wallpaper
[
  "bgColor", "bgBorderRadius", "outlineColor", "outlineWidth",
  "pieOutlineColor", "pieOutlineWidth",
  "textSize", "textOutlineWidth"
].forEach(id => document.getElementById(id).addEventListener("input", redrawAll));
textSizeInput.addEventListener("blur", clampTextSizeInput);

["showOrange", "showPink", "showGreen"].forEach(id =>
  document.getElementById(id).addEventListener("change", redrawAll)
);

for (let i = 0; i < 4; i++) {
  document.getElementById(`orange_${i}`).addEventListener("input", redrawAll);
  document.getElementById(`green_${i}`).addEventListener("input", redrawAll);
}

[
  wpBgColor,
  wpGradientColor1,
  wpGradientColor2,
  wpGradientRotation,
  wpGradientOffset,
  wpFade
].forEach(el => {
  if (!el) return;
  el.addEventListener('input', drawWallpaper);
});

if (wpThinPreview) {
  wpThinPreview.addEventListener('change', drawWallpaper);
}

// Download functions
function download() {
  const link = document.createElement("a");
  link.download = "cheatsheet.png";
  link.href = mainCanvas.toDataURL();
  link.click();
}
function downloadWallpaper() {
  const showThinPreview = Boolean(wpThinPreview && wpThinPreview.checked);
  if (showThinPreview) {
    drawWallpaper(false);
  }
  const link = document.createElement("a");
  link.download = "wallpaper.png";
  link.href = wallpaperCanvas.toDataURL();
  link.click();
  if (showThinPreview) {
    drawWallpaper(true);
  }
}

document.addEventListener("input", e => {
  const target = e.target;
  if (target instanceof HTMLInputElement && target.type === "number") {
    clampNumberInputToBounds(target);
  }
}, true);

document.addEventListener("blur", e => {
  const target = e.target;
  if (target instanceof HTMLInputElement && target.type === "number") {
    clampNumberInputToBounds(target);
  }
}, true);

if (VISUAL_ONLY_MODE && appRoot) {
  appRoot.classList.add("is-visual-only");
  appRoot.setAttribute("aria-disabled", "true");
  // `inert` disables focus and all user interactions in supported browsers.
  appRoot.inert = true;
}

setupCustomNumberSteppers();
clampTextSizeInput();
