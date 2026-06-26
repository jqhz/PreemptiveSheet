// table.js
// The "Comparison" tab: a table showing every spawner × variant as rows,
// with the four condition columns plus two delta columns (Δ No Hover and
// Δ Hovering) that show how the orange and green values shift when hitboxes
// are toggled on vs off.
//
// Spawner-visibility checkboxes above the table hide/show all three variant rows
// for a spawner at once. Each row also has its own checkbox so runners can pick
// exact combinations (e.g. Silverfish Chest Behind vs Spider Pure).
//
// Pink is NOT shown as a number in this table (the pie chart still renders it
// visually). Only orange and green values are displayed in text.

// initTable now accepts { onExportClick, onImportClick } callbacks so that
// profileUI.js can handle the export modal and import file-picker without
// table.js needing to depend on profileUI.js. Returns { badgeEl } so
// main.js can hand the badge container to profileUI's attachBadge().

import { SPAWNERS, VARIANTS, CONDITIONS, DELTA_PAIRS, PIE_TEXT } from "./constants.js";
import { el } from "./utils.js";
import { drawMiniPie, computePink } from "./pie.js";
import { getCell, subscribe } from "./state.js";

export function initTable(panelsContainer, { onExportClick, onImportClick } = {}) {
  const panel = el("section", {
    className: "tab-panel",
    attrs: { id: "panel-comparison" },
  });

  panel.appendChild(
    el("div", {
      className: "log-header",
      children: [
        el("h2", { text: "Spike Comparison" }),
        el("p", {
          className: "log-sub",
          text: "All logged spawner spikes side by side. Use the row checkboxes to pick exact variants to compare.",
        }),
      ],
    })
  );

  // Profile badge placeholder — profileUI.js populates this via attachBadge().
  const badgeEl = el("div", { className: "profile-badge-slot" });
  panel.appendChild(badgeEl);

  // Export / Import buttons delegate to profileUI via injected callbacks.
  const exportBtn = el("button", { className: "btn btn-primary", text: "Export JSON", attrs: { type: "button" } });
  const importBtn = el("button", { className: "btn btn-secondary", text: "Import JSON", attrs: { type: "button" } });
  exportBtn.addEventListener("click", () => onExportClick?.());
  importBtn.addEventListener("click", () => onImportClick?.());

  panel.appendChild(
    el("div", {
      className: "table-actions",
      children: [exportBtn, importBtn],
    })
  );

  // Spawner-visibility toggles: one checkbox per spawner above the table.
  const spawnerVisible = new Map(SPAWNERS.map((s) => [s.id, true]));
  const variantVisible = new Map(); // `${spawnerId}.${variantId}` → boolean
  const rowRefs = new Map(); // same key → { row, checkbox }

  // Keep a reference to every spawner-level checkbox so showAll can reset them.
  const spawnerCheckboxes = new Map();

  const filterBar = el("div", { className: "filter-bar" });
  filterBar.appendChild(el("span", { className: "filter-label", text: "Spawners:" }));
  for (const spawner of SPAWNERS) {
    const checkbox = el("input", {
      attrs: { type: "checkbox", id: `filter-${spawner.id}` },
    });
    checkbox.checked = true;
    checkbox.addEventListener("change", () => {
      spawnerVisible.set(spawner.id, checkbox.checked);
      // When re-enabling a spawner, also re-check all its variant rows so they
      // are recoverable even if the user had unchecked every one individually.
      if (checkbox.checked) {
        for (const variant of VARIANTS) {
          const rowKey = `${spawner.id}.${variant.id}`;
          variantVisible.set(rowKey, true);
          const refs = rowRefs.get(rowKey);
          if (refs) refs.checkbox.checked = true;
        }
      }
      for (const variant of VARIANTS) {
        applyRowVisibility(`${spawner.id}.${variant.id}`);
      }
    });
    spawnerCheckboxes.set(spawner.id, checkbox);
    filterBar.appendChild(
      el("label", {
        className: "filter-check",
        children: [checkbox, el("span", { text: spawner.label })],
      })
    );
  }

  // Show All: recheck every spawner and every variant row checkbox, then
  // update visibility. Useful when all variants of a spawner are unchecked
  // and there's no row checkbox left to click.
  const showAllBtn = el("button", { className: "btn-show-all", text: "Show All", attrs: { type: "button" } });
  showAllBtn.addEventListener("click", () => {
    for (const spawner of SPAWNERS) {
      spawnerVisible.set(spawner.id, true);
      spawnerCheckboxes.get(spawner.id).checked = true;
      for (const variant of VARIANTS) {
        const rowKey = `${spawner.id}.${variant.id}`;
        variantVisible.set(rowKey, true);
        const refs = rowRefs.get(rowKey);
        if (refs) refs.checkbox.checked = true;
        applyRowVisibility(rowKey);
      }
    }
  });
  filterBar.appendChild(showAllBtn);

  const hideAllBtn = el("button", { className: "btn-hide-all", text: "Hide All", attrs: { type: "button" } });
  hideAllBtn.addEventListener("click", () => {
    for (const spawner of SPAWNERS) {
      spawnerVisible.set(spawner.id, false);
      spawnerCheckboxes.get(spawner.id).checked = false;
      for (const variant of VARIANTS) {
        const rowKey = `${spawner.id}.${variant.id}`;
        variantVisible.set(rowKey, false);
        const refs = rowRefs.get(rowKey);
        if (refs) refs.checkbox.checked = false;
        applyRowVisibility(rowKey);
      }
    }
  });
  filterBar.appendChild(hideAllBtn);
  panel.appendChild(filterBar);

  // A row is visible only when its spawner AND its own variant checkbox are on.
  function applyRowVisibility(rowKey) {
    const refs = rowRefs.get(rowKey);
    if (!refs) return;
    const [spawnerId] = rowKey.split(".");
    const show = spawnerVisible.get(spawnerId) && variantVisible.get(rowKey);
    refs.row.style.display = show ? "" : "none";
  }

  // Build the table. `cells` maps composite keys to DOM refs for regular cells;
  // `deltaCells` maps keys to DOM refs for the two delta cells per row.
  const cells      = new Map(); // key: "spawnerId.variantId.conditionId"
  const deltaCells = new Map(); // key: "spawnerId.variantId.noHoverDelta" | "…hoverDelta"

  const table = buildTable(cells, deltaCells, rowRefs, variantVisible, applyRowVisibility);
  panel.appendChild(el("div", { className: "table-scroll", children: [table] }));

  panelsContainer.appendChild(panel);

  renderAll();
  subscribe(renderAll);

  function renderAll() {
    // Update regular condition cells.
    for (const [key, refs] of cells) {
      const [spawnerId, variantId, conditionId] = key.split(".");
      const { orange, green } = getCell(spawnerId, variantId, conditionId);
      const pink = computePink(orange, green);
      drawMiniPie(refs.canvas, { orange, green, pink });
      refs.orange.textContent = orange;
      refs.green.textContent  = green;
      // Pink is intentionally not shown as a number here per runner request.
    }

    // Update delta cells: Δ = hitboxes-on value minus hitboxes-off value.
    for (const [key, refs] of deltaCells) {
      const dotIdx = key.lastIndexOf(".");
      const spawnerId = key.slice(0, key.indexOf("."));
      const variantId = key.slice(key.indexOf(".") + 1, dotIdx);
      const pairId    = key.slice(dotIdx + 1);

      const pair = DELTA_PAIRS.find((p) => p.id === pairId);
      if (!pair) continue;

      const cellA = getCell(spawnerId, variantId, pair.a);
      const cellB = getCell(spawnerId, variantId, pair.b);
      const dOrange = cellB.orange - cellA.orange;
      const dGreen  = cellB.green  - cellA.green;

      refs.orange.textContent = formatDelta(dOrange);
      refs.green.textContent  = formatDelta(dGreen);
      refs.orange.className   = `delta-val ${deltaClass(dOrange)}`;
      refs.green.className    = `delta-val ${deltaClass(dGreen)}`;
    }
  }

  // Return the badge container so main.js can hand it to profileUI.attachBadge().
  return { badgeEl };
}

