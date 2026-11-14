import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Pause, Play, Volume2, VolumeX, X } from "lucide-react";
import { useI18n } from "../../i18n.jsx";
import PAGES from "./guideSteps.json";
import "./guide.css";

// "How to use": a narrated, step-by-step walk through the real Today screen.
// A glowing spotlight glides to each part of the page while a voice (recorded with
// demo-video-generator/spaceapps/guide-vo.js, files in public/guide/) explains it in
// one plain sentence. Steps move on by themselves when the voice ends; the farmer can
// pause, go back, mute or close at any time. Parts not on screen are skipped.
export const GUIDE_KEY = "aapkakhet-guided";

const UI = {
  en: { start: "Start the 1-minute guide", startSub: "With voice · tap outside to close", next: "Next", back: "Back", done: "Done",
    toSetup: "Set up my farm", skip: "Skip", skipTour: "Skip tour", of: (n, t) => `Step ${n} of ${t}`, pause: "Pause", play: "Play", mute: "Sound off", unmute: "Sound on" },
  ur: { start: "1 منٹ کی رہنمائی شروع کریں", startSub: "آواز کے ساتھ · بند کرنے کے لیے باہر دبائیں", next: "آگے", back: "پیچھے", done: "مکمل",
    toSetup: "اپنا فارم ترتیب دیں", skip: "چھوڑیں", skipTour: "رہنمائی چھوڑیں", of: (n, t) => `${t} میں سے قدم ${n}`, pause: "روکیں", play: "چلائیں", mute: "آواز بند", unmute: "آواز کھولیں" },
};
const visible = (el) => el && el.getClientRects().length > 0;
const MUTE_KEY = "aapkakhet-guide-mute";

export const hasGuide = (page) => Boolean(PAGES[page]);

