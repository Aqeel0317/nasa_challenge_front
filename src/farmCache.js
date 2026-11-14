// Farm simulator defaults and a small browser cache of results, so the farm opens
// instantly with the last answer while a fresh one loads in the background.
import { simulateFarm } from "./api.js";
import { DEFAULT_FIELDS } from "./components/farm/farmUtils.js";

// The last farm year (May-April) that is complete, so NASA POWER has every day.
const now = new Date();
export const LAST_YEAR = now.getFullYear() - (now.getMonth() >= 5 ? 1 : 2);
// The farm year that is running now (it starts on 1 May): simulated from NASA
// observations so far, the forecast, then NASA climate normals.
export const CURRENT_YEAR = now.getFullYear() - (now.getMonth() >= 4 ? 0 : 1);

export const FARM_DEFAULTS = {
  lat: 31.42, lon: 73.08, place: "Faisalabad", year: CURRENT_YEAR, scenario: "normal", scenarioMode: "auto",
  irrigation: "deficit", temp_offset: 2, rain_pct: 60, fields: DEFAULT_FIELDS,
};

// What is sent to the API. Field size only changes the money, so it is left out.
export function farmRequest(settings) {
  const s = { ...FARM_DEFAULTS, ...settings };
  return {
    lat: s.lat, lon: s.lon, year: s.yearChosen ? s.year : CURRENT_YEAR, scenario: s.scenario, irrigation: s.irrigation,
    temp_offset: s.temp_offset, rain_pct: s.rain_pct,
    fields: (s.fields?.length ? s.fields : DEFAULT_FIELDS).map(({ kharif, rabi }) => ({ kharif, rabi })),
  };
}

const PREFIX = "aapkakhet-sim:";
const INDEX = "aapkakhet-sim-index";
const KEEP = 4;           // results kept; each is roughly 150 KB
const FRESH_MS = 6 * 3600 * 1000;

const keyOf = (body) => PREFIX + JSON.stringify(body);

// Storage can be missing or full (private windows, old phones): never let that break the page.
export function readCached(body) {
  try {
    const raw = localStorage.getItem(keyOf(body));
    if (!raw) return null;
    const { at, data } = JSON.parse(raw);
    return { data, fresh: Date.now() - at < FRESH_MS };
  } catch { return null; }
}

function writeCached(body, data) {
  const key = keyOf(body);
  const payload = JSON.stringify({ at: Date.now(), data });
  try {
    const index = JSON.parse(localStorage.getItem(INDEX) || "[]").filter((k) => k !== key);
    index.unshift(key);
    index.slice(KEEP).forEach((k) => localStorage.removeItem(k));
    localStorage.setItem(INDEX, JSON.stringify(index.slice(0, KEEP)));
    localStorage.setItem(key, payload);
  } catch {
    // Full: drop everything we stored and try once more with just this result.
    try {
      JSON.parse(localStorage.getItem(INDEX) || "[]").forEach((k) => localStorage.removeItem(k));
      localStorage.setItem(INDEX, JSON.stringify([key]));
      localStorage.setItem(key, payload);
    } catch { /* give up quietly */ }
  }
}

// One request per body at a time, shared by the landing page prefetch and the farm page.
const inflight = new Map();
export function fetchFarm(body) {
  const key = keyOf(body);
  if (!inflight.has(key)) {
    inflight.set(key, simulateFarm(body)
      .then((data) => { writeCached(body, data); return data; })
      .finally(() => inflight.delete(key)));
  }
  return inflight.get(key);
}

// Called from the landing page: wake the free-tier server and have the default farm
// ready before the farmer reaches it.
export function warmUp(stored) {
  const body = farmRequest(stored || FARM_DEFAULTS);
  const cached = readCached(body);
  if (cached?.fresh) return;
  fetchFarm(body).catch(() => { /* the farm page will try again */ });
}
