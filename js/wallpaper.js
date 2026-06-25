// wallpaper.js
// Optional wallpaper editor: places the generated cheatsheet onto a 1920x1080
// canvas with a color/gradient/image background, drag-to-move, scroll-to-zoom,
// and an optional "thin" overlay screenshot. Encapsulated so it only touches its
// own DOM and the cheatsheet's canvas (no globals).

import { byId, toNumber } from "./utils.js";

const MIN_SCALE = 0.1;
const MAX_SCALE = 5;

export function initWallpaper(cheatsheet) {
  const wallpaperCanvas = byId("wallpaperCanvas");
  const wpCtx = wallpaperCanvas.getContext("2d");
  const editor = byId("wallpaperEditor");
  const toggleBtn = byId("toggleWallpaperBtn");

  // Cache the editor's controls.
  const c = {
    x: byId("wpX"),
    y: byId("wpY"),
    scale: byId("wpScale"),
    bgType: byId("wpBgType"),
    bgColor: byId("wpBgColor"),
    colorControls: byId("wpColorControls"),
    gradientControls: byId("wpGradientControls"),
    gradientColor1: byId("wpGradientColor1"),
    gradientColor2: byId("wpGradientColor2"),
    gradientRotation: byId("wpGradientRotation"),
    gradientOffset: byId("wpGradientOffset"),
    fade: byId("wpFade"),
    imageControls: byId("wpImageControls"),
    bgImageInput: byId("wpBgImageInput"),
    thinPreview: byId("wpThinPreview"),
  };

  // Editor state (module-scoped, not global).
  let offsetX = 200;
  let offsetY = 200;
  let scale = 1;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let bgImage = null;

  // Pre-load the optional "thin" overlay screenshot.
  const thinPreviewImage = new Image();
  thinPreviewImage.src = "images/thin_screenshot.png";
  thinPreviewImage.onload = () => {
    if (c.thinPreview?.checked) draw();
  };

  // Render the wallpaper. `includeThinPreview` is set false right before export
  // so the overlay never ends up in the saved PNG.
  function draw(includeThinPreview = true) {
    wpCtx.clearRect(0, 0, wallpaperCanvas.width, wallpaperCanvas.height);

    if (c.bgType.value === "color") {
      wpCtx.fillStyle = c.bgColor.value;
      wpCtx.fillRect(0, 0, wallpaperCanvas.width, wallpaperCanvas.height);
    } else if (c.bgType.value === "gradient") {
      drawGradientBackground();
    } else if (c.bgType.value === "image") {
      drawImageBackground();
    }

    // Place the cheatsheet at the current offset/scale.
    wpCtx.save();
    wpCtx.translate(offsetX, offsetY);
    wpCtx.scale(scale, scale);
    wpCtx.drawImage(cheatsheet.mainCanvas, 0, 0);
    wpCtx.restore();

    if (includeThinPreview && shouldDrawThinPreview()) drawThinPreview();

    // Keep the numeric inputs in sync with drag/zoom interactions.
    c.x.value = Math.round(offsetX);
    c.y.value = Math.round(offsetY);
    c.scale.value = parseFloat(scale.toFixed(2));
  }

  function drawGradientBackground() {
    const angleRad = (toNumber(c.gradientRotation.value) * Math.PI) / 180;
    const x2 = wallpaperCanvas.width * Math.cos(angleRad);
    const y2 = wallpaperCanvas.height * Math.sin(angleRad);
    const grad = wpCtx.createLinearGradient(0, 0, x2, y2);

    const offset = toNumber(c.gradientOffset.value); // -1 .. 1
    const softness = toNumber(c.fade.value); // 0 .. 1
    const middle = 0.5 + offset / 2;
    const stop1 = Math.max(0, middle - softness / 2);
    const stop2 = Math.min(1, middle + softness / 2);

    grad.addColorStop(0, c.gradientColor1.value);
    grad.addColorStop(stop1, c.gradientColor1.value);
    grad.addColorStop(stop2, c.gradientColor2.value);
    grad.addColorStop(1, c.gradientColor2.value);

    wpCtx.fillStyle = grad;
    wpCtx.fillRect(0, 0, wallpaperCanvas.width, wallpaperCanvas.height);
  }

  function drawImageBackground() {
    if (bgImage && bgImage.complete) {
      // Cover-fit the image to the canvas.
      const imgScale = Math.max(
        wallpaperCanvas.width / bgImage.width,
        wallpaperCanvas.height / bgImage.height
      );
      const w = bgImage.width * imgScale;
      const h = bgImage.height * imgScale;
      wpCtx.drawImage(bgImage, (wallpaperCanvas.width - w) / 2, (wallpaperCanvas.height - h) / 2, w, h);
    } else {
      wpCtx.fillStyle = c.bgColor.value;
      wpCtx.fillRect(0, 0, wallpaperCanvas.width, wallpaperCanvas.height);
    }
  }

  function shouldDrawThinPreview() {
    return (
      c.thinPreview?.checked &&
      thinPreviewImage.complete &&
      thinPreviewImage.naturalWidth > 0 &&
      thinPreviewImage.naturalHeight > 0
    );
  }

  function drawThinPreview() {
    const maxWidth = wallpaperCanvas.width * 0.92;
    const maxHeight = wallpaperCanvas.height * 0.92;
    const overlayScale = Math.min(
      1,
      maxWidth / thinPreviewImage.naturalWidth,
      maxHeight / thinPreviewImage.naturalHeight
    );
    const w = thinPreviewImage.naturalWidth * overlayScale;
    const h = thinPreviewImage.naturalHeight * overlayScale;
    wpCtx.drawImage(thinPreviewImage, (wallpaperCanvas.width - w) / 2, (wallpaperCanvas.height - h) / 2, w, h);
  }

  // Show only the controls relevant to the selected background type.
  function syncBgControls() {
    c.colorControls.style.display = c.bgType.value === "color" ? "flex" : "none";
    c.gradientControls.style.display = c.bgType.value === "gradient" ? "flex" : "none";
    c.imageControls.style.display = c.bgType.value === "image" ? "flex" : "none";
  }

  // Size the background-type dropdown to fit its current label.
  function resizeBgTypeDropdown() {
    const temp = document.createElement("span");
    temp.style.visibility = "hidden";
    temp.style.whiteSpace = "pre";
    temp.style.font = window.getComputedStyle(c.bgType).font;
    temp.textContent = c.bgType.options[c.bgType.selectedIndex].text;
    document.body.appendChild(temp);
    c.bgType.style.width = Math.max(temp.getBoundingClientRect().width + 40, 210) + "px";
    document.body.removeChild(temp);
  }

  // Convert a mouse event to canvas coordinates (accounts for CSS scaling).
  function getMousePos(e) {
    const rect = wallpaperCanvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (wallpaperCanvas.width / rect.width),
      y: (e.clientY - rect.top) * (wallpaperCanvas.height / rect.height),
    };
  }

  // --- Wire up events -------------------------------------------------------

  let isVisible = false;
  toggleBtn.addEventListener("click", () => {
    isVisible = !isVisible;
    editor.classList.toggle("is-open", isVisible);
    toggleBtn.textContent = isVisible ? "Remove Wallpaper" : "Add Wallpaper";
    if (isVisible) draw();
  });

  c.bgType.addEventListener("change", () => {
    syncBgControls();
    resizeBgTypeDropdown();
    draw();
  });

  c.bgImageInput?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) {
      bgImage = null;
      draw();
      return;
    }
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const img = new Image();
      img.onload = () => {
        bgImage = img;
        draw();
      };
      img.onerror = () => {
        bgImage = null;
        draw();
      };
      img.src = loadEvent.target.result;
    };
    reader.readAsDataURL(file);
  });

  // Drag to reposition the cheatsheet.
  wallpaperCanvas.addEventListener("mousedown", (e) => {
    isDragging = true;
    const pos = getMousePos(e);
    dragStartX = pos.x - offsetX;
    dragStartY = pos.y - offsetY;
  });
  wallpaperCanvas.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const pos = getMousePos(e);
    offsetX = pos.x - dragStartX;
    offsetY = pos.y - dragStartY;
    draw();
  });
  wallpaperCanvas.addEventListener("mouseup", () => (isDragging = false));
  wallpaperCanvas.addEventListener("mouseleave", () => (isDragging = false));

  // Scroll to zoom.
  wallpaperCanvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    scale = Math.min(Math.max(MIN_SCALE, scale + e.deltaY * -0.001), MAX_SCALE);
    draw();
  });

  // Numeric position/scale inputs.
  [c.x, c.y, c.scale].forEach((input) => {
    input.addEventListener("input", () => {
      offsetX = toNumber(c.x.value, offsetX);
      offsetY = toNumber(c.y.value, offsetY);
      scale = Math.min(Math.max(MIN_SCALE, toNumber(c.scale.value, scale)), MAX_SCALE);
      draw();
    });
  });

  // Background color/gradient inputs redraw the wallpaper.
  [
    c.bgColor, c.gradientColor1, c.gradientColor2,
    c.gradientRotation, c.gradientOffset, c.fade,
  ].forEach((input) => input.addEventListener("input", () => draw()));

  c.thinPreview?.addEventListener("change", () => draw());

  // Redraw the wallpaper whenever the cheatsheet itself changes.
  cheatsheet.onRedraw(() => {
    if (isVisible) draw();
  });

  // Download the wallpaper (without the thin-preview overlay baked in).
  byId("downloadWallpaperBtn").addEventListener("click", () => {
    const hadThinPreview = Boolean(c.thinPreview?.checked);
    if (hadThinPreview) draw(false);
    const link = document.createElement("a");
    link.download = "wallpaper.png";
    link.href = wallpaperCanvas.toDataURL();
    link.click();
    if (hadThinPreview) draw(true);
  });

  // --- Initial render -------------------------------------------------------
  syncBgControls();
  resizeBgTypeDropdown();
  draw();
}
