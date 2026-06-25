// cheatsheet.js
// The silverfish cheatsheet generator: draws the three silverfish spawner pies
// (Only Spawner / Chest in Front / Chest Behind) onto the main canvas over the
// template image, with configurable background and pie styling. Exposes a small
// object so the wallpaper editor can render the same canvas and redraw on edits.

import { byId, toNumber, clamp, roundedRectPath } from "./utils.js";
import { drawPie, balancePie } from "./pie.js";
import { PIE_POSITIONS, PIE_RADIUS, SILVERFISH_TYPES } from "./constants.js";

export function initCheatsheet() {
  const mainCanvas = byId("mainCanvas");
  const ctx = mainCanvas.getContext("2d");

  // Cache the controls this tab reads on every draw.
  const controls = {
    showBg: byId("showBackground"),
    bgSettings: byId("backgroundSettings"),
    bgColor: byId("bgColor"),
    bgBorderRadius: byId("bgBorderRadius"),
    outlineColor: byId("outlineColor"),
    outlineWidth: byId("outlineWidth"),
    pieOutlineColor: byId("pieOutlineColor"),
    pieOutlineWidth: byId("pieOutlineWidth"),
    textSize: byId("textSize"),
    textOutlineWidth: byId("textOutlineWidth"),
    showOrange: byId("showOrange"),
    showPink: byId("showPink"),
    showGreen: byId("showGreen"),
  };

  // The template drawn behind the pies. Loaded once; we redraw when it arrives.
  const templateImage = new Image();
  templateImage.src = "images/template.png";

  // Listeners registered by other modules (the wallpaper editor) that want to
  // know whenever the cheatsheet is redrawn.
  const redrawListeners = new Set();

  function keepTextSizeInBounds() {
    const clamped = clamp(toNumber(controls.textSize.value, 60), 20, 60);
    if (toNumber(controls.textSize.value, 60) !== clamped || controls.textSize.value === "") {
      controls.textSize.value = String(clamped);
    }
  }

  // Render the whole cheatsheet onto the main canvas (or a clone for export).
  function draw() {
    ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);

    if (controls.showBg.checked) {
      const bgRadius = toNumber(controls.bgBorderRadius.value);
      const outlineWidth = toNumber(controls.outlineWidth.value);

      ctx.fillStyle = controls.bgColor.value;
      if (bgRadius > 0) {
        roundedRectPath(ctx, 0, 0, mainCanvas.width, mainCanvas.height, bgRadius);
        ctx.fill();
      } else {
        ctx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);
      }

      if (outlineWidth > 0) {
        ctx.strokeStyle = controls.outlineColor.value;
        ctx.lineWidth = outlineWidth;
        if (bgRadius > 0) {
          roundedRectPath(ctx, 0, 0, mainCanvas.width, mainCanvas.height, bgRadius);
          ctx.stroke();
        } else {
          ctx.strokeRect(0, 0, mainCanvas.width, mainCanvas.height);
        }
      }
    }

    ctx.drawImage(templateImage, 0, 0, mainCanvas.width, mainCanvas.height);

    const pieStyle = {
      outlineColor: controls.pieOutlineColor.value,
      outlineWidth: toNumber(controls.pieOutlineWidth.value),
      showText: true,
      textSize: toNumber(controls.textSize.value),
      textOutlineWidth: toNumber(controls.textOutlineWidth.value),
      show: {
        orange: controls.showOrange.checked,
        pink: controls.showPink.checked,
        green: controls.showGreen.checked,
      },
    };

    // One pie per silverfish type. Values come straight from the inputs (the
    // input handler has already balanced orange+green to <= 100).
    SILVERFISH_TYPES.forEach((type, i) => {
      const pos = PIE_POSITIONS[i];
      if (!pos) return;
      const values = {
        orange: toNumber(byId(`orange_${type.key}`).value),
        green: toNumber(byId(`green_${type.key}`).value),
      };
      drawPie(ctx, pos[0], pos[1], PIE_RADIUS, values, pieStyle);
    });

    redrawListeners.forEach((fn) => fn());
  }

  // Show/hide the background settings block to match its toggle.
  function syncBackgroundSettings() {
    controls.bgSettings.style.display = controls.showBg.checked ? "block" : "none";
  }

  // --- Wire up events -------------------------------------------------------

  controls.showBg.addEventListener("change", () => {
    syncBackgroundSettings();
    draw();
  });

  // Pie value inputs: balance orange+green so the total never exceeds 100,
  // then redraw.
  SILVERFISH_TYPES.forEach((type) => {
    const orangeInput = byId(`orange_${type.key}`);
    const greenInput = byId(`green_${type.key}`);
    const onPieInput = (activeField) => {
      const balanced = balancePie(orangeInput.value, greenInput.value, activeField);
      orangeInput.value = balanced.orange;
      greenInput.value = balanced.green;
      draw();
    };
    orangeInput.addEventListener("input", () => onPieInput("orange"));
    greenInput.addEventListener("input", () => onPieInput("green"));
  });

  // Style inputs simply trigger a redraw.
  [
    "bgColor", "bgBorderRadius", "outlineColor", "outlineWidth",
    "pieOutlineColor", "pieOutlineWidth", "textSize", "textOutlineWidth",
  ].forEach((id) => {
    byId(id).addEventListener("input", () => {
      keepTextSizeInBounds();
      draw();
    });
  });
  controls.textSize.addEventListener("blur", keepTextSizeInBounds);

  ["showOrange", "showPink", "showGreen"].forEach((id) => {
    byId(id).addEventListener("change", draw);
  });

  // Download the current cheatsheet as a PNG.
  byId("downloadBtn").addEventListener("click", () => {
    const link = document.createElement("a");
    link.download = "cheatsheet.png";
    link.href = mainCanvas.toDataURL();
    link.click();
  });

  // --- Initial render -------------------------------------------------------

  syncBackgroundSettings();
  keepTextSizeInBounds();

  // Draw once now, and again once the template image and fonts are ready.
  draw();
  Promise.all([
    new Promise((res) => {
      if (templateImage.complete) res();
      else templateImage.onload = res;
    }),
    document.fonts ? document.fonts.ready : Promise.resolve(),
  ]).then(draw).catch(draw);

  return {
    mainCanvas,
    redraw: draw,
    // Let other modules react to cheatsheet redraws (returns an unsubscribe).
    onRedraw(fn) {
      redrawListeners.add(fn);
      return () => redrawListeners.delete(fn);
    },
  };
}