// Return "+N", "−N", or "0" with a consistent sign character.
function formatDelta(n) {
  if (n === 0) return "0";
  return (n > 0 ? "+" : "\u2212") + Math.abs(n);
}

// CSS class added to delta spans to color-code them.
function deltaClass(n) {
  if (n > 0) return "delta-pos";
  if (n < 0) return "delta-neg";
  return "delta-zero";
}

// Build the <table> element. Rows are one per spawner × variant (3 rows per
// spawner). Each row header has a checkbox to show/hide that variant independently.
function buildTable(cells, deltaCells, rowRefs, variantVisible, applyRowVisibility) {
  // Column order: [noHover_hitbox, noHover_noHitbox, ΔnoHover,
  //               hover_hitbox,   hover_noHitbox,   ΔHover]
  const thead = el("thead", {
    children: [
      el("tr", {
        children: [
          el("th", { className: "corner", text: "Spawner / Variant" }),
          el("th", { text: "No Hover · Hitboxes" }),
          el("th", { text: "No Hover · No Hitboxes" }),
          el("th", { className: "delta-th", text: "\u0394 No Hover" }),
          el("th", { text: "Hovering · Hitboxes" }),
          el("th", { text: "Hovering · No Hitboxes" }),
          el("th", { className: "delta-th", text: "\u0394 Hovering" }),
        ],
      }),
    ],
  });

  const tbody = el("tbody");

  for (const spawner of SPAWNERS) {
    VARIANTS.forEach((variant, variantIdx) => {
      const rowKey = `${spawner.id}.${variant.id}`;
      variantVisible.set(rowKey, true);

      const rowCheckbox = el("input", {
        attrs: {
          type: "checkbox",
          id: `row-toggle-${spawner.id}-${variant.id}`,
          "aria-label": `Show ${spawner.label} ${variant.label}`,
        },
      });
      rowCheckbox.checked = true;

      const updateRowVisibility = () => {
        variantVisible.set(rowKey, rowCheckbox.checked);
        applyRowVisibility(rowKey);
      };

      rowCheckbox.addEventListener("change", updateRowVisibility);

      const rowHeadText = `${spawner.label} \u2013 ${variant.label}`;
      const rowHeadCell = el("th", {
        className: "row-head",
        attrs: { tabindex: "0" },
        children: [
          el("label", {
            className: "row-toggle",
            attrs: { for: `row-toggle-${spawner.id}-${variant.id}` },
            children: [rowCheckbox, el("span", { text: rowHeadText })],
          }),
        ],
      });

      rowHeadCell.addEventListener("click", (event) => {
        event.preventDefault();
        if (event.target.closest("input")) return;
        rowCheckbox.checked = !rowCheckbox.checked;
        updateRowVisibility();
      });

      rowHeadCell.addEventListener("keydown", (event) => {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          rowCheckbox.checked = !rowCheckbox.checked;
          updateRowVisibility();
        }
      });

      const row = el("tr", {
        className: variantIdx === 0 ? "group-first" : "",
        children: [rowHeadCell],
      });

      rowRefs.set(rowKey, { row, checkbox: rowCheckbox });

      // Condition columns in the correct interleaved order.
      const conditionOrder = [
        CONDITIONS.find((c) => c.id === "noHover_hitbox"),
        CONDITIONS.find((c) => c.id === "noHover_noHitbox"),
        null, // placeholder for Δ No Hover column
        CONDITIONS.find((c) => c.id === "hover_hitbox"),
        CONDITIONS.find((c) => c.id === "hover_noHitbox"),
        null, // placeholder for Δ Hovering column
      ];

      conditionOrder.forEach((condition, colIdx) => {
        if (condition === null) {
          // Delta column: colIdx 2 → noHoverDelta, colIdx 5 → hoverDelta.
          const pair = DELTA_PAIRS[colIdx === 2 ? 0 : 1];
          row.appendChild(buildDeltaCell(spawner, variant, pair, deltaCells));
        } else {
          row.appendChild(buildConditionCell(spawner, variant, condition, cells));
        }
      });

      tbody.appendChild(row);
    });
  }

  return el("table", { className: "comparison-table", children: [thead, tbody] });
}

