import { Layers, MapPin, Sprout, SlidersHorizontal, LineChart, Tractor } from "lucide-react";
import { useI18n } from "../i18n.jsx";
import LanguageSwitch from "./LanguageSwitch.jsx";
import Brand from "./Brand.jsx";

const NAV = [
  { id: "setup", icon: SlidersHorizontal, to: "setup/1", needsResult: false },
  { id: "plans", icon: Layers, to: "plans", needsResult: false },
  { id: "farm", icon: Tractor, to: "farm", needsResult: false },
  { id: "field", icon: MapPin, to: "field", needsResult: true },
  { id: "crops", icon: Sprout, to: "crops", needsResult: true },
  { id: "soil", icon: LineChart, to: "soil", needsResult: true },
];

export default function AppShell({ page, go, hasResult, form, children }) {
  const { t } = useI18n();
  return (
    <div className="shell">
      <a className="skip-link" href="#main">{t("skip")}</a>
      <header className="topbar">
        <Brand />
        {hasResult && (
          <button type="button" className="field-chip" onClick={() => go("setup/1")}>
            <MapPin size={15} aria-hidden="true" />
            <span>{t("fieldChip")}</span>
            <bdi dir="ltr" className="num">{form.lat}, {form.lon}</bdi>
          </button>
        )}
        <div className="topbar-end"><LanguageSwitch /></div>
      </header>

      <nav className="nav" aria-label={t("mainNav")}>
        {NAV.map(({ id, icon: Icon, to, needsResult }) => {
          const locked = needsResult && !hasResult;
          const current = page === id;
          return (
            <button key={id} type="button" className="nav-item"
                    aria-current={current ? "page" : undefined}
                    disabled={locked} title={locked ? t("navLocked") : undefined}
                    onClick={() => go(to)}>
              <Icon size={21} strokeWidth={current ? 2.2 : 1.8} aria-hidden="true" />
              <span>{t(`nav_${id}`)}</span>
            </button>
          );
        })}
      </nav>

      <main id="main" className="main" tabIndex={-1}>{children}</main>
    </div>
  );
}
