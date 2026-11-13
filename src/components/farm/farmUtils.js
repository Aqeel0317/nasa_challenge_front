// Shared layout and colour scales for the 2D map and the 3D farm.

// The farm is a 5-column grid of 28 m plots: two rows of kharif (summer) crops,
// a farm road, then two rows of rabi (winter) crops. The two spare cells in the
// rabi rows hold the farmhouse and the tube-well.
export const PLOT = 28;
const GAP = 5;
const ROAD = 10;
const COLS = 5;
export const KHARIF_ORDER = ["cotton", "rice", "maize", "sorghum", "pearl_millet",
  "mung_bean", "soybean", "guar", "sunflower", "sesbania"];
export const RABI_ORDER = ["wheat", "barley", "oats", "mustard",
  "chickpea", "lentil", "berseem", "potato"];
export const FARM_W = COLS * PLOT + (COLS - 1) * GAP;          // 160 m
export const FARM_H = 4 * PLOT + 2 * GAP + ROAD;              // 132 m

const rowY = (row) => row * (PLOT + GAP) + (row >= 2 ? ROAD - GAP : 0);
const colX = (col) => col * (PLOT + GAP);

export const LAYOUT = {};
KHARIF_ORDER.forEach((k, i) => { LAYOUT[k] = { x: colX(i % COLS), y: rowY(Math.floor(i / COLS)) }; });
RABI_ORDER.forEach((k, i) => { LAYOUT[k] = { x: colX(i % 4), y: rowY(2 + Math.floor(i / 4)) }; });
export const FARMHOUSE = { x: colX(4), y: rowY(2) };
export const TUBEWELL = { x: colX(4), y: rowY(3) };
export const ROAD_Y = rowY(1) + PLOT + (ROAD - GAP) / 2 + GAP / 2;  // centre line of the farm road

// Crops not in the layout (added to the registry later) go on an extra row.
export function plotPos(key, index = 0) {
  return LAYOUT[key] || { x: colX(index % COLS), y: rowY(4) + (PLOT + GAP) * Math.floor(index / COLS) };
}

export const METRICS = ["ndvi", "soil_water", "stress", "heat"];

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
function ramp(stops, t) {
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const a = hex(stops[i]), b = hex(stops[i + 1]), f = x - i;
  return toHex(a.map((v, k) => v + (b[k] - v) * f));
}

export const SCALES = {
  ndvi: { stops: ["#b9925f", "#cdbf6a", "#7fae4a", "#3f8a3a", "#1f5e2b"], min: 0.1, max: 0.9 },
  soil_water: { stops: ["#d8b47a", "#b7c9a8", "#6fa3c4", "#2f6f9c"], min: 0, max: 100 },
  stress: { stops: ["#4f9a52", "#d9c24a", "#e08a3a", "#c2412d"], min: 0, max: 1 },
  heat: { stops: ["#efe6cf", "#f0b44c", "#e0672f", "#a8231d"], min: 0, max: 1 },
};

export function metricValue(plot, metric, day) {
  const s = plot.scenario.series;
  if (metric === "stress") return s.ks[day] == null ? null : 1 - s.ks[day];
  const v = s[metric]?.[day];
  return v == null ? null : v;
}

export function metricColor(metric, value) {
  const sc = SCALES[metric];
  return ramp(sc.stops, (value - sc.min) / (sc.max - sc.min));
}

export function formatMetric(metric, value) {
  if (value == null) return "–";
  if (metric === "soil_water") return `${Math.round(value)}%`;
  if (metric === "ndvi") return value.toFixed(2);
  return `${Math.round(value * 100)}%`;
}

// Stage index from the API: -1 not sown, 0..3 growing, 4 harvested
export const STAGE_KEYS = ["initial", "development", "mid", "late"];
export function stageOf(plot, day) {
  return plot.scenario.stage[day];
}

// Progress (0..1) through the late stage: drives ripening colours.
export function ripeness(plot, day) {
  const st = plot.scenario.stage;
  if (st[day] !== 3) return st[day] === 4 ? 1 : 0;
  let first = day, last = day;
  while (first > 0 && st[first - 1] === 3) first -= 1;
  while (last < st.length - 1 && st[last + 1] === 3) last += 1;
  return (day - first) / Math.max(1, last - first);
}
