// The farmer's farm, in one place: where it is, how much water it gets, and what is
// grown on which fields. Every page (Today, My fields, the planner, the top bar) reads
// and writes this one store, so a change on one page is the same everywhere at once
// and survives a reload.
import { useEffect, useState } from "react";
import { FARM_DEFAULTS } from "./farmCache.js";
import { setFarmerPrices } from "./components/farm/farmUtils.js";

const KEY = "aapkakhet-farm-v2";
// Seasonal irrigation (mm) behind each water choice; the planner's engine uses mm.
export const IRRIGATION_MM = { rainfed: 0, deficit: 300, full: 600 };
export const irrigationFromMm = (mm) =>
  Object.entries(IRRIGATION_MM).reduce((a, b) => (Math.abs(b[1] - mm) < Math.abs(a[1] - mm) ? b : a))[0];

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...FARM_DEFAULTS, ...JSON.parse(raw) } : { ...FARM_DEFAULTS };
  } catch {
    return { ...FARM_DEFAULTS };
  }
}

let current = typeof window === "undefined" ? { ...FARM_DEFAULTS } : read();
setFarmerPrices(current.prices);
const listeners = new Set();

export function getProfile() { return current; }

export function setProfile(update) {
  const next = { ...FARM_DEFAULTS, ...(typeof update === "function" ? update(current) : { ...current, ...update }) };
  // keep the two ways of saying "water" in step
  if (next.irrigation !== current.irrigation && next.irrigation_mm === current.irrigation_mm) next.irrigation_mm = IRRIGATION_MM[next.irrigation];
  else if (next.irrigation_mm !== current.irrigation_mm && next.irrigation === current.irrigation && next.irrigation_mm != null) next.irrigation = irrigationFromMm(next.irrigation_mm);
  current = next;
  setFarmerPrices(current.prices);
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* blocked: keep in memory */ }
  listeners.forEach((fn) => fn(current));
}

export const totalAcres = (p) => (p.fields || []).reduce((s, f) => s + (+f.acres || 0), 0);
export const irrigationMm = (p) => (p.irrigation_mm ?? IRRIGATION_MM[p.irrigation] ?? 300);

// React hook: [profile, setProfile], kept in sync across components and browser tabs.
export function useFarmProfile() {
  const [p, setP] = useState(current);
  useEffect(() => {
    listeners.add(setP);
    const onStorage = (e) => { if (e.key === KEY) { current = read(); setP(current); } };
    window.addEventListener("storage", onStorage);
    setP(current);
    return () => { listeners.delete(setP); window.removeEventListener("storage", onStorage); };
  }, []);
  return [p, setProfile];
}
