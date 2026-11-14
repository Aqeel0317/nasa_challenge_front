import { useEffect, useState } from "react";
import { CirclePlay, CalendarCheck, Layers, MapPin, MoreHorizontal, Sprout, SlidersHorizontal, LineChart, Tractor } from "lucide-react";
import { useI18n } from "../i18n.jsx";
import { fieldLabel } from "../weather.js";
import LanguageSwitch from "./LanguageSwitch.jsx";
import Brand from "./Brand.jsx";
import Guide, { hasGuide } from "./farm/Guide.jsx";
import PAGES from "./farm/guideSteps.json";

// Pages whose narrated guide has already opened by itself once
const SEEN_KEY = "aapkakhet-guided-pages";
const AUTO_EACH_PAGE = false;
const seen = () => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"); } catch { return []; } };
const markSeen = (p) => { try { localStorage.setItem(SEEN_KEY, JSON.stringify([...new Set([...seen(), p])])); } catch { /* ignore */ } };

// Farmer menu: three everyday places, the expert pages under "More".
const NAV = [
  { id: "today", icon: CalendarCheck, to: "today", needsResult: false },
  { id: "farm", icon: Tractor, to: "farm", needsResult: false },
  { id: "setup", icon: SlidersHorizontal, to: "setup", needsResult: false },
];
const MORE = [
  { id: "plans", icon: Layers, to: "plans", needsResult: false },
  { id: "field", icon: MapPin, to: "field", needsResult: true },
  { id: "crops", icon: Sprout, to: "crops", needsResult: true },
  { id: "soil", icon: LineChart, to: "soil", needsResult: true },
];

export default function AppShell({ page, go, hasResult, form, children }) {
  const { t, lang } = useI18n();
  const inMore = MORE.some((m) => m.id === page);
  const [moreOpen, setMoreOpen] = useState(false);
  const [guide, setGuide] = useState(null);
  // First visit to a page: open its guide once its main parts are on screen.
  // (Today's first visit is handled by the Today page: guide, then farm setup.)
  useEffect(() => {
    setGuide(null);
    // The guide opens by itself once per user (first visit, on Today); on other pages
    // the green "How to use" button replays it, so it never pops up over the work.
    if (AUTO_EACH_PAGE !== true || !hasGuide(page) || page === "today" || seen().includes(page)) return undefined;
    const first = PAGES[page].find((s) => s.sel)?.sel;
    const t0 = Date.now();
    const id = setInterval(() => {
      const ready = first && document.querySelector(first) && !document.querySelector(".onb, .guide");
      if (ready) { clearInterval(id); setTimeout(() => { markSeen(page); setGuide(page); }, 900); }
      else if (Date.now() - t0 > 30000) clearInterval(id);
    }, 400);
    return () => clearInterval(id);
  }, [page]);
  const item = ({ id, icon: Icon, to, needsResult }) => {
    const locked = needsResult && !hasResult;
    const current = page === id;
    return (
      <button key={id} type="button" className="nav-item"
              aria-current={current ? "page" : undefined}
              disabled={locked} title={locked ? t("navLocked") : undefined}
              onClick={() => { setMoreOpen(false); go(to); }}>
        <Icon size={21} strokeWidth={current ? 2.2 : 1.8} aria-hidden="true" />
        <span>{t(`nav_${id}`)}</span>
      </button>
    );
  };
  return (
    <div className="shell">
      <a className="skip-link" href="#main">{t("skip")}</a>
      <header className="topbar">
        <Brand />
        {hasResult && (
          <button type="button" className="field-chip" onClick={() => go("setup")}>
            <MapPin size={15} aria-hidden="true" />
            <span>{t("fieldChip")}</span>
            <bdi>{fieldLabel(form, lang)}</bdi>
          </button>
        )}
        <div className="topbar-end"><LanguageSwitch /></div>
      </header>

      <nav className="nav" aria-label={t("mainNav")}>
        {NAV.map(item)}
        <button type="button" className="nav-item nav-more" aria-expanded={moreOpen}
                aria-current={inMore ? "page" : undefined} onClick={() => setMoreOpen((o) => !o)}>
          <MoreHorizontal size={21} aria-hidden="true" />
          <span>{t("nav_more")}</span>
        </button>
        {moreOpen && <div className="nav-more-list">{MORE.map(item)}</div>}
      </nav>

      <main id="main" className="main" tabIndex={-1}>{children}</main>

      {hasGuide(page) && !guide && (
        <button type="button" className="guide-fab" onClick={() => { markSeen(page); setGuide(page); }}>
          <CirclePlay size={20} aria-hidden="true" /><span>{t("guide_open")}</span>
        </button>
      )}
      {guide && <Guide key={guide} page={guide} onClose={() => setGuide(null)} />}
    </div>
  );
}
