import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize, Pause, Play, RotateCcw, Volume2, VolumeX, X } from "lucide-react";
import { useI18n } from "../i18n.jsx";
import { GrowMark } from "../components/BrandLoader.jsx";
import FarmScene from "../components/landing/FarmScene.jsx";
import HeroField from "../components/landing/HeroField.jsx";
import { play, setLevel, setMuted, unlock } from "../sfx.js";

// A 60-second presentation of the project: eight scenes with captions held long
// enough to read, CSS visual effects and synthesized sound effects (no music).
// The clock lives in a ref; React only re-renders when a scene (or beat) changes.
const SCENES = [
  { key: "title", dur: 6, sfx: [[0, "whoosh"], [0.7, "chime"]] },
  { key: "problem", dur: 8, sfx: [[0, "thunder"], [1.2, "boom"], [3.4, "tick"], [3.6, "tick"], [3.8, "tick"]] },
  { key: "bet", dur: 7, sfx: [[0, "whoosh"], [0.4, "sizzle"]] },
  { key: "nasa", dur: 8, sfx: [[0, "whoosh"], [1, "ping"], [1.8, "blip"], [2.6, "blip"], [3.4, "blip"], [4.2, "blip"], [5.5, "ping"]] },
  { key: "sim", dur: 7, sfx: [[0, "whoosh"], [1, "tick"], [2, "tick"], [3, "tick"], [4, "tick"], [5, "tick"], [6, "tick"]] },
  { key: "shock", dur: 9, sfx: [[0, "boom"], [4.5, "thunder"]], beat: 4.5 },
  { key: "advice", dur: 8, sfx: [[0, "chime"], [1.3, "pop"], [2.3, "pop"], [3.3, "pop"], [4.6, "ping"]] },
  { key: "close", dur: 7, sfx: [[0, "whoosh"], [0.6, "finale"]] },
];
const TOTAL = SCENES.reduce((s, x) => s + x.dur, 0);
const STARTS = SCENES.reduce((a, s, i) => [...a, i ? a[i - 1] + SCENES[i - 1].dur : 0], []);
const sceneAt = (t) => { let i = SCENES.length - 1; while (i > 0 && t < STARTS[i]) i -= 1; return i; };

// Voice-over: one clip per scene, English or Urdu to match the app language
// (made with demo-video-generator/spaceapps/tour-vo.js; files in public/tour/).
const VO_LEAD = 0.45;
const voUrl = (lang, key) => `/tour/${lang === "ur" ? "ur" : "en"}-${key}.mp3`;

function Count({ to, dec = 0, suffix = "", ms = 1600 }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      setV(to * (1 - (1 - k) ** 3));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return <bdi>{v.toFixed(dec)}{suffix}</bdi>;
}

