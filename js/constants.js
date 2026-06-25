// constants.js
// Central place for the data that describes the app: which spawners exist,
// which viewing conditions runners log, the three spawner layout variants,
// the silverfish cheatsheet pies, and the shared pie colors.

// All spawner types (single + combination rooms). `id` is used as a stable key
// in saved state; `label` is shown in the UI.
export const SPAWNERS = [
  { id: "silverfish",  label: "Silverfish" },
  { id: "caveSpider",  label: "Cave Spider" },
  { id: "spider",      label: "Spider" },
  { id: "zombie",      label: "Zombie" },
  { id: "skeleton",    label: "Skeleton" },
  { id: "sf_spider",   label: "Silverfish + Spider" },
  { id: "sf_zombie",   label: "Silverfish + Zombie" },
  { id: "sf_skeleton", label: "Silverfish + Skeleton" },
];

// The three spawner layout variants logged per spawner type.
// Every spawner has the same three options because the surrounding room geometry
// (just the spawner, a chest in front, or a chest behind) is what changes the
// pie spike regardless of mob type.
export const VARIANTS = [
  { id: "pure",        label: "Pure Spawner" },
  { id: "chestFront",  label: "Chest in Front" },
  { id: "chestBehind", label: "Chest Behind" },
];

// The four pie charts logged per spawner per variant: every combination of
// whether the runner is hovering the entity and whether hitboxes (F3+B) are on.
export const CONDITIONS = [
  { id: "noHover_hitbox",   label: "No Hover · Hitboxes" },
  { id: "noHover_noHitbox", label: "No Hover · No Hitboxes" },
  { id: "hover_hitbox",     label: "Hovering · Hitboxes" },
  { id: "hover_noHitbox",   label: "Hovering · No Hitboxes" },
];

// Pairs of conditions for which a hitbox-delta column is generated in the
// comparison table. `a` is the "hitboxes on" condition, `b` is "hitboxes off".
export const DELTA_PAIRS = [
  { id: "noHoverDelta", label: "Δ No Hover", a: "noHover_hitbox", b: "noHover_noHitbox" },
  { id: "hoverDelta",   label: "Δ Hovering", a: "hover_hitbox",   b: "hover_noHitbox" },
];

// The three silverfish spawner spikes used by the cheatsheet generator.
// `key` matches the number-input id suffix in index.html.
export const SILVERFISH_TYPES = [
  { key: 0, label: "Only Spawner" },
  { key: 1, label: "Chest in Front" },
  { key: 2, label: "Chest Behind" },
];

// Pie slice fill colors (the wedges painted on canvas).
export const PIE_FILL = {
  orange: "#e76f51",
  pink:   "#d84bbf",
  green:  "#4cc96c",
};

// Pie number-label colors (the text overlaid on the cheatsheet generator pies).
export const PIE_TEXT = {
  orange: "#f3a94e",
  pink:   "#e88cff",
  green:  "#45cc65",
};

// Cheatsheet pie centres on the 840x520 main canvas — one per silverfish type,
// laid out in a horizontal row. Tune these X/Y values to match the template
// image once a 3-slot version replaces the current placeholder.
export const PIE_POSITIONS = [
  [140, 300],
  [420, 300],
  [700, 300],
];

export const PIE_RADIUS = 100;
