// pie.js
// Reusable pie-chart drawing, decoupled from the DOM. Both the cheatsheet
// generator and the small "mini" pies in the log/table tabs render through here,
// so the visuals stay consistent everywhere.

import { clamp, toNumber } from "./utils.js";
import { PIE_FILL, PIE_TEXT } from "./constants.js";

// Given the orange and green percentages, the remaining slice is pink.
export function computePink(orange, green) {
  return clamp(100 - toNumber(orange) - toNumber(green), 0, 100);
}

// If orange + green exceeds 100, shrink whichever side is NOT being edited so
// the total stays at 100. `activeField` is "orange" or "green" (the one the
// user is currently typing into). Returns the corrected { orange, green }.
export function balancePie(orange, green, activeField) {
  orange = clamp(toNumber(orange), 0, 100);
  green = clamp(toNumber(green), 0, 100);
  if (orange + green > 100) {
    if (activeField === "orange") {
      green = 100 - orange;
    } else {
      orange = 100 - green;
    }
  }
  return { orange, green };
}

// Draw a single pie. `values` is { orange, green, pink? } (pink is derived if
// omitted). `style` controls outline, optional number text, and which numbers
// are visible.
export function drawPie(ctx, x, y, radius, values, style = {}) {
  const orange = clamp(toNumber(values.orange), 0, 100);
  const green = clamp(toNumber(values.green), 0, 100);
  const pink = values.pink != null ? values.pink : computePink(orange, green);

  const outlineColor = style.outlineColor ?? "#000000";
  const outlineWidth = style.outlineWidth ?? 0;

  // Largest slice first so a small slice never gets buried behind a big one.
  const slices = [
    { value: orange, color: PIE_FILL.orange },
    { value: pink, color: PIE_FILL.pink },
    { value: green, color: PIE_FILL.green },
  ].sort((a, b) => b.value - a.value);

  let startAngle = -Math.PI / 2; // start at 12 o'clock like the in-game pie
  slices.forEach((slice) => {
    if (slice.value <= 0) return;
    const sliceAngle = (slice.value / 100) * 2 * Math.PI;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, radius, startAngle, startAngle + sliceAngle);
    ctx.closePath();
    ctx.fillStyle = slice.color;
    ctx.fill();
    if (outlineWidth > 0) {
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = outlineWidth;
      ctx.stroke();
    }
    startAngle += sliceAngle;
  });

  // Outer ring to tidy up the edge where wedges meet.
  if (outlineWidth > 0) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = outlineWidth;
    ctx.stroke();
  }

  // Optional stacked number labels (used by the cheatsheet generator only).
  if (style.showText) {
    drawStackedText(ctx, x, y, radius, [
      { value: orange, color: PIE_TEXT.orange, show: style.show?.orange ?? true },
      { value: pink, color: PIE_TEXT.pink, show: style.show?.pink ?? true },
      { value: green, color: PIE_TEXT.green, show: style.show?.green ?? true },
    ], style);
  }
}

// Draw the visible slice values as vertically-centred lines of text. Uses the
// actual glyph bounds so 1, 2 or 3 lines all stay centred on the pie.
function drawStackedText(ctx, x, y, radius, slices, style) {
  const textSize = style.textSize ?? 45;
  const textOutlineWidth = style.textOutlineWidth ?? 0;
  const offsetX = style.textOffsetX ?? radius * 0.45;

  const visible = slices.filter((s) => s.show && s.value > 0);
  if (!visible.length) return;

  const lineGap = 4;
  ctx.font = `bold ${textSize}px Minecraft`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  const lines = visible.map((slice) => {
    const text = String(slice.value);
    const metrics = ctx.measureText(text);
    const ascent = metrics.actualBoundingBoxAscent || textSize * 0.8;
    const descent = metrics.actualBoundingBoxDescent || textSize * 0.2;
    return { ...slice, text, ascent, descent, height: ascent + descent };
  });

  const totalHeight =
    lines.reduce((sum, line) => sum + line.height, 0) + (lines.length - 1) * lineGap;
  let top = y - totalHeight / 2;

  lines.forEach((line) => {
    const baselineY = top + line.ascent;
    if (textOutlineWidth > 0) {
      ctx.lineWidth = textOutlineWidth;
      ctx.strokeStyle = "#000000";
      ctx.strokeText(line.text, x + offsetX, baselineY);
    }
    ctx.fillStyle = line.color;
    ctx.fillText(line.text, x + offsetX, baselineY);
    top += line.height + lineGap;
  });
}

// Render a standalone mini pie that fills its own small canvas. Used by the log
// tabs and comparison table. Numbers are shown as HTML next to the canvas, so
// this draws the wedges only.
export function drawMiniPie(canvas, values) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const radius = Math.min(cx, cy) - 2;
  drawPie(ctx, cx, cy, radius, values, {
    outlineColor: "#11141a",
    outlineWidth: 1.5,
    showText: false,
  });
}
