import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, LocateFixed, RotateCcw, Search, Volume2, VolumeX, X } from "lucide-react";
import { useI18n } from "../../i18n.jsx";
import { CROP_ICON } from "./farmUtils.js";
import { QUICK_PLACES, placeName, searchPlaces } from "../../weather.js";

// First-visit welcome: where is the farm, what is grown, how much water, and where
// the data comes from. About 30 seconds; skippable; shown once.
export const ONBOARD_KEY = "aapkakhet-onboarded";

// Common rotations in Pakistan, and the districts where each is most common.
const ROTATIONS = [
  { id: "cw", kharif: "cotton", rabi: "wheat", near: ["Multan", "Bahawalpur", "Rahim Yar Khan", "Sukkur", "D.I. Khan"] },
  { id: "rw", kharif: "rice", rabi: "wheat", near: ["Gujranwala", "Lahore", "Larkana", "Hyderabad"] },
  { id: "mw", kharif: "maize", rabi: "wheat", near: ["Faisalabad", "Sahiwal", "Peshawar"] },
  { id: "mp", kharif: "maize", rabi: "potato", near: ["Sahiwal", "Lahore"] },
  { id: "gw", kharif: "mung_bean", rabi: "wheat", near: ["Faisalabad", "D.I. Khan"] },
  { id: "sb", kharif: "sorghum", rabi: "berseem", near: [] },          // fodder for livestock
  { id: "gc", kharif: "guar", rabi: "chickpea", near: ["Bahawalpur", "D.I. Khan"] },
  { id: "sm", kharif: "sesbania", rabi: "mustard", near: [] },
];
const WATER = [["rainfed", "🌦️"], ["deficit", "💧"], ["full", "💦"]];
const SOURCES = [["🛰️", "power"], ["🌿", "modis"], ["🌍", "eonet"], ["🟫", "soil"], ["⛅", "meteo"]];

