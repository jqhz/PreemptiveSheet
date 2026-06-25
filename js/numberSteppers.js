// numberSteppers.js
// Replaces the native (hidden) number-input spinners with custom ▲/▼ buttons
// that also support press-and-hold to repeat. Can be run against the whole
// document or a specific container, so dynamically-created inputs (log tabs)
// get steppers too.

import { toNumber, clamp } from "./utils.js";

export function setupCustomNumberSteppers(root = document) {
  const numberInputs = root.querySelectorAll('input[type="number"]');

  numberInputs.forEach((inputEl) => {
    // Skip inputs that already have steppers attached.
    if (inputEl.parentElement?.classList.contains("num-wrap")) return;

    const wrap = document.createElement("span");
    wrap.className = "num-wrap";
    inputEl.parentNode.insertBefore(wrap, inputEl);
    wrap.appendChild(inputEl);

    wrap.appendChild(createStep(inputEl, "\u25B2", 1));
    wrap.appendChild(createStep(inputEl, "\u25BC", -1));
  });
}

// Build a single stepper button bound to one input and one direction (+1/-1).
function createStep(inputEl, label, direction) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "num-step";
  btn.textContent = label;

  let holdTimeout = null;
  let holdInterval = null;

  const runStep = () => {
    try {
      // Prefer the native stepper so min/max/step are honoured for free.
      if (direction > 0) inputEl.stepUp(1);
      else inputEl.stepDown(1);
    } catch {
      // Fallback for inputs where stepUp/stepDown throws (empty value, etc).
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
    if (holdTimeout) clearTimeout(holdTimeout);
    if (holdInterval) clearInterval(holdInterval);
    holdTimeout = null;
    holdInterval = null;
  };

  const startHold = () => {
    runStep();
    // After a short delay, repeat rapidly while the button stays pressed.
    holdTimeout = setTimeout(() => {
      holdInterval = setInterval(runStep, 55);
    }, 260);
  };

  btn.addEventListener("click", (e) => e.preventDefault());
  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    btn.setPointerCapture(e.pointerId);
    startHold();
  });
  btn.addEventListener("pointerup", stopHold);
  btn.addEventListener("pointercancel", stopHold);
  btn.addEventListener("pointerleave", stopHold);
  btn.addEventListener("lostpointercapture", stopHold);

  return btn;
}
