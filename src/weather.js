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
  const [fc, setFc] = useState(() => read(key)?.data || null);
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
  }, [key, lat, lon]);
  return fc;
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
