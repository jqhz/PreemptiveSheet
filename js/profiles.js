// profiles.js
// Pure data layer for the profile system. Owns all profile storage in
// localStorage, exposes CRUD operations, and fires two separate subscriber
// channels:
//   • dataListeners    — called whenever a cell value in the ACTIVE profile changes
//   • profileListeners — called whenever the profile list or active selection changes
//
// Storage key:  "preemptive.profiles.v1"
// Schema:       { activeId: string, profiles: { [name]: { name, gpu, data } } }
//
// Profile names double as storage keys. They must match NAME_REGEX so they
// are always safe to use as JSON keys and filenames.

import { SPAWNERS, VARIANTS, CONDITIONS } from "./constants.js";
import { clamp, toNumber } from "./utils.js";

const STORAGE_KEY = "preemptive.profiles.v1";

// GPU options. `color` is used for the dot in the UI.
export const GPU_TYPES = [
  /*{ id: "nvidia",  label: "NVidia",   color: "#d4edbc" },
  { id: "amd",     label: "AMD",      color: "#ffcfc9" },
  { id: "intel",   label: "Intel",    color: "#bfe1f6" },
  { id: "mseries", label: "M-series", color: "#e6cff2" },*/
  { id: "nvidia",  label: "NVidia",   color: "#76b900" },
  { id: "amd",     label: "AMD",      color: "#ed1c24" },
  { id: "intel",   label: "Intel",    color: "#0071c5" },
  { id: "mseries", label: "M-series", color: "#a2aaad" },
];

// Letters, digits, hyphens, underscores — no spaces, 1-32 chars.
export const NAME_REGEX = /^[A-Za-z0-9_-]{1,32}$/;
export function isValidName(n) { return NAME_REGEX.test(String(n ?? "")); }

// Resolve the GPU_TYPES entry for an id, or null if not found.
export function gpuById(id) { return GPU_TYPES.find((g) => g.id === id) ?? null; }

// ─── Internal helpers ────────────────────────────────────────────────────────

function createEmptySpawnerData() {
  const d = {};
  for (const s of SPAWNERS) {
    d[s.id] = {};
    for (const v of VARIANTS) {
      d[s.id][v.id] = {};
      for (const c of CONDITIONS) {
        d[s.id][v.id][c.id] = { orange: 0, green: 0 };
      }
    }
  }
  return d;
}

// Merge raw data onto a fresh skeleton so missing/invalid values are silently
// corrected and the structure is always complete.
function normalizeSpawnerData(raw) {
  const d = createEmptySpawnerData();
  if (!raw || typeof raw !== "object") return d;
  for (const s of SPAWNERS) {
    const rs = raw[s.id]; if (!rs) continue;
    for (const v of VARIANTS) {
      const rv = rs[v.id]; if (!rv) continue;
      for (const c of CONDITIONS) {
        const cell = rv[c.id]; if (!cell) continue;
        d[s.id][v.id][c.id] = {
          orange: clamp(toNumber(cell.orange), 0, 100),
          green:  clamp(toNumber(cell.green),  0, 100),
        };
      }
    }
  }
  return d;
}

function makeProfile(name, gpu, rawData) {
  return { name, gpu: gpu ?? null, data: normalizeSpawnerData(rawData) };
}

// ─── Store ───────────────────────────────────────────────────────────────────

let store = { activeId: "", profiles: {} };
const dataListeners    = new Set();
const profileListeners = new Set();

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); } catch { /* private mode */ }
}

function notifyData()     { for (const fn of dataListeners)    fn(); }
function notifyProfiles() { for (const fn of profileListeners) fn(); }

// Bootstrap: load from localStorage or create the "default" profile.
(function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const profiles = {};
      for (const [key, p] of Object.entries(parsed.profiles ?? {})) {
        if (isValidName(key)) {
          profiles[key] = makeProfile(p.name ?? key, p.gpu, p.data);
        }
      }
      const keys = Object.keys(profiles);
      if (keys.length > 0) {
        const activeId = parsed.activeId && profiles[parsed.activeId]
          ? parsed.activeId : keys[0];
        store = { activeId, profiles };
        return;
      }
    }
  } catch { /* corrupted storage */ }
  // First launch: create a blank "default" profile with no GPU set yet.
  const def = makeProfile("default", null, null);
  store = { activeId: "default", profiles: { default: def } };
  persist();
}());

// ─── Public read API ─────────────────────────────────────────────────────────

export function getActiveId()      { return store.activeId; }
export function getActiveProfile() { return store.profiles[store.activeId] ?? null; }
// Returns a shallow copy so callers cannot mutate the list directly.
export function getAllProfiles()    { return { ...store.profiles }; }

export function getActiveData() {
  return store.profiles[store.activeId]?.data ?? {};
}

// ─── Mutation API ─────────────────────────────────────────────────────────────

