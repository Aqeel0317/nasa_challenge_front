import { useEffect, useState } from "react";
import { getLive } from "../../api.js";
import { useI18n } from "../../i18n.jsx";
import { Term } from "./Glossary.jsx";
import { useForecast, weatherLook } from "../../weather.js";

// Live from NASA: the last days of NASA POWER weather at the field, and open natural
// events from NASA EONET in the region. The last answer is kept in the browser so it
// shows at once; it refreshes every 30 minutes.
const FRESH_MS = 30 * 60 * 1000;
const EVENT_ICON = {
  wildfires: "🔥", severeStorms: "🌀", floods: "🌊", volcanoes: "🌋", dustHaze: "🌫️", drought: "🏜️",
  landslides: "⛰️", seaLakeIce: "🧊", snow: "❄️", tempExtremes: "🌡️", earthquakes: "📳", manmade: "🏭",
};

const storeKey = (lat, lon) => `aapkakhet-live:${(+lat).toFixed(2)},${(+lon).toFixed(2)}`;
function readLive(lat, lon) {
  try { return JSON.parse(localStorage.getItem(storeKey(lat, lon)) || "null"); } catch { return null; }
}

// Latest NASA data for a place: the saved copy at once, then a fresh one if it is old.
export function useLive(lat, lon) {
  const [live, setLive] = useState(() => readLive(lat, lon));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const cached = readLive(lat, lon);
    setLive(cached);
    setFailed(false);
    if (cached && Date.now() - cached.at < FRESH_MS) return undefined;
    let alive = true;
    const timer = setTimeout(() => {
      getLive(lat, lon).then((data) => {
        if (!alive) return;
        const entry = { at: Date.now(), data };
        setLive(entry);
        try { localStorage.setItem(storeKey(lat, lon), JSON.stringify(entry)); } catch { /* full */ }
      }).catch(() => { if (alive) setFailed(true); });
    }, 300);
    return () => { alive = false; clearTimeout(timer); };
  }, [lat, lon]);
  return { live, failed };
}

// Today's weather and the week ahead (Open-Meteo forecast), with practical alerts.
function TodayBlock({ fc }) {
  const { t, lang } = useI18n();
  const c = fc.current, d = fc.daily;
  const locale = lang === "ur" ? "ur-PK" : "en-GB";
  const [icon, word] = weatherLook(c.weather_code, c.is_day);
  const rain3 = d.precipitation_sum.slice(0, 3).reduce((a, b) => a + (b || 0), 0);
  const hotAhead = d.temperature_2m_max.filter((x) => x >= 40).length;
  const tips = [];
  if (rain3 >= 5) tips.push(["🌧️", t("fc_rain_alert", { mm: Math.round(rain3) })]);
  if (hotAhead) tips.push(["🔥", t("fc_heat_alert", { n: hotAhead })]);
  if (!rain3 && !hotAhead && d.precipitation_probability_max.every((p) => (p ?? 0) < 20)) tips.push(["☀️", t("fc_dry_alert")]);
  return (
    <div className="today">
      <div className="today-now">
        <span className="today-ic" aria-hidden="true">{icon}</span>
        <div>
          <p className="today-k">{t("todayLabel")}</p>
          <p className="today-t"><bdi>{Math.round(c.temperature_2m)}°C</bdi></p>
          <p className="today-w">{t(word)}</p>
        </div>
        <ul className="today-facts">
          <li>🌡️ {t("feelsLike", { t: Math.round(c.apparent_temperature) })}</li>
          <li>💧 {t("humidity", { pct: Math.round(c.relative_humidity_2m) })}</li>
          <li>💨 {t("wind", { kmh: Math.round(c.wind_speed_10m) })}</li>
          <li>☔ {t("rainChance", { pct: d.precipitation_probability_max[0] ?? 0 })}</li>
        </ul>
      </div>
      <div className="fc-week" dir="ltr" aria-label={t("next7")}>
        {d.time.map((iso, i) => {
          const [ic] = weatherLook(d.weather_code[i]);
          return (
            <div key={iso} className={`fc-day ${d.temperature_2m_max[i] >= 40 ? "is-hot" : ""}`}>
              <span className="fc-d">{i === 0 ? t("todayShort") : new Date(`${iso}T00:00:00`).toLocaleDateString(locale, { weekday: "short" })}</span>
              <span className="fc-ic" aria-hidden="true">{ic}</span>
              <span className="fc-max"><bdi>{Math.round(d.temperature_2m_max[i])}°</bdi></span>
              <span className="fc-min"><bdi>{Math.round(d.temperature_2m_min[i])}°</bdi></span>
              <span className="fc-p">{(d.precipitation_probability_max[i] ?? 0) >= 20 ? `${d.precipitation_probability_max[i]}%` : ""}</span>
            </div>
          );
        })}
      </div>
      {tips.map(([ic, txt]) => <p key={txt} className="fc-alert">{ic} {txt}</p>)}
      <p className="live-meta">{t("fc_src")}</p>
    </div>
  );
}

