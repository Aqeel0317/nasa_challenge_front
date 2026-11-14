import { useState } from "react";
import { useI18n } from "../../i18n.jsx";

// Plain-language meanings of the science words the app uses (English + Urdu).
export const TERMS = ["ndvi", "et", "sma", "wb", "frost"];

// A small "i" next to a word: tap to read what it means. Never blocks anything.
export function Term({ k }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <span className="term">
      <button type="button" className="term-i" aria-expanded={open} aria-label={t(`gl_${k}_name`)}
              title={t(`gl_${k}`)} onClick={() => setOpen((o) => !o)}>i</button>
      {open && <span className="term-pop" role="note">{t(`gl_${k}`)}</span>}
    </span>
  );
}

// The full list, folded away until the farmer opens it.
export default function Glossary() {
  const { t } = useI18n();
  return (
    <details className="glossary">
      <summary>📖 {t("gl_title")}</summary>
      <dl>
        {TERMS.map((k) => (
          <div key={k}>
            <dt>{t(`gl_${k}_name`)}</dt>
            <dd>{t(`gl_${k}`)}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