// Write one cell of the active profile. Called by state.js on every input.
export function setActiveCell(spawnerId, variantId, conditionId, { orange, green }) {
  const cell = store.profiles[store.activeId]?.data?.[spawnerId]?.[variantId]?.[conditionId];
  if (!cell) return;
  cell.orange = clamp(toNumber(orange), 0, 100);
  cell.green  = clamp(toNumber(green),  0, 100);
  persist();
  notifyData();
}

// Switch the active profile. Autosave is implicit (data mutated in place).
export function switchProfile(id) {
  if (!store.profiles[id] || id === store.activeId) return;
  store.activeId = id;
  persist();
  notifyData();
  notifyProfiles();
}

// Create a new empty profile. Returns false if name invalid or already taken.
export function createProfile(name, gpu) {
  if (!isValidName(name) || store.profiles[name]) return false;
  store.profiles[name] = makeProfile(name, gpu ?? null, null);
  persist();
  notifyProfiles();
  return true;
}

// Delete a profile. Refuses if it's the last one. Returns false on failure.
export function deleteProfile(name) {
  if (!store.profiles[name]) return false;
  if (Object.keys(store.profiles).length <= 1) return false; // cannot delete last
  delete store.profiles[name];
  if (store.activeId === name) {
    store.activeId = Object.keys(store.profiles)[0];
    persist(); notifyData(); notifyProfiles();
  } else {
    persist(); notifyProfiles();
  }
  return true;
}

// Rename a profile. Returns false if newName is invalid, taken, or unchanged.
export function renameProfile(oldName, newName) {
  if (oldName === newName) return false;
  if (!isValidName(newName) || !store.profiles[oldName] || store.profiles[newName]) return false;
  const p = store.profiles[oldName];
  p.name = newName;
  store.profiles[newName] = p;
  delete store.profiles[oldName];
  if (store.activeId === oldName) store.activeId = newName;
  persist();
  notifyProfiles();
  return true;
}

// Save profile metadata (name + GPU). Handles rename if the name changed.
// Works for any profile, not only the active one.
export function saveProfileMeta(oldName, newName, gpu) {
  if (newName !== oldName) {
    if (!renameProfile(oldName, newName)) return false;
  }
  if (store.profiles[newName]) {
    store.profiles[newName].gpu = gpu ?? null;
    persist();
    notifyProfiles();
  }
  return true;
}

// Deep-clone a profile under a new name. Returns false on failure.
export function duplicateProfile(sourceName, newName) {
  if (!isValidName(newName) || !store.profiles[sourceName] || store.profiles[newName]) return false;
  const src = store.profiles[sourceName];
  store.profiles[newName] = makeProfile(newName, src.gpu, JSON.parse(JSON.stringify(src.data)));
  persist();
  notifyProfiles();
  return true;
}

// ─── File I/O ────────────────────────────────────────────────────────────────

// Serialize the active profile and download it as <name>.json.
export function exportActiveToFile() {
  const p = store.profiles[store.activeId];
  if (!p) return;
  const blob = new Blob(
    [JSON.stringify({ name: p.name, gpu: p.gpu, data: p.data }, null, 2)],
    { type: "application/json" }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.download = `${p.name}.json`;
  a.href = url;
  a.click();
  URL.revokeObjectURL(url);
}

// Import a profile from a File. Returns a Promise resolving to
// { status: "imported"|"overwritten"|"renamed"|"cancelled", name? }.
// `onConflict` is an async fn(existingName) → "overwrite"|"rename"|"cancel".
export function importFromFile(file, onConflict) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const parsed = JSON.parse(e.target.result);

        // Derive name from the JSON field; fall back to the filename.
        let name = typeof parsed.name === "string" ? parsed.name.trim() : "";
        if (!isValidName(name)) {
          name = file.name
            .replace(/\.json$/i, "")
            .replace(/[^A-Za-z0-9_-]/g, "_")
            .slice(0, 32);
        }
        if (!isValidName(name)) name = "imported";

        const gpu  = parsed.gpu  ?? null;
        const data = normalizeSpawnerData(parsed.data);
        let wasOverwrite = false;

        if (store.profiles[name]) {
          const action = await onConflict(name);
          if (action === "cancel") { resolve({ status: "cancelled" }); return; }
          if (action === "rename") {
            let i = 2;
            while (store.profiles[`${name}_${i}`]) i++;
            name = `${name}_${i}`;
          } else {
            wasOverwrite = true; // "overwrite" — same name kept
          }
        }

        store.profiles[name] = makeProfile(name, gpu, data);
        persist();
        notifyProfiles();
        resolve({ status: wasOverwrite ? "overwritten" : "imported", name });
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

// ─── Subscriptions ───────────────────────────────────────────────────────────

export function subscribeData(fn) {
  dataListeners.add(fn);
  return () => dataListeners.delete(fn);
}

export function subscribeProfiles(fn) {
  profileListeners.add(fn);
  return () => profileListeners.delete(fn);
}
