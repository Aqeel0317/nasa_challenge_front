import { useEffect, useRef, useState } from "react";
import { ArrowRight, Box, ChevronDown, Languages, Layers, Sprout } from "lucide-react";
import { useI18n } from "../i18n.jsx";
import Brand from "../components/Brand.jsx";
import LanguageSwitch from "../components/LanguageSwitch.jsx";
import FarmScene from "../components/landing/FarmScene.jsx";
import { warmUp } from "../farmCache.js";

// Landing page told as one farm year you scroll through: a cinematic hero, a pinned
// story where the same farm meets a heatwave, a flood and a drought, the 2022 numbers,
// then what the tool does. All motion is plain CSS + a small canvas, and it stops
// for people who ask for reduced motion.

// The app routes on the URL hash, so in-page links scroll instead of changing it.
const jump = (id) => (e) => {
  e.preventDefault();
  document.getElementById(id)?.scrollIntoView({ behavior: still() ? "auto" : "smooth" });
};

const still = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- hooks ----------
// Adds .is-in to [data-reveal] children the first time they scroll into view.
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
    }, { threshold: 0.15 });
    el.querySelectorAll("[data-reveal]").forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);
  return ref;
}

// 0..1 progress through a tall section while its sticky child is pinned.
function useScrollProgress(ref) {
  const [p, setP] = useState(0);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      setP(Math.max(0, Math.min(1, -r.top / Math.max(1, total))));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [ref]);
  return p;
}