function Scene({ k, beat }) {
  const { t } = useI18n();
  switch (k) {
    case "title":
      return (
        <div className="ts ts-title">
          <div className="ts-stars" />
          <GrowMark size={150} />
          <p className="ts-urdu" lang="ur" dir="rtl">آپ کا کھیت</p>
          <h1 className="ts-big">Aap ka Khet</h1>
          <p className="ts-cap">{t("tour_title_cap")}</p>
          <p className="ts-tag">{t("tour_title_tag")}</p>
        </div>
      );
    case "problem":
      return (
        <div className="ts ts-problem">
          <div className="ts-rain" /><div className="ts-flash" />
          <p className="ts-kicker">{t("tour_problem_k")}</p>
          <div className="ts-stats">
            <div><strong><Count to={33} suffix={t("tour_million")} /></strong><span>{t("lp_stat_people")}</span></div>
            <div><strong><Count to={4.4} dec={1} suffix={t("tour_million")} /></strong><span>{t("lp_stat_acres")}</span></div>
          </div>
          <p className="ts-cap">{t("tour_problem_cap")}</p>
          <p className="ts-src">{t("lp_statsSrc")}</p>
        </div>
      );
    case "bet":
      return (
        <div className="ts ts-scene">
          <div className="ts-bg"><FarmScene label="" mood="drought" /></div>
          <div className="ts-shade" />
          <div className="ts-copy">
            <p className="ts-kicker">{t("tour_bet_k")}</p>
            <h2 className="ts-h">{t("tour_bet_h")}</h2>
            <p className="ts-cap">{t("tour_bet_cap")}</p>
          </div>
        </div>
      );
    case "nasa":
      return (
        <div className="ts ts-nasa">
          <div className="ts-nasa-art"><HeroField /></div>
          <div className="ts-copy">
            <p className="ts-kicker">{t("tour_nasa_k")}</p>
            <h2 className="ts-h">{t("tour_nasa_h")}</h2>
            <ul className="ts-sources">
              {["power", "modis", "eonet", "soil", "meteo"].map((s, i) => (
                <li key={s} style={{ animationDelay: `${1.6 + i * 0.8}s` }}><strong>{t(`tour_src_${s}`)}</strong><span>{t(`tour_src_${s}_d`)}</span></li>
              ))}
            </ul>
          </div>
        </div>
      );
    case "sim":
      return (
        <div className="ts ts-scene ts-sim">
          <div className="ts-bg ts-zoom"><FarmScene label="" mood="normal" /></div>
          <div className="ts-shade" />
          <div className="ts-copy">
            <p className="ts-kicker">{t("tour_sim_k")}</p>
            <h2 className="ts-h">{t("tour_sim_h")}</h2>
            <p className="ts-cap">{t("tour_sim_cap")}</p>
          </div>
          <div className="ts-year" dir="ltr">
            <div className="ts-year-bar"><i /></div>
            <div className="ts-year-m">{["May", "Jul", "Sep", "Nov", "Jan", "Mar", "Apr"].map((m) => <span key={m}>{m}</span>)}</div>
          </div>
        </div>
      );
    case "shock": {
      const mood = beat ? "flood" : "heatwave";
      return (
        <div className={`ts ts-scene ts-shock-${mood}`}>
          <div className="ts-bg"><FarmScene label="" mood={mood} /></div>
          <div className="ts-shade" /><div className="ts-flash ts-flash-once" key={mood} />
          <div className="ts-copy" key={`c-${mood}`}>
            <p className="ts-kicker">{t(`tour_shock_${mood}_k`)}</p>
            <p className="ts-mega">{t(`tour_shock_${mood}_big`).split(" · ").map((line) => <span key={line}>{line}</span>)}</p>
            <p className="ts-cap">{t(`tour_shock_${mood}_cap`)}</p>
          </div>
        </div>
      );
    }
    case "advice":
      return (
        <div className="ts ts-advice">
          <div className="ts-copy">
            <p className="ts-kicker">{t("tour_advice_k")}</p>
            <h2 className="ts-h">{t("tour_advice_h")}</h2>
          </div>
          <div className="ts-card">
            <div className="ts-card-top"><span>⚠️</span><strong>{t("verdictTitle_watch")}</strong><span className="ts-speaker">🔊</span></div>
            <ul>
              {["tour_tip1", "tour_tip2", "tour_tip3"].map((k2, i) => (
                <li key={k2} style={{ animationDelay: `${1.3 + i}s` }}>{t(k2)}</li>
              ))}
            </ul>
            <p className="ts-card-foot">{t("tour_advice_foot")}</p>
          </div>
        </div>
      );
    default:
      return (
        <div className="ts ts-title ts-close">
          <div className="ts-stars" />
          <GrowMark size={110} />
          <h2 className="ts-big">{t("tour_close_h")}</h2>
          <p className="ts-cap">{t("tour_close_cap")}</p>
          <p className="ts-url">aapkakhet.readhaven.online</p>
          <p className="ts-tag">{t("tour_close_tag")}</p>
        </div>
      );
  }
}