// A regular condition cell: mini pie + orange number + green number.
// Pink is NOT shown as a number per runner request.
function buildConditionCell(spawner, variant, condition, cells) {
  const canvas = el("canvas", {
    className: "mini-pie small",
    attrs: { width: "84", height: "84" },
  });
  const orange = el("span", { attrs: { style: `color:${PIE_TEXT.orange}` } });
  const green  = el("span", { attrs: { style: `color:${PIE_TEXT.green}` } });

  cells.set(`${spawner.id}.${variant.id}.${condition.id}`, { canvas, orange, green });

  return el("td", {
    children: [
      canvas,
      el("div", { className: "cell-values", children: [orange, green] }),
    ],
  });
}

// A delta cell: two signed numbers (Δ orange above, Δ green below).
function buildDeltaCell(spawner, variant, pair, deltaCells) {
  const orangeEl = el("span", { className: "delta-val delta-zero" });
  const greenEl  = el("span", { className: "delta-val delta-zero" });

  deltaCells.set(`${spawner.id}.${variant.id}.${pair.id}`, {
    orange: orangeEl,
    green:  greenEl,
  });

  return el("td", {
    className: "delta-td",
    children: [
      el("div", {
        className: "delta-values",
        children: [
          el("div", {
            className: "delta-row",
            children: [
              el("span", { className: "swatch", attrs: { style: `background:${PIE_TEXT.orange}` } }),
              orangeEl,
            ],
          }),
          el("div", {
            className: "delta-row",
            children: [
              el("span", { className: "swatch", attrs: { style: `background:${PIE_TEXT.green}` } }),
              greenEl,
            ],
          }),
        ],
      }),
    ],
  });
}
