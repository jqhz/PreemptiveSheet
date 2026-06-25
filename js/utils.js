// utils.js
// Small, dependency-free helper functions shared across every module.
// Keeping these here avoids duplicating logic and keeps other modules focused
// on their own responsibilities.

// Shorthand for document.getElementById. Returns null if not found.
export const byId = (id) => document.getElementById(id);

// Create a DOM element with optional class names, attributes, text and children.
// This keeps the dynamic-UI modules (log/table) readable instead of repeating
// long document.createElement sequences.
export function el(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text != null) node.textContent = options.text;
  if (options.html != null) node.innerHTML = options.html;
  if (options.attrs) {
    for (const [key, value] of Object.entries(options.attrs)) {
      node.setAttribute(key, value);
    }
  }
  if (options.children) {
    for (const child of options.children) {
      if (child) node.appendChild(child);
    }
  }
  return node;
}

// Convert any value to a finite number, falling back to a default when invalid.
export function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// Constrain a number to the inclusive [min, max] range.
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// Force a number <input> back inside its own min/max bounds after the user
// types an out-of-range value. Respects a fixed-decimal step (e.g. "0.01").
export function clampNumberInputToBounds(inputEl) {
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

// Trace a rounded-rectangle path on a canvas context. Used for the cheatsheet
// background. radius is clamped so it can never exceed half the smallest side.
export function roundedRectPath(ctx, x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - r);
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