export default function TourPage({ onExit }) {
  const { t, lang } = useI18n();
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [mute, setMute] = useState(false);
  const [phase, setPhase] = useState({ i: 0, beat: 0 });
  const [done, setDone] = useState(false);
  const clock = useRef({ t: 0, last: 0 });
  const barRef = useRef(null);
  const voices = useRef({});
  const voice = (key) => {
    const url = voUrl(lang, key);
    if (!voices.current[url]) { const a = new Audio(url); a.preload = "auto"; voices.current[url] = a; }
    return voices.current[url];
  };
  // Warm the clips so the first lines start on time
  useEffect(() => { SCENES.forEach((s) => voice(s.key)); }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps
  const stopVoices = () => Object.values(voices.current).forEach((a) => a.pause());

  // Play the current scene's line (from the right point after a seek or a pause)
  useEffect(() => {
    stopVoices();
    if (!playing) return undefined;
    setLevel(0.32);
    const a = voice(SCENES[phase.i].key);
    a.muted = mute;
    const into = clock.current.t - STARTS[phase.i] - VO_LEAD;
    let id = 0;
    const go = () => { a.play().catch(() => {}); };
    if (into >= 0) { if (Number.isFinite(a.duration) && into >= a.duration) return undefined; a.currentTime = into; go(); }
    else { a.currentTime = 0; id = setTimeout(go, -into * 1000); }
    return () => { clearTimeout(id); a.pause(); };
  }, [phase.i, playing, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { stopVoices(); setLevel(0.55); }, []);
  useEffect(() => { Object.values(voices.current).forEach((a) => { a.muted = mute; }); }, [mute]);
  const rootRef = useRef(null);

  const fire = (from, to) => {
    SCENES.forEach((s, i) => s.sfx.forEach(([at, name]) => {
      const abs = STARTS[i] + at;
      if (abs >= from && abs < to) play(name);
    }));
  };

  useEffect(() => {
    if (!playing) return undefined;
    let raf = 0;
    clock.current.last = performance.now();
    const loop = (now) => {
      const c = clock.current;
      const prev = c.t;
      c.t = Math.min(TOTAL, c.t + (now - c.last) / 1000);
      c.last = now;
      fire(prev === 0 ? -1 : prev, c.t === TOTAL ? TOTAL + 1 : c.t);
      if (barRef.current) barRef.current.style.transform = `scaleX(${c.t / TOTAL})`;
      const i = sceneAt(c.t);
      const s = SCENES[i];
      const beat = s.beat && c.t - STARTS[i] >= s.beat ? 1 : 0;
      setPhase((p) => (p.i === i && p.beat === beat ? p : { i, beat }));
      if (c.t >= TOTAL) { setPlaying(false); setDone(true); return; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const start = useCallback(() => {
    unlock();
    setStarted(true);
    setDone(false);
    clock.current.t = 0;
    setPhase({ i: 0, beat: 0 });
    setPlaying(true);
  }, []);
  const seek = (i) => {
    unlock();
    clock.current.t = STARTS[i] + 0.001;
    setPhase({ i, beat: 0 });
    setStarted(true);
    setDone(false);
    setPlaying(true);
  };
  const toggleMute = () => { setMuted(!mute); setMute(!mute); };
  const fullscreen = () => {
    const el = rootRef.current;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el?.requestFullscreen?.();
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === " ") { e.preventDefault(); if (!started || done) start(); else setPlaying((p) => !p); }
      if (e.key === "Escape" && !document.fullscreenElement) onExit();
      if (e.key === "ArrowRight") seek(Math.min(SCENES.length - 1, phase.i + 1));
      if (e.key === "ArrowLeft") seek(Math.max(0, phase.i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }); // re-bind each render so the handler sees the current scene

  return (
    <div ref={rootRef} className={`tour ${playing ? "" : "is-paused"}`}>
      <div className="tour-stage" key={`${phase.i}`}>
        <Scene k={SCENES[phase.i].key} beat={phase.beat} />
      </div>

      {(!started || done) && (
        <div className="tour-cover">
          <button type="button" className="tour-play" onClick={start} aria-label={t("tour_play")}>
            <Play size={44} aria-hidden="true" />
          </button>
          <p>{done ? t("tour_again") : t("tour_play")}</p>
          <p className="tour-hint">{t("tour_hint")}</p>
        </div>
      )}

      <div className="tour-ui">
        <button type="button" onClick={() => (started && !done ? setPlaying((p) => !p) : start())} aria-label={playing ? t("pause") : t("play")}>
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button type="button" onClick={start} aria-label={t("tour_restart")}><RotateCcw size={18} /></button>
        <div className="tour-progress">
          <div className="tour-bar"><i ref={barRef} /></div>
          <div className="tour-marks">
            {SCENES.map((s, i) => (
              <button key={s.key} type="button" className={i === phase.i ? "on" : ""} style={{ left: `${(100 * STARTS[i]) / TOTAL}%` }}
                      onClick={() => seek(i)} aria-label={t(`tour_name_${s.key}`)} title={t(`tour_name_${s.key}`)} />
            ))}
          </div>
        </div>
        <button type="button" onClick={toggleMute} aria-label={mute ? t("tour_unmute") : t("tour_mute")}>{mute ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
        <button type="button" onClick={fullscreen} aria-label={t("tour_full")}><Maximize size={18} /></button>
        <button type="button" onClick={onExit} aria-label={t("close")}><X size={18} /></button>
      </div>
    </div>
  );
}
