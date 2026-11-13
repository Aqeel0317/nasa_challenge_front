// Shared layout, crop facts and colour scales for the 2D map and the 3D farm.

// The farm is up to four square fields in a 2 x 2 grid, with a watercourse
// between them. Each field is one rotation: a kharif crop, then a rabi crop.
// The farmhouse and tube-well stand beside the fields.
export const PLOT = 44;                      // field side, metres
const GAP = 8;
export const FARM_W = 2 * PLOT + GAP;        // 96 m
export const FARM_H = 2 * PLOT + GAP;        // 96 m
export const SITE_W = FARM_W + 34;           // fields + yard with farmhouse and tube-well
export const FARMHOUSE = { x: FARM_W + 8, y: 6 };
export const TUBEWELL = { x: FARM_W + 8, y: PLOT + GAP + 8 };
export const fieldPos = (i) => ({ x: (i % 2) * (PLOT + GAP), y: Math.floor(i / 2) * (PLOT + GAP) });

export const MAX_FIELDS = 4;
export const KHARIF_ORDER = ["cotton", "rice", "maize", "sorghum", "pearl_millet",
  "mung_bean", "soybean", "guar", "sunflower", "sesbania"];
export const RABI_ORDER = ["wheat", "barley", "oats", "mustard",
  "chickpea", "lentil", "berseem", "potato"];
export const DEFAULT_FIELDS = [
  { kharif: "cotton", rabi: "wheat", acres: 4 },
  { kharif: "rice", rabi: "wheat", acres: 3 },
  { kharif: "mung_bean", rabi: "wheat", acres: 2 },
  { kharif: "sesbania", rabi: "chickpea", acres: 2 },
];

// Picture for each crop, so a farmer can find it without reading.
export const CROP_ICON = {
  cotton: "☁️", rice: "🍚", maize: "🌽", sorghum: "🌾", pearl_millet: "🌾", mung_bean: "🌱",
  soybean: "🌱", guar: "🌿", sunflower: "🌻", sesbania: "🌿", wheat: "🌾", barley: "🌾",
  oats: "🌱", mustard: "🌼", chickpea: "🟡", lentil: "🟠", berseem: "☘️", potato: "🥔",
};
// Legumes fix nitrogen from the air and leave the soil richer for the next crop.
export const NITROGEN_FIXERS = new Set(["mung_bean", "soybean", "guar", "sesbania", "chickpea", "lentil", "berseem"]);

// Rough Pakistani market prices, rupees per 40 kg maund (2025). Fodder is valued as
// dry fodder; green manure is ploughed in, not sold. For a sense of scale only.
export const PRICE_PER_MAUND = {
  cotton: 8500, rice: 3800, maize: 2600, sorghum: 2600, pearl_millet: 2800, mung_bean: 9000,
  soybean: 6500, guar: 8000, sunflower: 6500, sesbania: 0, wheat: 3500, barley: 2800,
  oats: 900, mustard: 7000, chickpea: 9500, lentil: 11000, berseem: 900, potato: 1600,
};
// 1 t/ha = 1000 kg / 40 kg per maund / 2.471 acres per hectare
export const MAUND_PER_ACRE = 10.12;

// Value in rupees of a yield (t/ha) on a number of acres
export const rupees = (crop, tha, acres) => tha * MAUND_PER_ACRE * acres * (PRICE_PER_MAUND[crop] ?? 0);

// "Rs 4.2 lakh" / "4.2 لاکھ روپے": the way farmers talk about money
export function formatRs(v, lang) {
  const a = Math.abs(v);
  const ur = lang === "ur";
  let n, unit = "";
  if (a >= 1e7) { n = (a / 1e7).toFixed(1); unit = ur ? " کروڑ" : " crore"; }
  else if (a >= 1e5) { n = (a / 1e5).toFixed(1); unit = ur ? " لاکھ" : " lakh"; }
  else n = Math.round(a).toLocaleString("en-US");
  n = n.replace(/\.0$/, "");
  return ur ? `${n}${unit} روپے` : `Rs ${n}${unit}`;
}

// Which crop is in a field on a given day: the one growing, otherwise the stubble
// of the last harvest, otherwise nothing (bare soil).
export function activeCrop(field, byKey, day) {
  const ks = [field.kharif, field.rabi].filter((k) => k && byKey[k]);
  const growing = ks.find((k) => { const s = byKey[k].scenario.stage[day]; return s >= 0 && s <= 3; });
  if (growing) return { key: growing, growing: true };
  const done = ks.filter((k) => byKey[k].scenario.stage[day] === 4)
    .sort((a, b) => byKey[b].harvest_date.localeCompare(byKey[a].harvest_date));
  return done.length ? { key: done[0], growing: false } : { key: null, growing: false };
}

// Days in the farm year when nothing grows in the field (bare soil erodes and loses water)
export function bareDays(field, byKey, n) {
  let bare = 0;
  for (let d = 0; d < n; d += 1) if (!activeCrop(field, byKey, d).growing) bare += 1;
  return bare;
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
