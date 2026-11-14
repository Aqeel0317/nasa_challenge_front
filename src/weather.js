// Free, key-less services called straight from the browser:
//  - Open-Meteo forecast: today's weather and the next 7 days
//  - Open-Meteo geocoding: find a village, town or district by name
//  - BigDataCloud reverse geocoding: a place name for the phone's GPS position
// Results are kept in localStorage so they show instantly next time.
import { useEffect, useState } from "react";

const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* full */ } };

const FORECAST_MS = 30 * 60 * 1000;
export function useForecast(lat, lon) {
  const key = `aapkakhet-fc:${(+lat).toFixed(2)},${(+lon).toFixed(2)}`;
  // data is tagged with its place: a forecast is never shown for another location
  const [state, setState] = useState(() => ({ key, data: read(key)?.data || null }));
  const setFc = (data) => setState({ key, data });
  useEffect(() => {
    const cached = read(key);
    setFc(cached?.data || null);
    if (cached && Date.now() - cached.at < FORECAST_MS) return undefined;
    let alive = true;
    const url = "https://api.open-meteo.com/v1/forecast?" + new URLSearchParams({
      latitude: lat, longitude: lon, timezone: "auto", forecast_days: "7",
      current: "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,precipitation,is_day",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max",
    });
    fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(r.status))).then((data) => {
      if (!alive) return;
      write(key, { at: Date.now(), data });
      setFc(data);
    }).catch(() => {});
    return () => { alive = false; };
  }, [key, lat, lon]); // eslint-disable-line react-hooks/exhaustive-deps
  return state.key === key ? state.data : null;
}

// WMO weather codes -> picture and a translation key
export function weatherLook(code, isDay = 1) {
  if (code === 0) return [isDay ? "☀️" : "🌙", "wx_clear"];
  if (code <= 2) return [isDay ? "🌤️" : "☁️", "wx_partly"];
  if (code === 3) return ["☁️", "wx_cloudy"];
  if (code <= 48) return ["🌫️", "wx_fog"];
  if (code <= 57) return ["🌦️", "wx_drizzle"];
  if (code <= 65 || (code >= 80 && code <= 81)) return ["🌧️", "wx_rain"];
  if (code <= 67 || code === 82) return ["🌧️", "wx_heavyrain"];
  if (code <= 77 || code === 85 || code === 86) return ["🌨️", "wx_snow"];
  return ["⛈️", "wx_storm"];
}

export async function searchPlaces(q, lang) {
  const base = "https://geocoding-api.open-meteo.com/v1/search?";
  const get = (extra) => fetch(base + new URLSearchParams({ name: q, count: "8", language: lang === "ur" ? "ur" : "en", format: "json", ...extra }))
    .then((r) => r.json()).then((j) => j.results || []);
  // Prefer places in Pakistan; fall back to the whole world.
  let res = await get({ countryCode: "PK" });
  if (!res.length) res = await get({});
  return res.map((p) => ({
    name: p.name, lat: +p.latitude.toFixed(3), lon: +p.longitude.toFixed(3),
    area: [p.admin2, p.admin1, p.country_code !== "PK" ? p.country : null].filter(Boolean).join(", "),
  }));
}

export async function placeName(lat, lon, lang) {
  try {
    const r = await fetch("https://api.bigdatacloud.net/data/reverse-geocode-client?" + new URLSearchParams({
      latitude: lat, longitude: lon, localityLanguage: lang === "ur" ? "ur" : "en",
    }));
    const j = await r.json();
    return [j.locality || j.city, j.principalSubdivision].filter(Boolean).join(", ") || null;
  } catch { return null; }
}

// Main farming districts, for one-tap choice
export const QUICK_PLACES = [
  { name: "Faisalabad", ur: "فیصل آباد", lat: 31.42, lon: 73.08 },
  { name: "Multan", ur: "ملتان", lat: 30.2, lon: 71.47 },
  { name: "Lahore", ur: "لاہور", lat: 31.55, lon: 74.34 },
  { name: "Bahawalpur", ur: "بہاولپور", lat: 29.4, lon: 71.68 },
  { name: "Sahiwal", ur: "ساہیوال", lat: 30.66, lon: 73.11 },
  { name: "Rahim Yar Khan", ur: "رحیم یار خان", lat: 28.42, lon: 70.3 },
  { name: "Sukkur", ur: "سکھر", lat: 27.7, lon: 68.86 },
  { name: "Hyderabad", ur: "حیدرآباد", lat: 25.4, lon: 68.37 },
  { name: "Larkana", ur: "لاڑکانہ", lat: 27.56, lon: 68.21 },
  { name: "Peshawar", ur: "پشاور", lat: 34.01, lon: 71.58 },
  { name: "D.I. Khan", ur: "ڈیرہ اسماعیل خان", lat: 31.83, lon: 70.9 },
  { name: "Gujranwala", ur: "گوجرانوالہ", lat: 32.16, lon: 74.19 },
];

// The place name to show for a field: a known district in the current language,
// else the saved name, else the coordinates.
export function fieldLabel(form, lang) {
  const q = QUICK_PLACES.find((p) => Math.abs(p.lat - form.lat) < 0.02 && Math.abs(p.lon - form.lon) < 0.02);
  if (q) return lang === "ur" ? q.ur : q.name;
  return form.place || `${(+form.lat).toFixed(2)}, ${(+form.lon).toFixed(2)}`;
}

// Pick the scenario that matches this week's real weather: the 7-day forecast plus
// the last two weeks of NASA POWER. Returns the scenario and why it was chosen.
export function autoScenario(fc, nasaDays = []) {
  const d = fc?.daily;
  const hotFc = d ? d.temperature_2m_max.filter((x) => x >= 40).length : 0;
  const hotNasa = nasaDays.slice(-7).filter((x) => x.tmax >= 40).length;
  const rain7 = d ? d.precipitation_sum.reduce((a, b) => a + (b || 0), 0) : 0;
  const rainMax = d ? Math.max(0, ...d.precipitation_sum.map((x) => x || 0)) : 0;
  const pastRain = nasaDays.reduce((a, x) => a + (x.rain || 0), 0);
  const soil = [...nasaDays].reverse().find((x) => x.soil != null)?.soil;
  if (hotFc || hotNasa >= 3) return { sc: "heatwave", why: "auto_heat", p: { n: Math.max(hotFc, hotNasa) } };
  if (rain7 >= 50 || rainMax >= 30) return { sc: "flood", why: "auto_flood", p: { mm: Math.round(rain7) } };
  if (nasaDays.length >= 10 && pastRain < 2 && soil != null && soil < 30 && rain7 < 5) {
    return { sc: "drought", why: "auto_drought", p: { n: nasaDays.length, pct: soil } };
  }
  return { sc: "normal", why: "auto_normal", p: {} };
}