// ---------- glowing embers drifting up, pushed aside by the pointer ----------
function Embers({ density = 1 }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    let w = 0, h = 0, raf = 0, visible = true;
    const mouse = { x: -999, y: -999 };
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const parts = [];
    const spawn = (anywhere) => ({
      x: Math.random() * w, y: anywhere ? Math.random() * h : h + 10,
      r: 0.6 + Math.random() * 2.4, vy: 0.25 + Math.random() * 0.9, vx: (Math.random() - 0.5) * 0.3,
      life: Math.random() * Math.PI * 2, hue: 18 + Math.random() * 28,
    });
    const resize = () => {
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(150, (w * h) / 9000) * density);
      parts.length = 0;
      for (let i = 0; i < n; i += 1) parts.push(spawn(true));
    };
    const draw = () => {
      raf = 0;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      for (const p of parts) {
        p.life += 0.03;
        const dx = p.x - mouse.x, dy = p.y - mouse.y;
        if (dx * dx + dy * dy < 14000) { p.vx += dx / 4000; p.vy -= dy / 9000; }
        p.vx *= 0.98;
        p.vy = Math.max(0.15, Math.min(2.5, p.vy));
        p.x += p.vx + Math.sin(p.life) * 0.25;
        p.y -= p.vy;
        if (p.y < -10 || p.x < -20 || p.x > w + 20) Object.assign(p, spawn(false));
        const a = 0.35 + 0.35 * Math.sin(p.life * 1.7);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
        g.addColorStop(0, `hsla(${p.hue}, 100%, 70%, ${a})`);
        g.addColorStop(1, `hsla(${p.hue}, 100%, 50%, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2); ctx.fill();
      }
      if (visible && !still()) raf = requestAnimationFrame(draw);
    };
    const onMove = (e) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(draw);
    });
    resize();
    draw();
    io.observe(canvas);
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(raf); io.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
    };
  }, [density]);
  return <canvas ref={ref} className="lx-embers" aria-hidden="true" />;
}

// Words rise in one by one
function SplitWords({ text, delay = 0, className = "" }) {
  return (
    <span className={`lx-split ${className}`}>
      {text.split(" ").map((w, i) => (
        <span key={i} className="lx-word"><span style={{ animationDelay: `${delay + i * 0.07}s` }}>{w}</span> </span>
      ))}
    </span>
  );
}

// "33 million" counts up from 0 when it scrolls into view
function CountUp({ text }) {
  const ref = useRef(null);
  const m = text.match(/^([\d.]+)(.*)$/);
  const [v, setV] = useState(m ? "0" : null);
  useEffect(() => {
    if (!m) return undefined;
    const target = parseFloat(m[1]), dec = (m[1].split(".")[1] || "").length;
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      if (still()) { setV(target.toFixed(dec)); return; }
      const t0 = performance.now();
      const tick = (now) => {
        const k = Math.min(1, (now - t0) / 1800);
        setV((target * (1 - (1 - k) ** 4)).toFixed(dec));
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.5 });
    io.observe(ref.current);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps
  return <strong ref={ref}><bdi>{m ? `${v}${m[2]}` : text}</bdi></strong>;
}

// ---------- small step pictures ----------
function PinArt() {
  return (
    <svg viewBox="0 0 120 90" className="step-art" aria-hidden="true">
      <path d="M10 70L40 50H110L80 70Z" fill="#a7c96b" />
      <path d="M22 62h66M32 56h66" stroke="#8ab456" strokeWidth="2" />
      <path d="M40 50L20 30H90L110 50Z" fill="#e8c63e" />
      <ellipse className="pin-shadow" cx="62" cy="57" rx="8" ry="3" fill="rgba(0,0,0,.2)" />
      <g className="pin-drop">
        <path d="M62 54c-8-12-12-17-12-23a12 12 0 0 1 24 0c0 6-4 11-12 23Z" fill="#e2432a" />
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
function StormArt() {
  return (
    <svg viewBox="0 0 120 90" className="step-art" aria-hidden="true">
      <path d="M10 76L36 58H112L86 76Z" fill="#c9a874" />
      <path d="M36 58l10 8 8-6 12 10M70 60l6 10 12-4" stroke="#7a5634" strokeWidth="2" fill="none" />
      <circle className="art-sun" cx="88" cy="26" r="14" fill="#ff8a3d" />
      <g className="art-cloud"><ellipse cx="44" cy="30" rx="22" ry="11" fill="#5b6670" /><ellipse cx="58" cy="24" rx="15" ry="11" fill="#6b7680" /></g>
      <path className="art-bolt" d="M50 38l-6 12h6l-4 12 12-16h-6l4-8Z" fill="#ffe27a" />
    </svg>
  );
}

// ---------- the pinned story: one farm year, four kinds of weather ----------
const CHAPTERS = [
  { key: "normal", mood: "normal", month: 0 },
  { key: "heatwave", mood: "heatwave", month: 3 },
  { key: "flood", mood: "flood", month: 4 },
  { key: "drought", mood: "drought", month: 10 },
  { key: "end", mood: "heatwave", month: 11 },
];

function YearStory({ onStart }) {
  const { t, lang } = useI18n();
  const ref = useRef(null);
  const p = useScrollProgress(ref);
  const idx = Math.min(CHAPTERS.length - 1, Math.floor(p * CHAPTERS.length));
  const ch = CHAPTERS[idx];
  const months = Array.from({ length: 12 }, (_, i) =>
    new Date(2024, 4 + i, 1).toLocaleDateString(lang === "ur" ? "ur-PK" : "en-GB", { month: "short" }));
  return (
    <section ref={ref} id="year" className="lx-story" style={{ height: `${CHAPTERS.length * 100 + 40}vh` }}
             aria-label={t("lx_storyLabel")}>
      <div className={`lx-pin lx-mood-${ch.mood} ${ch.key === "end" ? "is-end" : ""}`} style={{ "--p": p }}>
        <div className="lx-scene"><FarmScene label={t("lp_sceneLabel")} mood={ch.mood} /></div>
        <div className="lx-vignette" aria-hidden="true" />
        <div className="lx-chapter" key={ch.key}>
          <p className="lx-kicker">{t(`lx_ch_${ch.key}_k`)}</p>
          <p className="lx-big">{t(`lx_ch_${ch.key}_big`)}</p>
          <h2 className="lx-h">{t(`lx_ch_${ch.key}_h`)}</h2>
          <p className="lx-p">{t(`lx_ch_${ch.key}_p`)}</p>
          {ch.key === "end" && (
            <button type="button" className="lx-cta" onClick={onStart}>
              <span>{t("lp_cta")}</span><ArrowRight size={20} aria-hidden="true" className="flip-rtl" />
            </button>
          )}
        </div>
        <div className="lx-year" aria-hidden="true" dir="ltr">
          <div className="lx-year-bar"><i style={{ inlineSize: `${Math.round(p * 100)}%` }} /></div>
          <div className="lx-year-months">
            {months.map((m, i) => <span key={i} className={i <= ch.month ? "on" : ""}>{m}</span>)}
          </div>
        </div>
        <ol className="lx-dots" aria-hidden="true">
          {CHAPTERS.map((c, i) => <li key={c.key} className={i === idx ? "on" : ""} />)}
        </ol>
      </div>
    </section>
  );
}

// ---------- page ----------
export default function LandingPage({ onStart }) {
  const { t } = useI18n();
  const [scrolled, setScrolled] = useState(false);
  const statsRef = useReveal();
  const stepsRef = useReveal();
  const featRef = useReveal();
  const dataRef = useReveal();
  const finalRef = useReveal();

  // Wake the free-tier server and get the farmer's last farm ready while they read.
  useEffect(() => {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem("aapkakhet-farm-v2") || "null"); } catch { /* blocked */ }
    const id = setTimeout(() => warmUp(saved), 1200);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Cards light up where the pointer is
  const glow = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  const features = [
    { icon: Layers, key: "plans" }, { icon: Box, key: "sim" },
    { icon: Sprout, key: "soil" }, { icon: Languages, key: "urdu" },
  ];
  const sources = ["power", "modis", "soilgrids", "openmeteo"];

  return (
    <div className="lx">
      <header className={`lx-nav ${scrolled ? "is-solid" : ""}`}>
        <Brand size={32} />
        <nav className="lx-nav-end">
          <a className="lx-link" href="#how" onClick={jump("how")}>{t("lp_howLink")}</a>
          <LanguageSwitch />
          <button type="button" className="lx-cta lx-cta-sm" onClick={onStart}>{t("lp_cta")}</button>
        </nav>
      </header>

      {/* ---------------- hero ---------------- */}
      <section className="lx-hero">
        <div className="lx-sun" aria-hidden="true" />
        <Embers />
        <svg className="lx-wheat" viewBox="0 0 1200 220" preserveAspectRatio="none" aria-hidden="true">
          {Array.from({ length: 70 }, (_, i) => {
            const x = i * 17.4 + ((i * 37) % 9), hh = 90 + ((i * 53) % 70);
            return (
              <g key={i} transform={`translate(${x} 220)`}>
                <g className="lx-stalk" style={{ animationDelay: `-${((i * 0.37) % 3).toFixed(2)}s` }}>
                  <path d={`M0 0V-${hh}`} stroke="#140b07" strokeWidth="3" />
                  <ellipse cx="0" cy={-hh - 12} rx="6" ry="16" fill="#140b07" />
                </g>
              </g>
            );
          })}
        </svg>
        <div className="lx-hero-copy">
          <p className="lx-urdu"><bdi lang="ur">آپ کا کھیت</bdi></p>
          <p className="lx-eyebrow">{t("lp_eyebrow")}</p>
          <h1 className="lx-title">
            <SplitWords text={t("lp_title")} />
            <SplitWords text={t("lp_title2")} delay={0.6} className="lx-fire" />
          </h1>
          <p className="lx-lead">{t("lp_lead")}</p>
          <div className="lx-actions">
            <button type="button" className="lx-cta" onClick={onStart}>
              <span>{t("lp_cta")}</span><ArrowRight size={20} aria-hidden="true" className="flip-rtl" />
            </button>
            <a className="lx-ghost" href="#year" onClick={jump("year")}>{t("lx_scroll")}</a>
          </div>
        </div>
        <a className="lx-scrollcue" href="#year" onClick={jump("year")} aria-label={t("lx_scroll")}><ChevronDown size={28} aria-hidden="true" /></a>
      </section>

      <YearStory onStart={onStart} />

      {/* ---------------- 2022 ---------------- */}
      <section className="lx-stats" ref={statsRef}>
        <h2 data-reveal className="lx-reveal">{t("lp_statsTitle")}</h2>
        <div className="lx-stat-band">
          {["people", "acres", "season"].map((k, i) => (
            <div key={k} data-reveal className="lx-reveal lx-stat" style={{ transitionDelay: `${i * 0.12}s` }}>
              <CountUp text={t(`lp_stat_${k}_n`)} />
              <span>{t(`lp_stat_${k}`)}</span>
            </div>
          ))}
        </div>
        <p className="lx-src">{t("lp_statsSrc")}</p>
      </section>

      {/* ---------------- how it works ---------------- */}
      <section className="lx-section" id="how" ref={stepsRef}>
        <p className="lx-kicker lx-reveal" data-reveal>{t("lx_howKicker")}</p>
        <h2 className="lx-section-title lx-reveal" data-reveal>{t("lp_howTitle")}</h2>
        <ol className="lx-steps">
          {[["pin", PinArt], ["sat", SatelliteArt], ["phone", StormArt]].map(([k, Art], i) => (
            <li key={k} className="lx-card lx-reveal" data-reveal style={{ transitionDelay: `${i * 0.12}s` }} onPointerMove={glow}>
              <Art />
              <span className="lx-num">{i + 1}</span>
              <h3>{t(`lp_step_${k}`)}</h3>
              <p>{t(`lp_step_${k}_body`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="lx-section" ref={featRef}>
        <h2 className="lx-section-title lx-reveal" data-reveal>{t("lp_featTitle")}</h2>
        <div className="lx-features">
          {features.map(({ icon: Icon, key }, i) => (
            <article key={key} className="lx-card lx-reveal" data-reveal style={{ transitionDelay: `${i * 0.1}s` }} onPointerMove={glow}>
              <span className="lx-icon"><Icon size={22} aria-hidden="true" /></span>
              <h3>{t(`lp_f_${key}`)}</h3>
              <p>{t(`lp_f_${key}_body`)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="lx-section lx-data" ref={dataRef}>
        <h2 className="lx-section-title lx-reveal" data-reveal>{t("lp_dataTitle")}</h2>
        <div className="lx-marquee" aria-hidden="true" dir="ltr">
          <div className="lx-marquee-track">
            {[...sources, ...sources, ...sources, ...sources].map((k, i) => <span key={i}>{t(`lp_d_${k}`)}</span>)}
          </div>
        </div>
        <ul className="lx-sources">
          {sources.map((k, i) => (
            <li key={k} className="lx-reveal" data-reveal style={{ transitionDelay: `${i * 0.08}s` }}>
              <strong>{t(`lp_d_${k}`)}</strong><span>{t(`lp_d_${k}_body`)}</span>
            </li>
          ))}
        </ul>
        <p className="lx-note">{t("lp_dataNote")}</p>
      </section>

      {/* ---------------- last call ---------------- */}
      <section className="lx-final" ref={finalRef}>
        <Embers density={0.6} />
        <h2 className="lx-reveal" data-reveal>{t("lp_finalTitle")}</h2>
        <p className="lx-reveal" data-reveal>{t("lx_finalSub")}</p>
        <button type="button" className="lx-cta lx-cta-xl lx-reveal" data-reveal onClick={onStart}>
          <span>{t("lp_cta")}</span><ArrowRight size={22} aria-hidden="true" className="flip-rtl" />
        </button>
      </section>

      <footer className="lx-footer">
        <Brand size={24} />
        <span>{t("lp_footer")}</span>
      </footer>
    </div>
  );
}
