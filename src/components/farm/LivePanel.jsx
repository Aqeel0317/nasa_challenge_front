import { useEffect, useState } from "react";
import { getLive } from "../../api.js";
import { useI18n } from "../../i18n.jsx";

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

export default function LivePanel({ lat, lon }) {
  const { t, lang } = useI18n();
  const { live, failed } = useLive(lat, lon);

  const locale = lang === "ur" ? "ur-PK" : "en-GB";
  const fmt = (iso, o = { day: "numeric", month: "short" }) => new Date(`${iso}T00:00:00`).toLocaleDateString(locale, o);
  const days = live?.data?.weather?.days || [];
  const events = live?.data?.events || [];

  if (!live && failed) return null;
  if (!live) {
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
  const hotDays = week.filter((d) => d.tmax >= 40).length;
  const soilWord = soil == null ? null : soil < 30 ? "soil_dry" : soil < 60 ? "soil_ok" : "soil_wet";
  const alert = hotDays >= 3 ? t("live_alert_hot", { n: hotDays })
    : rain < 2 && soil != null && soil < 35 ? t("live_alert_dry", { n: days.length }) : null;
  const maxT = Math.max(...week.map((d) => d.tmax), 1);

  return (
    <section className="live" aria-labelledby="live-title">
      <header className="live-head">
        <h2 id="live-title"><span className="live-dot" aria-hidden="true" />{t("live_title")}</h2>
        <span className="live-meta">
          {days.length ? t("live_updated", { date: fmt(days[days.length - 1].date) }) : t("live_off")}
          {" · "}{t("live_src")}
        </span>
      </header>

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
            {soil != null && <li className={soilWord}>💧 {t("live_soil", { pct: soil })} · {t(soilWord)}</li>}
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
