// profileUI.js
// All profile-related UI:
//   • Profile bar (top-right of header) — active profile name + GPU dot,
//     dropdown to switch profiles, Save button, Manage button.
//   • Save Profile modal — set/rename profile + pick GPU, saves to localStorage.
//   • Export Profile modal — same fields, but also downloads <name>.json.
//   • Import handler — file picker → conflict modal if name already exists.
//   • Manage Profiles modal — full list with New / Rename / Duplicate / Delete.
//   • Profile badge — a live element for the Comparison tab showing active
//     profile name + GPU dot.
//
// Exported:
//   initProfileUI(headerEl)  → { openExportModal, triggerImport, attachBadge }

import {
  GPU_TYPES, isValidName, gpuById,
  getActiveId, getActiveProfile, getAllProfiles,
  switchProfile, createProfile, deleteProfile,
  renameProfile, saveProfileMeta, duplicateProfile,
  exportActiveToFile, importFromFile,
  subscribeProfiles, subscribeData,
} from "./profiles.js";
import { el } from "./utils.js";

// ─── Modal engine ────────────────────────────────────────────────────────────
// A single overlay at a time. Build content with buildModalContent() and call
// openModal() / closeModal(). Pressing Escape also closes.

const OVERLAY_ID = "profileModalOverlay";

function openModal({ title, body, footerBtns = [] }) {
  closeModal();

  const closeBtn = el("button", {
    className: "modal-close",
    attrs: { type: "button", "aria-label": "Close" },
    text: "\u00D7",
  });
  closeBtn.addEventListener("click", closeModal);

  const overlay = el("div", { className: "modal-overlay", attrs: { id: OVERLAY_ID } });
  const dialog  = el("div", {
    className: "modal-dialog",
    attrs: { role: "dialog", "aria-modal": "true" },
    children: [
      el("div", {
        className: "modal-header",
        children: [el("h3", { className: "modal-title", text: title }), closeBtn],
      }),
      el("div", { className: "modal-body", children: [body] }),
      footerBtns.length
        ? el("div", { className: "modal-footer", children: footerBtns })
        : null,
    ].filter(Boolean),
  });

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });

  // Trap Escape key
  const onKey = (e) => { if (e.key === "Escape") closeModal(); };
  document.addEventListener("keydown", onKey);
  overlay._cleanupKey = () => document.removeEventListener("keydown", onKey);

  // Focus first interactive element
  setTimeout(() => dialog.querySelector("input, button, select")?.focus(), 40);
  return dialog;
}

function closeModal() {
  const el = document.getElementById(OVERLAY_ID);
  if (el) {
    el._cleanupKey?.();
    el.remove();
  }
}

// ─── Shared form helpers ─────────────────────────────────────────────────────

function buildNameInput(initialValue) {
  const input = el("input", {
    attrs: { type: "text", maxlength: "32", placeholder: "profile-name", value: initialValue ?? "" },
  });
  const hint = el("p", { className: "modal-hint" });
  const validate = () => {
    const ok = isValidName(input.value);
    hint.textContent = ok || input.value === ""
      ? "Letters, digits, hyphens and underscores only. Max 32 chars."
      : "\u26A0 Invalid name \u2014 no spaces or special characters.";
    hint.classList.toggle("modal-hint-error", !ok && input.value !== "");
    return ok;
  };
  input.addEventListener("input", validate);
  validate();
  return { input, hint, validate };
}

function buildGpuSelect(initialGpu) {
  const select = el("select", { className: "gpu-select" });
  const noneOpt = el("option", { attrs: { value: "" }, text: "— No GPU set —" });
  select.appendChild(noneOpt);
  for (const g of GPU_TYPES) {
    const opt = el("option", { attrs: { value: g.id }, text: g.label });
    if (g.id === initialGpu) opt.selected = true;
    select.appendChild(opt);
  }
  return select;
}

function buildFormRow(labelText, inputEl) {
  return el("label", {
    className: "modal-field",
    children: [el("span", { text: labelText }), inputEl],
  });
}

// ─── Save Profile modal ───────────────────────────────────────────────────────
// Updates name + GPU in localStorage. If the name changed, the profile is renamed.

