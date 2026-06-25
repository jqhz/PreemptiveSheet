// tabs.js
// Minimal, data-driven tab navigation. Builds the tab buttons from a config and
// toggles the matching `#panel-<id>` section. Keeps the active tab logic in one
// place so adding a tab is just one config entry plus a panel element.

import { el } from "./utils.js";

export function initTabs(tabBar, tabs) {
  const buttons = new Map();

  tabs.forEach((tab, index) => {
    const btn = el("button", {
      className: "tab-btn",
      text: tab.label,
      attrs: { type: "button", "data-tab": tab.id },
    });
    btn.addEventListener("click", () => activate(tab.id));
    buttons.set(tab.id, btn);
    tabBar.appendChild(btn);
    // The first tab is shown by default.
    if (index === 0) activate(tab.id);
  });

  function activate(id) {
    for (const [tabId, btn] of buttons) {
      const isActive = tabId === id;
      btn.classList.toggle("is-active", isActive);
      const panel = document.getElementById(`panel-${tabId}`);
      if (panel) panel.classList.toggle("is-active", isActive);
    }
  }

  return { activate };
}
