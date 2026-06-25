// state.js
// Thin adapter over profiles.js. Exposes the same getCell / setCell / subscribe
// API that log.js and table.js depend on, but delegates all storage to the
// profile system so every operation always targets the active profile.
//
// When the active profile changes (switch or import), profiles.js fires its
// dataListeners channel, which propagates here to our own subscribers so the
// log panels and comparison table re-render automatically.

import { getActiveData, setActiveCell, subscribeData } from "./profiles.js";

// Read one cell's { orange, green } from the active profile.
export function getCell(spawnerId, variantId, conditionId) {
  return getActiveData()[spawnerId]?.[variantId]?.[conditionId] ?? { orange: 0, green: 0 };
}

// Write one cell of the active profile. Persists to localStorage and notifies
// all data subscribers.
export function setCell(spawnerId, variantId, conditionId, { orange, green }) {
  setActiveCell(spawnerId, variantId, conditionId, { orange, green });
}

// Subscribe to active-profile data changes. Returns an unsubscribe function.
export function subscribe(listener) {
  return subscribeData(listener);
}