function openSaveModal() {
  const active = getActiveProfile();
  const oldName = getActiveId();

  const { input: nameInput, hint, validate } = buildNameInput(active?.name ?? oldName);
  const gpuSelect = buildGpuSelect(active?.gpu ?? "");

  const body = el("div", {
    className: "modal-form",
    children: [
      buildFormRow("Profile Name", nameInput),
      hint,
      buildFormRow("GPU", gpuSelect),
    ],
  });

  const saveBtn = el("button", { className: "btn btn-primary", text: "Save" });
  saveBtn.addEventListener("click", () => {
    if (!validate()) return;
    const newName = nameInput.value.trim();
    const newGpu  = gpuSelect.value || null;
    const existing = getAllProfiles();
    if (newName !== oldName && existing[newName]) {
      hint.textContent = `\u26A0 A profile named "${newName}" already exists.`;
      hint.classList.add("modal-hint-error");
      return;
    }
    saveProfileMeta(oldName, newName, newGpu);
    closeModal();
  });

  const cancelBtn = el("button", { className: "btn btn-ghost", text: "Cancel" });
  cancelBtn.addEventListener("click", closeModal);

  openModal({ title: "Save Profile", body, footerBtns: [cancelBtn, saveBtn] });
}

// ─── Export Profile modal ─────────────────────────────────────────────────────
// Same fields as Save, but also triggers a file download on confirm.

function openExportModal() {
  const active = getActiveProfile();
  const oldName = getActiveId();

  const { input: nameInput, hint, validate } = buildNameInput(active?.name ?? oldName);
  const gpuSelect = buildGpuSelect(active?.gpu ?? "");

  const body = el("div", {
    className: "modal-form",
    children: [
      buildFormRow("Profile Name", nameInput),
      hint,
      buildFormRow("GPU", gpuSelect),
      el("p", {
        className: "modal-hint",
        text: "This will save the profile and download it as a JSON file.",
      }),
    ],
  });

  const exportBtn = el("button", { className: "btn btn-primary", text: "Export \u2193" });
  exportBtn.addEventListener("click", () => {
    if (!validate()) return;
    const newName = nameInput.value.trim();
    const newGpu  = gpuSelect.value || null;
    const existing = getAllProfiles();
    if (newName !== oldName && existing[newName]) {
      hint.textContent = `\u26A0 A profile named "${newName}" already exists.`;
      hint.classList.add("modal-hint-error");
      return;
    }
    saveProfileMeta(oldName, newName, newGpu);
    // exportActiveToFile() uses the now-updated active profile name.
    exportActiveToFile();
    closeModal();
  });

  const cancelBtn = el("button", { className: "btn btn-ghost", text: "Cancel" });
  cancelBtn.addEventListener("click", closeModal);

  openModal({ title: "Export Profile", body, footerBtns: [cancelBtn, exportBtn] });
}

// ─── Import handler ───────────────────────────────────────────────────────────
// A hidden file input triggers the real work. Conflict resolution uses a modal.

function triggerImport() {
  const fileInput = el("input", {
    attrs: { type: "file", accept: "application/json" },
    className: "visually-hidden-file",
  });
  document.body.appendChild(fileInput);
  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    fileInput.remove();
    if (!file) return;
    try {
      const result = await importFromFile(file, (existingName) =>
        showConflictModal(existingName)
      );
      if (result.status !== "cancelled") {
        showImportSuccessToast(result);
      }
    } catch {
      alert("Could not import that file. Make sure it is a valid exported profile.");
    }
  });
  fileInput.click();
}

// Returns a Promise resolving to "overwrite" | "rename" | "cancel".
function showConflictModal(existingName) {
  return new Promise((resolve) => {
    const body = el("p", {
      text: `A profile named "${existingName}" already exists. What would you like to do?`,
    });

    const overwriteBtn = el("button", { className: "btn btn-primary", text: "Overwrite" });
    const renameBtn    = el("button", { className: "btn btn-accent",  text: `Rename to ${existingName}_2` });
    const cancelBtn    = el("button", { className: "btn btn-ghost",   text: "Cancel" });

    overwriteBtn.addEventListener("click", () => { closeModal(); resolve("overwrite"); });
    renameBtn.addEventListener   ("click", () => { closeModal(); resolve("rename"); });
    cancelBtn.addEventListener   ("click", () => { closeModal(); resolve("cancel"); });

    openModal({
      title: "Profile Already Exists",
      body,
      footerBtns: [cancelBtn, renameBtn, overwriteBtn],
    });
  });
}

