import { useEffect, useState } from "react";
import { ArrowRight, Box, Languages, Layers, Sprout } from "lucide-react";
import { useI18n } from "../i18n.jsx";
import Brand from "../components/Brand.jsx";
import LanguageSwitch from "../components/LanguageSwitch.jsx";
import FarmScene from "../components/landing/FarmScene.jsx";

// ---------- small animated pictures for the three steps ----------
function PinArt() {
  return (
    <svg viewBox="0 0 120 90" className="step-art" aria-hidden="true">
      <path d="M10 70L40 50H110L80 70Z" fill="#a7c96b" />
      <path d="M22 62h66M32 56h66" stroke="#8ab456" strokeWidth="2" />
      <path d="M40 50L20 30H90L110 50Z" fill="#e8c63e" />
      <ellipse className="pin-shadow" cx="62" cy="57" rx="8" ry="3" fill="rgba(0,0,0,.2)" />
      <g className="pin-drop">
        <path d="M62 54c-8-12-12-17-12-23a12 12 0 0 1 24 0c0 6-4 11-12 23Z" fill="#c8402e" />
        <circle cx="62" cy="31" r="4.5" fill="#fff" />
      </g>
    </svg>
  );
}
function SatelliteArt() {
  return (
    <svg viewBox="0 0 120 90" className="step-art" aria-hidden="true">
      <path d="M0 90a60 34 0 0 1 120 0Z" fill="#6fa3c4" />
      <path d="M8 90a52 26 0 0 1 104 0" fill="#8ab456" />
      <g className="orbit" style={{ transformOrigin: "60px 90px" }}>
        <g transform="translate(60 22)">
          <rect x="-7" y="-5" width="14" height="10" fill="#d0d6dc" stroke="#7b7f84" />
          <rect x="-27" y="-3" width="17" height="6" fill="#2f6f9c" /><rect x="10" y="-3" width="17" height="6" fill="#2f6f9c" />
          <path className="beam" d="M-5 6L-14 40H14L5 6Z" fill="#f8c94d" opacity=".35" />
        </g>
      </g>
    </svg>
  );
}
function PhoneArt() {
  return (
    <svg viewBox="0 0 120 90" className="step-art" aria-hidden="true">
      <rect x="38" y="4" width="44" height="82" rx="7" fill="#2d3a33" />
      <rect x="42" y="12" width="36" height="66" rx="3" fill="#f3f5f2" />
      <rect className="bar b1" x="47" y="56" width="7" height="18" rx="1.5" fill="#2f7d43" />
      <rect className="bar b2" x="57" y="48" width="7" height="26" rx="1.5" fill="#d4a23a" />
      <rect className="bar b3" x="67" y="40" width="7" height="34" rx="1.5" fill="#5f8fab" />
      <g className="sprout" style={{ transformOrigin: "60px 34px" }}>
        <path d="M60 34V22" stroke="#2f7d43" strokeWidth="2.5" />
        <path d="M60 25q-9 -1 -10 -9q8 0 10 9ZM60 22q8 -2 10 -9q-9 0 -10 9Z" fill="#4f9a52" />
      </g>
    </svg>
  );
}

// ---------- one field going round the farm year: kharif, harvest, rabi, harvest ----------
function SeasonLoop() {
  const { t } = useI18n();
  const phases = ["sow_kharif", "grow_kharif", "harvest_kharif", "sow_rabi", "grow_rabi", "harvest_rabi"];
  return (
    <div className="season-loop">
      <svg viewBox="0 0 600 170" className="season-field" aria-hidden="true">
        <path d="M0 60H600V170H0Z" className="soil-band" />
        {Array.from({ length: 22 }, (_, i) => (
          <g key={i} transform={`translate(${16 + i * 27} 150)`}>
            <g className="crop-k">
              <path d="M0 0V-46" stroke="#3e7d3a" strokeWidth="3" />
              <ellipse cx="0" cy="-50" rx="14" ry="12" fill="#4b7f3d" />
              <circle className="boll" cx="-6" cy="-54" r="4" fill="#fff" />
              <circle className="boll" cx="6" cy="-48" r="4" fill="#fff" />
            </g>
            <g className="crop-r">
              <path d="M0 0V-60" stroke="#5d9b3e" strokeWidth="2.5" />
              <ellipse className="ear" cx="0" cy="-68" rx="4" ry="11" />
            </g>
          </g>
        ))}
        <circle className="season-sun" cx="540" cy="34" r="18" />
      </svg>
      <ol className="season-steps">
        {phases.map((p, i) => (
          <li key={p} className="season-step" style={{ animationDelay: `${i * 2}s` }}>{t(`ph_${p}`)}</li>
        ))}
      </ol>
    </div>
  );
}

// The hero farm cycles through the weather a season can bring.
const MOODS = [["normal", "🌤️"], ["heatwave", "🔥"], ["flood", "🌊"], ["drought", "🏜️"]];

function useMoodCycle() {
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const id = setInterval(() => setI((k) => (k + 1) % MOODS.length), 4200);
    return () => clearInterval(id);
  }, [auto]);
  return [i, (k) => { setAuto(false); setI(k); }];
}

