// main.js
// Application entry point. Initialisation order matters:
//   1. profiles.js self-bootstraps on import (loads localStorage or creates "default").
//   2. initProfileUI() builds the header profile bar and returns the export/import
//      callbacks that table.js needs.
//   3. initLog() and initTable() build the dynamic panels. Table gets the profile
//      callbacks so its Export/Import buttons open the correct modals.
//   4. initTabs() wires up the tab bar now that all panels exist in the DOM.
//   5. initCheatsheet() + initWallpaper() set up the generator.
//   6. setupCustomNumberSteppers() adds ▲/▼ steppers to every number input.
//   7. Global clamping safety-net for all number inputs.

import { SPAWNERS } from "./constants.js";
import { byId, clampNumberInputToBounds } from "./utils.js";
import { initTabs } from "./tabs.js";
import { initCheatsheet, initControlsSubtabs } from "./cheatsheet.js";
import { initWallpaper } from "./wallpaper.js";
import { initLog } from "./log.js";
import { initTable } from "./table.js";
import { initProfileUI } from "./profileUI.js";
import { setupCustomNumberSteppers } from "./numberSteppers.js";

function init() {
  const panels = byId("panels");

  // Build the profile bar in the header, get the export/import callbacks and
  // the attachBadge helper.
  const { openExportModal, triggerImport, attachBadge } = initProfileUI(byId("profileBar"));

  // Build the dynamic panels. Table gets profile-aware export/import callbacks
  // and returns the badge container for the Comparison tab.
  initLog(panels);
  const { badgeEl } = initTable(panels, {
    onExportClick: openExportModal,
    onImportClick: triggerImport,
  });

  // Populate the profile badge now that the container element exists.
  attachBadge(badgeEl);

  // Build the tab bar after all panels exist so initTabs can find every
  // #panel-<id> element. Tab order: Cheatsheet, spawners, Comparison.
  const tabs = [
    { id: "cheatsheet", label: "Cheatsheet" },
    ...SPAWNERS.map((s) => ({ id: s.id, label: s.label })),
    { id: "comparison", label: "Comparison" },
  ];
  initTabs(byId("tabBar"), tabs);

  // Sub-tabs are independent of canvas setup — init first so they work even if draw fails.
  initControlsSubtabs();

  // Cheatsheet generator + wallpaper editor (static; not profile-aware).
  const cheatsheet = initCheatsheet();
  initWallpaper(cheatsheet);

  // Add custom ▲/▼ steppers to every number input now that all panels exist.
  setupCustomNumberSteppers();

  // Safety net: clamp any number input back inside its min/max on input + blur.
  document.addEventListener(
    "input",
    (e) => {
      if (e.target instanceof HTMLInputElement && e.target.type === "number") {
        clampNumberInputToBounds(e.target);
      }
    },
    true
  );
  document.addEventListener(
    "blur",
    (e) => {
      if (e.target instanceof HTMLInputElement && e.target.type === "number") {
        clampNumberInputToBounds(e.target);
      }
    },
    true
  );
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
