// log.js
// Builds one tab panel per spawner type (single and combination rooms). Each
// panel is divided into three variant sections (Pure / Chest in Front / Chest
// Behind). Inside each variant section are the four condition cards
// (No Hover + Hovering × Hitboxes on/off) with manual orange/green inputs, a
// derived pink readout, and a live mini pie.
//
// Cell map key format: "${spawnerId}.${variantId}.${conditionId}"

import { SPAWNERS, VARIANTS, CONDITIONS, PIE_FILL } from "./constants.js";
import { el } from "./utils.js";
import { drawMiniPie, balancePie, computePink } from "./pie.js";
import { getCell, setCell, subscribe } from "./state.js";

export function initLog(panelsContainer) {
  // cells maps the composite key to { orange (input), green (input),
  // pink (span), canvas } so renderAll can update each element cheaply.
  const cells = new Map();

  for (const spawner of SPAWNERS) {
    const panel = el("section", {
      className: "tab-panel",
      attrs: { id: `panel-${spawner.id}` },
    });

    panel.appendChild(
      el("div", {
        className: "log-header",
        children: [
          el("h2", { text: `${spawner.label} Spawner` }),
          el("p", {
            className: "log-sub",
            text: "Type the pie numbers you read in-game. Pink is filled in automatically.",
          }),
        ],
      })
    );

    // One collapsible section per variant, each containing a 2×2 condition grid.
    for (const variant of VARIANTS) {
      const section = el("div", { className: "variant-section" });
      section.appendChild(el("h3", { className: "variant-title", text: variant.label }));

      const grid = el("div", { className: "condition-grid" });
      for (const condition of CONDITIONS) {
        grid.appendChild(buildConditionCard(spawner, variant, condition, cells));
      }
      section.appendChild(grid);
      panel.appendChild(section);
    }

    panelsContainer.appendChild(panel);
  }

  renderAll();
  subscribe(renderAll);

  function renderAll() {
    for (const [key, refs] of cells) {
      // Key is "spawnerId.variantId.conditionId" — split gives exactly 3 parts
      // because none of the IDs contain dots.
      const [spawnerId, variantId, conditionId] = key.split(".");
      const { orange, green } = getCell(spawnerId, variantId, conditionId);
      const pink = computePink(orange, green);

      // Only overwrite inputs the user is not actively typing into.
      if (document.activeElement !== refs.orange && Number(refs.orange.value) !== orange) {
        refs.orange.value = orange;
      }
      if (document.activeElement !== refs.green && Number(refs.green.value) !== green) {
        refs.green.value = green;
      }
      refs.pink.textContent = pink;
      drawMiniPie(refs.canvas, { orange, green, pink });
    }
  }
}

// Build one condition card: title, live mini pie, orange/green inputs, pink readout.
function buildConditionCard(spawner, variant, condition, cells) {
  const initial = getCell(spawner.id, variant.id, condition.id);
  const initialPink = computePink(initial.orange, initial.green);

  const canvas = el("canvas", {
    className: "mini-pie",
    attrs: { width: "120", height: "120" },
  });
  // Draw initial state immediately so the canvas isn't blank before the first
  // state subscription fires.
  drawMiniPie(canvas, { orange: initial.orange, green: initial.green, pink: initialPink });

  const orangeInput = el("input", {
    attrs: { type: "number", min: "0", max: "100", value: String(initial.orange) },
  });
  const greenInput = el("input", {
    attrs: { type: "number", min: "0", max: "100", value: String(initial.green) },
  });
  const pinkValue = el("span", {
    className: "pink-value",
    text: String(initialPink),
  });

  // On input: balance so orange+green never exceeds 100, then persist to state.
  const onInput = (activeField) => {
    const balanced = balancePie(orangeInput.value, greenInput.value, activeField);
    orangeInput.value = balanced.orange;
    greenInput.value  = balanced.green;
    setCell(spawner.id, variant.id, condition.id, balanced);
  };
  orangeInput.addEventListener("input", () => onInput("orange"));
  greenInput.addEventListener("input",  () => onInput("green"));

  const card = el("div", {
    className: "condition-card",
    children: [
      el("h3", { text: condition.label }),
      canvas,
      el("div", {
        className: "pie-inputs",
        children: [
          buildField("Orange", orangeInput, PIE_FILL.orange),
          buildField("Green",  greenInput,  PIE_FILL.green),
          buildReadout("Pink", pinkValue,   PIE_FILL.pink),
        ],
      }),
    ],
  });

  cells.set(`${spawner.id}.${variant.id}.${condition.id}`, {
    orange: orangeInput,
    green:  greenInput,
    pink:   pinkValue,
    canvas,
  });

  return card;
}

// A labelled, editable field (orange or green).
function buildField(label, input, swatchColor) {
  return el("label", {
    className: "pie-field",
    children: [
      el("span", {
        className: "swatch-label",
        children: [
          el("span", { className: "swatch", attrs: { style: `background:${swatchColor}` } }),
          el("span", { text: label }),
        ],
      }),
      input,
    ],
  });
}

// A labelled, read-only field (pink — derived from 100 - orange - green).
function buildReadout(label, valueEl, swatchColor) {
  return el("div", {
    className: "pie-field readonly",
    children: [
      el("span", {
        className: "swatch-label",
        children: [
          el("span", { className: "swatch", attrs: { style: `background:${swatchColor}` } }),
          el("span", { text: label }),
        ],
      }),
      valueEl,
    ],
  });
}