export default function LandingPage({ onStart }) {
  const { t } = useI18n();
  const [moodIdx, pickMood] = useMoodCycle();
  const [mood, moodIcon] = MOODS[moodIdx];
  const features = [
    { icon: Layers, key: "plans" },
    { icon: Box, key: "sim" },
    { icon: Sprout, key: "soil" },
    { icon: Languages, key: "urdu" },
  ];
  return (
    <div className="landing">
      <header className="landing-nav">
        <Brand size={34} />
        <nav className="landing-nav-end">
          <a className="landing-link" href="#how">{t("lp_howLink")}</a>
          <LanguageSwitch />
          <button type="button" className="btn btn-primary" onClick={onStart}>{t("lp_cta")}</button>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="hero-name"><bdi lang="ur">آپ کا کھیت</bdi></p>
          <p className="hero-eyebrow">{t("lp_eyebrow")}</p>
          <h1>{t("lp_title")} <span className="hero-punch">{t("lp_title2")}</span></h1>
          <p className="hero-lead">{t("lp_lead")}</p>
          <div className="hero-actions">
            <button type="button" className="btn btn-primary btn-lg" onClick={onStart}>
              <span>{t("lp_cta")}</span>
              <ArrowRight size={20} aria-hidden="true" className="flip-rtl" />
            </button>
            <a className="btn btn-lg btn-quiet" href="#how">{t("lp_secondary")}</a>
          </div>
          <p className="hero-note">{t("lp_free")}</p>
        </div>
        <div className={`hero-art hero-${mood}`}>
          <FarmScene label={t("lp_sceneLabel")} mood={mood} />
          <div className="mood-card" aria-live="polite">
            <span className="mood-tag">{t("lp_moodTag")}</span>
            <strong key={mood} className="mood-title"><span aria-hidden="true">{moodIcon}</span> {t(`mood_${mood}`)}</strong>
            <span key={`${mood}-l`} className="mood-line">{t(`mood_${mood}_line`)}</span>
          </div>
          <div className="mood-picker" role="group" aria-label={t("lp_moodTag")}>
            {MOODS.map(([m, icon], k) => (
              <button key={m} type="button" aria-pressed={k === moodIdx} onClick={() => pickMood(k)}
                      title={t(`mood_${m}`)}>
                <span aria-hidden="true">{icon}</span><span className="sr-only">{t(`mood_${m}`)}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-stats">
        <h2>{t("lp_statsTitle")}</h2>
        <div className="stat-band">
          {["people", "acres", "season"].map((k) => (
            <div key={k} className="big-stat">
              <strong><bdi>{t(`lp_stat_${k}_n`)}</bdi></strong>
              <span>{t(`lp_stat_${k}`)}</span>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-primary btn-lg btn-alarm" onClick={onStart}>
          <span>{t("lp_statsCta")}</span>
          <ArrowRight size={20} aria-hidden="true" className="flip-rtl" />
        </button>
        <p className="stats-src">{t("lp_statsSrc")}</p>
      </section>

      <section className="lp-section" id="how">
        <h2>{t("lp_howTitle")}</h2>
        <ol className="how-steps">
          {[["pin", PinArt], ["sat", SatelliteArt], ["phone", PhoneArt]].map(([k, Art], i) => (
            <li key={k} className="how-step">
              <Art />
              <span className="how-num">{i + 1}</span>
              <h3>{t(`lp_step_${k}`)}</h3>
              <p>{t(`lp_step_${k}_body`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="lp-section lp-band">
        <div className="band-copy">
          <h2>{t("lp_seasonTitle")}</h2>
          <p>{t("lp_seasonBody")}</p>
        </div>
        <SeasonLoop />
      </section>

      <section className="lp-section">
        <h2>{t("lp_featTitle")}</h2>
        <div className="feature-grid">
          {features.map(({ icon: Icon, key }) => (
            <article key={key} className="feature">
              <span className="feature-icon"><Icon size={22} aria-hidden="true" /></span>
              <h3>{t(`lp_f_${key}`)}</h3>
              <p>{t(`lp_f_${key}_body`)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="lp-section lp-data">
        <h2>{t("lp_dataTitle")}</h2>
        <ul className="data-list">
          {["power", "modis", "soilgrids", "openmeteo"].map((k) => (
            <li key={k}><strong>{t(`lp_d_${k}`)}</strong><span>{t(`lp_d_${k}_body`)}</span></li>
          ))}
        </ul>
        <p className="muted small">{t("lp_dataNote")}</p>
      </section>

      <section className="lp-final">
        <h2>{t("lp_finalTitle")}</h2>
        <button type="button" className="btn btn-primary btn-lg" onClick={onStart}>
          <span>{t("lp_cta")}</span>
          <ArrowRight size={20} aria-hidden="true" className="flip-rtl" />
        </button>
      </section>

      <footer className="lp-footer">
        <Brand size={24} />
        <span>{t("lp_footer")}</span>
      </footer>
    </div>
  );
}