function showImportSuccessToast({ status, name }) {
  const msg = status === "overwritten"
    ? `Profile "${name}" overwritten.`
    : `Profile "${name}" imported.`;
  const toast = el("div", { className: "profile-toast", text: msg });
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("profile-toast-show"), 10);
  setTimeout(() => {
    toast.classList.remove("profile-toast-show");
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

// ─── Manage Profiles modal ────────────────────────────────────────────────────

function openManageModal() {
  const listEl = el("div", { className: "manage-list" });
  const addSection = buildAddSection(listEl);

  const body = el("div", {
    children: [addSection, el("div", { className: "divider" }), listEl],
  });

  const closeBtn = el("button", { className: "btn btn-ghost", text: "Close" });
  closeBtn.addEventListener("click", closeModal);

  const dialog = openModal({ title: "Manage Profiles", body, footerBtns: [closeBtn] });
  rebuildManageList(listEl);

  // Keep the list live while the modal is open.
  const unsub = subscribeProfiles(() => rebuildManageList(listEl));
  dialog.closest(`#${OVERLAY_ID}`)._cleanup = unsub;
}

function buildAddSection(listEl) {
  const { input: nameInput, hint, validate } = buildNameInput("");
  const gpuSelect = buildGpuSelect(null);
  const addBtn = el("button", { className: "btn btn-primary", text: "+ New Profile" });

  addBtn.addEventListener("click", () => {
    if (!validate()) return;
    const name = nameInput.value.trim();
    const gpu  = gpuSelect.value || null;
    if (!createProfile(name, gpu)) {
      hint.textContent = `\u26A0 A profile named "${name}" already exists.`;
      hint.classList.add("modal-hint-error");
      return;
    }
    nameInput.value = "";
  });

  return el("div", {
    className: "manage-add",
    children: [
      el("h4", { text: "New Profile" }),
      buildFormRow("Name", nameInput),
      hint,
      buildFormRow("GPU", gpuSelect),
      addBtn,
    ],
  });
}

function rebuildManageList(listEl) {
  listEl.innerHTML = "";
  const profiles = getAllProfiles();
  const activeId = getActiveId();
  const profileCount = Object.keys(profiles).length;

  for (const [name, profile] of Object.entries(profiles)) {
    const isActive = name === activeId;
    const row = el("div", { className: `manage-row${isActive ? " manage-row-active" : ""}` });

    // GPU dot + name
    const gpu = gpuById(profile.gpu);
    const dot = gpu
      ? el("span", { className: "gpu-dot", attrs: { style: `background:${gpu.color}`, title: gpu.label } })
      : null;
    const namePart = el("span", { className: "manage-row-name", children: [dot, el("span", { text: name })].filter(Boolean) });
    if (isActive) {
      namePart.appendChild(el("span", { className: "active-badge", text: "active" }));
    }
    row.appendChild(namePart);

    // Action buttons
    const actions = el("div", { className: "manage-row-actions" });

    // Rename (inline edit)
    const renameBtn = el("button", { className: "btn-manage-action", text: "Rename" });
    renameBtn.addEventListener("click", () => showInlineRename(row, name));

    // Duplicate
    const dupBtn = el("button", { className: "btn-manage-action", text: "Duplicate" });
    dupBtn.addEventListener("click", () => showInlineDuplicate(row, name));

    // Delete
    const deleteBtn = el("button", {
      className: "btn-manage-action btn-manage-delete",
      text: "Delete",
      attrs: profileCount <= 1 ? { disabled: "" } : {},
    });
    deleteBtn.addEventListener("click", () => showInlineDelete(row, name));

    actions.appendChild(renameBtn);
    actions.appendChild(dupBtn);
    actions.appendChild(deleteBtn);
    row.appendChild(actions);
    listEl.appendChild(row);
  }
}

// Inline rename: replaces the name span with an input + save/cancel.
function showInlineRename(row, oldName) {
  const originalContent = row.innerHTML;
  row.innerHTML = "";

  const { input, hint, validate } = buildNameInput(oldName);
  const saveBtn   = el("button", { className: "btn-manage-action", text: "Save" });
  const cancelBtn = el("button", { className: "btn-manage-action", text: "Cancel" });

  saveBtn.addEventListener("click", () => {
    if (!validate()) return;
    const newName = input.value.trim();
    if (newName === oldName) { row.innerHTML = originalContent; rebuildManageList(row.parentElement); return; }
    if (!renameProfile(oldName, newName)) {
      hint.textContent = `\u26A0 "${newName}" is already taken.`;
      hint.classList.add("modal-hint-error");
    }
    // subscribeProfiles fires → rebuildManageList() called automatically
  });
  cancelBtn.addEventListener("click", () => rebuildManageList(row.parentElement));

  row.appendChild(el("div", { className: "manage-inline", children: [input, hint, saveBtn, cancelBtn] }));
}

// Inline duplicate: shows a name input for the copy.
function showInlineDuplicate(row, sourceName) {
  row.innerHTML = "";
  let suggested = `${sourceName}_2`;
  const profiles = getAllProfiles();
  let i = 2;
  while (profiles[suggested]) { i++; suggested = `${sourceName}_${i}`; }

  const { input, hint, validate } = buildNameInput(suggested);
  const saveBtn   = el("button", { className: "btn-manage-action", text: "Duplicate" });
  const cancelBtn = el("button", { className: "btn-manage-action", text: "Cancel" });

  saveBtn.addEventListener("click", () => {
    if (!validate()) return;
    const newName = input.value.trim();
    if (!duplicateProfile(sourceName, newName)) {
      hint.textContent = `\u26A0 "${newName}" already exists.`;
      hint.classList.add("modal-hint-error");
    }
  });
  cancelBtn.addEventListener("click", () => rebuildManageList(row.parentElement));

  row.appendChild(el("div", {
    className: "manage-inline",
    children: [
      el("span", { text: `Copy of "${sourceName}" \u2192` }),
      input, hint, saveBtn, cancelBtn,
    ],
  }));
}

// Inline delete confirmation.
function showInlineDelete(row, name) {
  row.innerHTML = "";

  const msg = el("span", { className: "delete-confirm-msg", text: `Delete "${name}"?` });
  const yesBtn = el("button", { className: "btn-manage-action btn-manage-delete", text: "Yes, delete" });
  const noBtn  = el("button", { className: "btn-manage-action", text: "Cancel" });

  yesBtn.addEventListener("click", () => {
    deleteProfile(name); // triggers subscribeProfiles → rebuildManageList
  });
  noBtn.addEventListener("click", () => rebuildManageList(row.parentElement));

  row.appendChild(el("div", { className: "manage-inline", children: [msg, yesBtn, noBtn] }));
}

// ─── Profile bar (header) ─────────────────────────────────────────────────────

function buildProfileBar(container) {
  const gpuDot     = el("span", { className: "gpu-dot", attrs: { id: "activeGpuDot" } });
  const select     = el("select", { className: "profile-select", attrs: { id: "profileSelect", "aria-label": "Active profile" } });
  const saveBtn    = el("button", { className: "btn-profile-action", text: "Save",   attrs: { type: "button" } });
  const manageBtn  = el("button", { className: "btn-profile-action", text: "Manage", attrs: { type: "button" } });

  select.addEventListener("change", () => switchProfile(select.value));
  saveBtn.addEventListener("click",   openSaveModal);
  manageBtn.addEventListener("click", openManageModal);

  container.appendChild(
    el("div", {
      className: "profile-bar-inner",
      children: [
        el("span", { className: "profile-bar-label", text: "Profile:" }),
        gpuDot,
        select,
        saveBtn,
        manageBtn,
      ],
    })
  );

  function update() {
    const profiles = getAllProfiles();
    const activeId = getActiveId();

    // Rebuild <select> options
    select.innerHTML = "";
    for (const name of Object.keys(profiles)) {
      const opt = el("option", { attrs: { value: name }, text: name });
      if (name === activeId) opt.selected = true;
      select.appendChild(opt);
    }

    // GPU dot: show only if the active profile has a GPU set
    const gpu = gpuById(getActiveProfile()?.gpu);
    if (gpu) {
      gpuDot.style.background = gpu.color;
      gpuDot.title = gpu.label;
      gpuDot.style.display = "";
    } else {
      gpuDot.style.display = "none";
    }
  }

  update();
  subscribeProfiles(update);
}

// ─── Profile badge (Comparison tab) ──────────────────────────────────────────

function attachBadge(container) {
  const dot     = el("span", { className: "gpu-dot badge-dot" });
  const nameEl  = el("span", { className: "badge-name" });
  const gpuEl   = el("span", { className: "badge-gpu" });
  const badgeEl = el("div", {
    className: "profile-badge",
    children: [
      el("span", { className: "badge-label", text: "Viewing:" }),
      dot,
      nameEl,
      gpuEl,
    ],
  });
  container.appendChild(badgeEl);

  function update() {
    const p   = getActiveProfile();
    const gpu = gpuById(p?.gpu);
    nameEl.textContent = p?.name ?? "—";
    if (gpu) {
      dot.style.background = gpu.color;
      dot.style.display    = "";
      gpuEl.textContent    = gpu.label;
    } else {
      dot.style.display = "none";
      gpuEl.textContent = "";
    }
  }

  update();
  subscribeProfiles(update);
  subscribeData(update);
}

// ─── Public entry point ───────────────────────────────────────────────────────

export function initProfileUI(headerEl) {
  buildProfileBar(headerEl);
  return { openExportModal, triggerImport, attachBadge };
}
