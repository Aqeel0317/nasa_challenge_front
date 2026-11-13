import { useI18n } from "../../i18n.jsx";
import { useLive } from "../farm/LivePanel.jsx";

// Hero picture: four crop fields seen from above at an angle, a NASA satellite
// scanning them, and floating cards with the latest real NASA POWER readings for a
// farm near Faisalabad. Motion is transform/opacity only, so it stays smooth on phones.
const DEMO = { lat: 31.42, lon: 73.08 };
const PLOTS = ["wheat", "cotton", "rice", "mustard"];

export default function HeroField() {
  const { t, lang } = useI18n();
  const { live } = useLive(DEMO.lat, DEMO.lon);
  const days = live?.data?.weather?.days || [];
  const last = days[days.length - 1];
  const soil = [...days].reverse().find((d) => d.soil != null)?.soil;
  const rain = days.reduce((s, d) => s + (d.rain || 0), 0);
  const when = last ? new Date(`${last.date}T00:00:00`).toLocaleDateString(lang === "ur" ? "ur-PK" : "en-GB", { day: "numeric", month: "short" }) : "";

  const chips = [
    { k: "temp", icon: "🌡️", value: last ? `${Math.round(last.tmax)}°C` : "–", hot: last && last.tmax >= 40 },
    { k: "soil", icon: "💧", value: soil != null ? `${soil}%` : "–", hot: soil != null && soil < 30 },
    { k: "rain", icon: "🌧️", value: days.length ? `${Math.round(rain)} mm` : "–", hot: days.length && rain < 2 },
  ];

  return (
    <div className="hf" aria-hidden="true">
      <div className="hf-aurora" />
      <div className="hf-stage">
        <div className="hf-ground">
          {PLOTS.map((p) => <div key={p} className={`hf-plot hf-${p}`}><i /></div>)}
          <div className="hf-scan" />
          <div className="hf-canal hf-canal-x" />
          <div className="hf-canal hf-canal-y" />
        </div>
      </div>

      <div className="hf-sat">
        <svg viewBox="0 0 120 70" width="120" height="70">
          <rect x="4" y="27" width="34" height="16" rx="2" fill="#1f5f8a" stroke="#8fd0ff" strokeOpacity=".5" />
          <path d="M10 27v16M17 27v16M24 27v16M31 27v16" stroke="#8fd0ff" strokeOpacity=".35" />
          <rect x="82" y="27" width="34" height="16" rx="2" fill="#1f5f8a" stroke="#8fd0ff" strokeOpacity=".5" />
          <path d="M89 27v16M96 27v16M103 27v16M110 27v16" stroke="#8fd0ff" strokeOpacity=".35" />
          <rect x="38" y="33" width="44" height="4" fill="#9aa7b0" />
          <rect x="47" y="20" width="26" height="30" rx="5" fill="#e9eef2" />
          <rect x="47" y="20" width="26" height="9" rx="4" fill="#c8f56a" />
          <circle cx="60" cy="56" r="5" fill="#cfd8de" />
          <circle className="hf-blink" cx="60" cy="56" r="2.2" fill="#ff5a4a" />
        </svg>
        <div className="hf-beam" />
      </div>

      <div className="hf-chips">
        <div className="hf-live"><span className="hf-dot" />{t("hero_live")}{when && <> · <bdi>{when}</bdi></>}</div>
        {chips.map((c, i) => (
          <div key={c.k} className={`hf-chip hf-chip-${i + 1} ${c.hot ? "is-alert" : ""}`}>
            <span className="hf-ic">{c.icon}</span>
            <span className="hf-val"><bdi>{c.value}</bdi></span>
            <span className="hf-lbl">{t(`hero_${c.k}`)}</span>
          </div>
        ))}
        <div className="hf-place">📍 {t("hero_place")}</div>
      </div>
    </div>
  );
}