export default function LivePanel({ lat, lon, place }) {
  const { t, lang } = useI18n();
  const { live, failed } = useLive(lat, lon);
  const fc = useForecast(lat, lon);

  const locale = lang === "ur" ? "ur-PK" : "en-GB";
  const fmt = (iso, o = { day: "numeric", month: "short" }) => new Date(`${iso}T00:00:00`).toLocaleDateString(locale, o);
  const days = live?.data?.weather?.days || [];
  const events = live?.data?.events || [];

  if (!live && !fc && failed) return null;
  if (!live && !fc) {
    return (
      <section className="live live-loading" aria-busy="true">
        <span className="live-dot" aria-hidden="true" /> {t("live_loading")}
      </section>
    );
  }

  const week = days.slice(-7);
  const hottest = days.reduce((a, d) => (d.tmax > (a?.tmax ?? -99) ? d : a), null);
  const rain = days.reduce((s, d) => s + (d.rain || 0), 0);
  const soil = [...days].reverse().find((d) => d.soil != null)?.soil;
  const smap = live?.data?.smap;
  const hotDays = week.filter((d) => d.tmax >= 40).length;
  const soilWord = soil == null ? null : soil < 30 ? "soil_dry" : soil < 60 ? "soil_ok" : "soil_wet";
  const alert = hotDays >= 3 ? t("live_alert_hot", { n: hotDays })
    : rain < 2 && soil != null && soil < 35 ? t("live_alert_dry", { n: days.length }) : null;
  const maxT = Math.max(...week.map((d) => d.tmax), 1);

  return (
    <section className="live" aria-labelledby="live-title">
      <header className="live-head">
        <h2 id="live-title"><span className="live-dot" aria-hidden="true" />{t("live_title2")}</h2>
        {place && <span className="live-place">📍 <bdi>{place}</bdi></span>}
      </header>

      {fc?.current && fc?.daily && <TodayBlock fc={fc} />}

      <div className="live-sub">
        <h3>🛰️ {t("live_past")}</h3>
        <span className="live-meta">
          {days.length ? t("live_updated", { date: fmt(days[days.length - 1].date) }) : t("live_off")}
          {" · "}{t("live_src")}
        </span>
      </div>

      {days.length > 0 && (
        <div className="live-body">
          <div className="live-week" dir="ltr" aria-label={t("live_week")}>
            {week.map((d) => (
              <div key={d.date} className={`live-day ${d.tmax >= 40 ? "is-hot" : ""}`}>
                <span className="live-t"><bdi>{Math.round(d.tmax)}°</bdi></span>
                <span className="live-bar" aria-hidden="true"><i style={{ blockSize: `${Math.max(8, (100 * d.tmax) / maxT)}%` }} /></span>
                <span className="live-r">{d.rain ? `${d.rain}` : "–"}</span>
                <span className="live-d">{fmt(d.date, { weekday: "short" })}</span>
              </div>
            ))}
          </div>
          <ul className="live-facts">
            {hottest && <li>🌡️ {t("live_hottest", { t: Math.round(hottest.tmax), date: fmt(hottest.date) })}</li>}
            <li>🌧️ {t("live_rain", { mm: Math.round(rain), n: days.length })}</li>
            {soil != null && <li className={soilWord}>💧 {t("live_soil", { pct: soil })} · {t(soilWord)} <Term k="sma" /></li>}
            {smap && (
              <li>🛰️ {t("live_smap", { v: smap.value.toFixed(2), date: fmt(smap.date) })}{" "}
                <a href={smap.url} target="_blank" rel="noopener noreferrer" className="src-link">NASA SMAP</a></li>
            )}
          </ul>
        </div>
      )}
      {alert && <p className="live-alert" role="status">⚠️ {alert}</p>}

      <div className="live-events">
        <h3>🛰️ {t("live_events")}</h3>
        {events.length ? (
          <ul>
            {events.map((e) => (
              <li key={e.title + e.date}>
                <span className="ev-icon" aria-hidden="true">{EVENT_ICON[e.category] || "📍"}</span>
                <span className="ev-title">{e.link ? <a href={e.link} target="_blank" rel="noreferrer">{e.title}</a> : e.title}</span>
                <span className="ev-km"><bdi>{t("live_km", { km: e.km.toLocaleString("en-US") })}</bdi></span>
              </li>
            ))}
          </ul>
        ) : <p className="muted small">{t("live_none")}</p>}
      </div>
    </section>
  );
}