export default function Onboarding({ settings, onDone, onClose, startAt = 0 }) {
  const { t, lang, crop } = useI18n();
  const [step, setStep] = useState(startAt);
  const [place, setPlace] = useState({ name: settings.place, lat: settings.lat, lon: settings.lon });
  const [picked, setPicked] = useState([]);
  const [acres, setAcres] = useState(8);
  const [water, setWater] = useState(settings.irrigation || "deficit");
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [msg, setMsg] = useState("");
  // Voice: each step explains itself (same voices as the guide; files in public/guide/)
  const VOICE = ["place", "crops", "water", "sources"];
  const audio = useRef(null);
  const [talking, setTalking] = useState(false);
  const [mute, setMute] = useState(() => { try { return localStorage.getItem("aapkakhet-guide-mute") === "1"; } catch { return false; } });
  const say = () => {
    const a = audio.current || new Audio();
    audio.current = a;
    a.pause();
    a.src = `/guide/${lang === "ur" ? "ur" : "en"}-onboarding-${VOICE[step]}.mp3`;
    a.muted = mute;
    a.onplaying = () => setTalking(true);
    a.onpause = a.onended = () => setTalking(false);
    a.play().catch(() => setTalking(false));
  };
  useEffect(() => {
    const id = setTimeout(say, 350);
    return () => { clearTimeout(id); audio.current?.pause(); };
  }, [step, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (audio.current) audio.current.muted = mute;
    try { localStorage.setItem("aapkakhet-guide-mute", mute ? "1" : "0"); } catch { /* ignore */ }
  }, [mute]);
  useEffect(() => () => audio.current?.pause(), []);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return undefined; }
    let alive = true;
    const id = setTimeout(() => searchPlaces(q.trim(), lang).then((r) => alive && setResults(r)).catch(() => {}), 350);
    return () => { alive = false; clearTimeout(id); };
  }, [q, lang]);

  // Suggest the rotations common near the chosen district first
  const district = QUICK_PLACES.find((p) => Math.abs(p.lat - place.lat) < 0.6 && Math.abs(p.lon - place.lon) < 0.6)?.name;
  const ranked = [...ROTATIONS].sort((a, b) => Number(b.near.includes(district)) - Number(a.near.includes(district)));
  useEffect(() => {
    // pre-select the most common rotation near the farm (the farmer can change it)
    if (!picked.length && ranked[0]) setPicked([ranked[0].id]);
  }, [district]); // eslint-disable-line react-hooks/exhaustive-deps

  const gps = () => {
    if (!navigator.geolocation) { setMsg(t("gpsNone")); return; }
    setMsg(t("gpsFinding"));
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const la = +pos.coords.latitude.toFixed(3), lo = +pos.coords.longitude.toFixed(3);
      setPlace({ name: (await placeName(la, lo, lang)) || t("myLocation"), lat: la, lon: lo }); setMsg("");
    }, () => setMsg(t("gpsDenied")), { timeout: 15000, maximumAge: 600000 });
  };
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < 4 ? [...p, id] : p));
  const finish = () => {
    const chosen = ROTATIONS.filter((r) => picked.includes(r.id));
    const each = Math.max(0.5, Math.round((acres / Math.max(1, chosen.length)) * 2) / 2);
    onDone({
      lat: place.lat, lon: place.lon, place: place.name, irrigation: water,
      fields: chosen.length ? chosen.map((r) => ({ kharif: r.kharif, rabi: r.rabi, acres: each })) : undefined,
    });
  };
  const STEPS = 4;
  const next = () => (step < STEPS - 1 ? setStep(step + 1) : finish());

  return (
    <div className="onb-backdrop" role="dialog" aria-modal="true" aria-labelledby="onb-title">
      <div className="onb">
        <header className="onb-head">
          <ol className="onb-dots" aria-label={t("onb_progress", { n: step + 1, total: STEPS })}>
            {Array.from({ length: STEPS }, (_, k) => <li key={k} className={k <= step ? "on" : ""} />)}
          </ol>
          <span className={`guide-wave onb-wave ${talking && !mute ? "on" : ""}`} aria-hidden="true"><i /><i /><i /><i /><i /></span>
          <button type="button" className="onb-x" onClick={say} aria-label={t("listen")}><RotateCcw size={18} /></button>
          <button type="button" className="onb-x" onClick={() => setMute((m) => !m)} aria-label={mute ? t("tour_unmute") : t("tour_mute")}>
            {mute ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <button type="button" className="onb-x" onClick={onClose} aria-label={t("onb_skip")}><X size={20} /></button>
        </header>

        {step === 0 && (
          <section className="onb-step">
            <p className="onb-kicker">👋 {t("onb_welcome")}</p>
            <h2 id="onb-title">{t("onb_q1")}</h2>
            <div className="onb-now">📍 <strong><bdi>{place.name || `${place.lat}, ${place.lon}`}</bdi></strong></div>
            <button type="button" className="locpick-gps" onClick={gps}><LocateFixed size={20} aria-hidden="true" /> {t("useMyLocation")}</button>
            {msg && <p className="locpick-msg">{msg}</p>}
            <label className="locpick-search"><Search size={18} aria-hidden="true" />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPlace")} aria-label={t("searchPlace")} />
            </label>
            {results.length > 0 && (
              <ul className="locpick-results">
                {results.slice(0, 5).map((r) => (
                  <li key={`${r.lat},${r.lon}`}><button type="button" onClick={() => { setPlace(r); setQ(""); setResults([]); }}>
                    <strong>{r.name}</strong>{r.area && <span>{r.area}</span>}</button></li>
                ))}
              </ul>
            )}
            <div className="locpick-quick">
              {QUICK_PLACES.map((p) => (
                <button key={p.name} type="button" className="chip" aria-pressed={district === p.name && Math.abs(p.lat - place.lat) < 0.02}
                        onClick={() => setPlace({ name: lang === "ur" ? p.ur : p.name, lat: p.lat, lon: p.lon })}>{lang === "ur" ? p.ur : p.name}</button>
              ))}
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="onb-step">
            <h2 id="onb-title">{t("onb_q2")}</h2>
            <p className="muted">{t("onb_q2_hint")}</p>
            <div className="onb-rots">
              {ranked.map((r) => (
                <button key={r.id} type="button" className="onb-rot" aria-pressed={picked.includes(r.id)} onClick={() => toggle(r.id)}>
                  <span className="onb-rot-crops">{CROP_ICON[r.kharif]} {crop(r.kharif)} <i>→</i> {CROP_ICON[r.rabi]} {crop(r.rabi)}</span>
                  {r.near.includes(district) && <span className="onb-badge">⭐ {t("onb_common")}</span>}
                </button>
              ))}
            </div>
            <label className="onb-acres">
              <span>{t("onb_acres")}</span>
              <span className="onb-stepper">
                <button type="button" onClick={() => setAcres((a) => Math.max(1, a - 1))} aria-label="−">−</button>
                <bdi className="num">{acres}</bdi>
                <button type="button" onClick={() => setAcres((a) => Math.min(500, a + 1))} aria-label="+">+</button>
              </span>
            </label>
          </section>
        )}

        {step === 2 && (
          <section className="onb-step">
            <h2 id="onb-title">{t("onb_q3")}</h2>
            <div className="onb-water">
              {WATER.map(([id, ic]) => (
                <button key={id} type="button" className="onb-rot" aria-pressed={water === id} onClick={() => setWater(id)}>
                  <span className="onb-big">{ic}</span>
                  <span><strong>{t(`onb_w_${id}`)}</strong><small>{t(`onb_w_${id}_d`)}</small></span>
                </button>
              ))}
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="onb-step">
            <h2 id="onb-title">{t("onb_q4")}</h2>
            <ul className="onb-sources">
              {SOURCES.map(([ic, k]) => (
                <li key={k}><span className="onb-big">{ic}</span><span><strong>{t(`onb_src_${k}`)}</strong><small>{t(`onb_src_${k}_d`)}</small></span></li>
              ))}
            </ul>
            <p className="onb-how">🧮 {t("onb_how")}</p>
            <p className="muted small">🤝 {t("onb_trust")}</p>
          </section>
        )}

        <footer className="onb-foot">
          {step > 0 ? <button type="button" className="btn" onClick={() => setStep(step - 1)}><ArrowLeft size={18} className="flip-rtl" aria-hidden="true" /> {t("onb_back")}</button>
            : <button type="button" className="btn btn-quiet" onClick={onClose}>{t("onb_skip")}</button>}
          <button type="button" className="btn btn-primary" onClick={next} disabled={step === 1 && !picked.length}>
            {step === STEPS - 1 ? t("onb_go") : t("onb_next")} <ArrowRight size={18} className="flip-rtl" aria-hidden="true" />
          </button>
        </footer>
      </div>
    </div>
  );
}