export default function Guide({ page = "today", onClose, thenSetup = false }) {
  const { lang } = useI18n();
  const L = lang === "ur" ? "ur" : "en";
  const ui = UI[L];
  const [steps] = useState(() => (PAGES[page] || []).filter((s) => s.id === "intro" || visible(document.querySelector(s.sel))));
  const [i, setI] = useState(0);
  const [box, setBox] = useState(null);
  const [playing, setPlaying] = useState(true);
  const [talking, setTalking] = useState(false);
  const [mute, setMute] = useState(() => { try { return localStorage.getItem(MUTE_KEY) === "1"; } catch { return false; } });
  const [shown, setShown] = useState(false);
  const [started, setStarted] = useState(() => !(PAGES[page] || [])[0] || PAGES[page][0].id !== "intro");
  const audio = useRef(null);
  const step = steps[i];
  const intro = step?.id === "intro";
  const last = i === steps.length - 1;

  useEffect(() => { const id = requestAnimationFrame(() => setShown(true)); return () => cancelAnimationFrame(id); }, []);
  useEffect(() => { document.documentElement.classList.add("guide-open"); return () => document.documentElement.classList.remove("guide-open"); }, []);

  // ---- spotlight: follow the lit part of the page
  const measure = useCallback(() => {
    const el = step?.sel && document.querySelector(step.sel);
    if (!el) { setBox(null); return; }
    const r = el.getBoundingClientRect();
    setBox({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step]);
  useLayoutEffect(() => {
    const el = step?.sel && document.querySelector(step.sel);
    if (!el) { setBox(null); return undefined; }
    const r = el.getBoundingClientRect();
    const phone = window.innerWidth < 640;
    const top = r.top + window.scrollY - (phone ? 90 : Math.max(90, (window.innerHeight - Math.min(r.height, window.innerHeight * 0.55)) / 2 - 60));
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    measure();
    const id = setInterval(measure, 60);
    const stop = setTimeout(() => clearInterval(id), 1000);
    return () => { clearInterval(id); clearTimeout(stop); };
  }, [step, measure]);
  useEffect(() => {
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => { window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
  }, [measure]);

  // ---- voice: one clip per step; when it ends, glide on to the next step
  const next = useCallback(() => setI((k) => {
    if (k >= steps.length - 1) return k;
    return k + 1;
  }), [steps.length]);
  useEffect(() => {
    if (!step || (intro && i === 0 && !audio.current)) return undefined;   // the intro waits for the first tap
    const a = audio.current || new Audio();
    audio.current = a;
    a.pause();
    a.src = `/guide/${L}-${page}-${step.id}.mp3`;
    a.muted = mute;
    let t = 0;
    const onEnd = () => { setTalking(false); if (!last) t = setTimeout(next, 1100); };
    a.onended = onEnd;
    a.onplaying = () => setTalking(true);
    a.onpause = () => setTalking(false);
    if (playing) {
      const s = setTimeout(() => a.play().catch(() => { setTalking(false); }), 450);   // after the spotlight lands
      return () => { clearTimeout(s); clearTimeout(t); a.onended = null; a.pause(); };
    }
    return () => { clearTimeout(t); a.onended = null; a.pause(); };
  }, [i, L]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const a = audio.current;
    if (!a || !a.src) return;
    if (playing) { if (a.paused && !a.ended && a.currentTime > 0) a.play().catch(() => {}); } else a.pause();
  }, [playing]);
  useEffect(() => {
    if (audio.current) audio.current.muted = mute;
    try { localStorage.setItem(MUTE_KEY, mute ? "1" : "0"); } catch { /* ignore */ }
  }, [mute]);
  useEffect(() => () => { audio.current?.pause(); }, []);

  const begin = () => {
    // the first tap unlocks sound in the browser, then the intro speaks
    const a = new Audio(`/guide/${L}-${page}-intro.mp3`);
    audio.current = a;
    a.muted = mute;
    a.onplaying = () => setTalking(true);
    a.onpause = () => setTalking(false);
    a.onended = () => { setTalking(false); setTimeout(next, 900); };
    a.play().catch(() => setTimeout(next, 3500));
    setPlaying(true);
    setI(0);
    setBox(null);
    setStarted(true);
  };
  const go = (k) => { setPlaying(true); setI(Math.max(0, Math.min(steps.length - 1, k))); };
  const close = () => { audio.current?.pause(); onClose(); };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") close();
      if (e.key === " ") { e.preventDefault(); setPlaying((p) => !p); }
      const fwd = L === "ur" ? "ArrowLeft" : "ArrowRight", bwd = L === "ur" ? "ArrowRight" : "ArrowLeft";
      if (e.key === fwd && started) go(i + 1);
      if (e.key === bwd && started) go(i - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!step) return null;
  const [title, body] = step[L];
  const pad = 10;
  const vh = window.innerHeight, vw = window.innerWidth;
  const phone = vw < 640;
  const hole = box && {
    top: Math.max(6, box.top - pad), left: Math.max(6, box.left - pad),
    width: Math.min(vw - 12, box.width + pad * 2), height: Math.max(40, Math.min(vh - 12, box.height + pad * 2)),
  };
  // the card sits beside the lit part: below it, above it, or docked at the bottom
  const cardH = phone ? 250 : 270;
  let pos;
  if (!hole) pos = { top: "50%", transform: "translateY(-50%)" };
  else if (hole.top + hole.height + 16 + cardH < vh) pos = { top: hole.top + hole.height + 16 };
  else if (hole.top - cardH - 16 > 0) pos = { top: hole.top - cardH - 16 };
  else pos = { bottom: 16 };
  const left = phone ? 12 : !hole ? Math.max(16, (vw - 460) / 2) : Math.min(Math.max(16, hole.left + Math.min(40, hole.width / 4)), vw - 476);
  const pct = ((i + (talking ? 0.5 : 1)) / steps.length) * 100;

  return (
    <div className={`guide ${shown ? "is-in" : ""} ${hole ? "" : "no-hole"}`} dir={L === "ur" ? "rtl" : "ltr"}
         role="dialog" aria-modal="true" aria-labelledby="guide-title" aria-live="polite">
      <div className="guide-hole" style={hole || { top: vh / 2, left: vw / 2, width: 0, height: 0 }}>
        <span className="guide-ring" />
      </div>
      {/* tapping outside the card closes the guide: it never traps the farmer */}
      <div className="guide-scrim" onClick={close} />

      {!started ? (
        <div className="guide-hero">
          <div className="guide-orb" aria-hidden="true"><span>🌾</span></div>
          <p className="guide-kicker">{step.icon} {title}</p>
          <h2 id="guide-title">{body}</h2>
          <button type="button" className="guide-start" onClick={begin}>
            <span className="guide-start-ic"><Play size={22} aria-hidden="true" /></span>
            <span><strong>{ui.start}</strong><small>{ui.startSub}</small></span>
          </button>
          <button type="button" className="guide-skip" onClick={close}>{ui.skip}</button>
        </div>
      ) : (
        <div className="guide-card" key={step.id} style={{ ...pos, left, right: phone ? 12 : "auto" }}>
          <div className="guide-progress"><i style={{ width: `${pct}%` }} /></div>
          <div className="guide-top">
            <span className="guide-step">{intro ? "" : steps[0]?.id === "intro" ? ui.of(i, steps.length - 1) : ui.of(i + 1, steps.length)}</span>
            <span className={`guide-wave ${talking && !mute ? "on" : ""}`} aria-hidden="true"><i /><i /><i /><i /><i /></span>
            <button type="button" className="guide-icon" onClick={() => setMute((m) => !m)} aria-label={mute ? ui.unmute : ui.mute}>
              {mute ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <button type="button" className="guide-icon" onClick={close} aria-label={ui.skip}><X size={18} /></button>
          </div>
          <h2 id="guide-title"><span className="guide-emoji" aria-hidden="true">{step.icon}</span><span>{title}</span></h2>
          <p className="guide-body">{body}</p>
          <div className="guide-foot">
            <button type="button" className="guide-icon guide-pp" onClick={() => setPlaying((p) => !p)} aria-label={playing ? ui.pause : ui.play}>
              {playing ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button type="button" className="guide-skiptext" onClick={close}>{ui.skipTour}</button>
            <span className="guide-grow" />
            {i > 0 && <button type="button" className="btn" onClick={() => go(i - 1)}><ArrowLeft size={16} className="flip-rtl" aria-hidden="true" /> {ui.back}</button>}
            <button type="button" className="btn btn-primary guide-next" onClick={() => (last ? close() : go(i + 1))}>
              {last ? (thenSetup ? `🌱 ${ui.toSetup}` : ui.done) : ui.next} {!last && <ArrowRight size={16} className="flip-rtl" aria-hidden="true" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
