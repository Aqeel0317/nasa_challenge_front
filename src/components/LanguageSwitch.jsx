import { useI18n } from "../i18n.jsx";

// Two-option switch. Each label is written in its own language so a reader
// of either language can always find the way back.
export default function LanguageSwitch() {
  const { lang, setLang, t } = useI18n();
  return (
    <div className="lang-switch" role="group" aria-label={t("language")}>
      <button type="button" lang="en" aria-pressed={lang === "en"}
              className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>
        English
      </button>
      <button type="button" lang="ur" aria-pressed={lang === "ur"}
              className={lang === "ur" ? "on" : ""} onClick={() => setLang("ur")}>
        اردو
      </button>
    </div>
  );
}
