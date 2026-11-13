import { useEffect, useRef, useState } from "react";
import { Plus, Star, Trash2 } from "lucide-react";
import { useI18n } from "../../i18n.jsx";
import {
  CROP_ICON, KHARIF_ORDER, MAUND_PER_ACRE, MAX_FIELDS, NITROGEN_FIXERS, RABI_ORDER,
  bareDays, formatRs, rupees,
} from "./farmUtils.js";
import { cropStatus, toUnit } from "./FarmerDashboard.jsx";

const SHOCK_ICON = { drought: "🏜️", heatwave: "🔥", flood: "🌊" };
export const SCENARIO_ICON = { normal: "🌤️", drought: "🏜️", heatwave: "🔥", flood: "🌊", custom: "🎚️" };

const cropsOf = (f) => [f.kharif, f.rabi].filter(Boolean);

// Harvest value of one field in rupees. `which` is "baseline", "scenario" or a shock name.
export function fieldValue(field, byKey, which, shocks) {
  return cropsOf(field).reduce((sum, k) => {
    const p = byKey[k];
    if (!p) return sum;
    const tha = which === "baseline" || which === "scenario" ? p[which].summary.yield_t_ha : shocks?.[which]?.[k] ?? 0;
    return sum + rupees(k, tha, field.acres || 0);
  }, 0);
}

// Numbers that count up when they change: makes a loss land.
function useCountUp(value, ms = 900) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(value); return undefined; }
    const start = performance.now(), a = from.current;
    let raf = 0;
    const step = (now) => {
      const k = Math.min(1, (now - start) / ms);
      const v = a + (value - a) * (1 - (1 - k) ** 3);
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); from.current = value; };
  }, [value, ms]);
  return shown;
}

function Money({ value, lang, sign = false }) {
  const v = useCountUp(value);
  return <bdi className="num">{sign && value < 0 ? "−" : sign && value > 0 ? "+" : ""}{formatRs(v, lang)}</bdi>;
}

// ---------------------------------------------------------------------------
// "What could hit your farm": the same fields under each disaster, in rupees.
export function ShockPanel({ data, fields, scenario, onScenario }) {
  const { t, lang } = useI18n();
  const byKey = Object.fromEntries(data.plots.map((p) => [p.crop, p]));
  const normal = fields.reduce((s, f) => s + fieldValue(f, byKey, "baseline"), 0);
  const rows = ["drought", "heatwave", "flood"].map((name) => {
    const value = fields.reduce((s, f) => s + fieldValue(f, byKey, name, data.shocks), 0);
    const maunds = fields.reduce((s, f) => s + cropsOf(f).reduce((a, k) => a + (byKey[k]
      ? (byKey[k].baseline.summary.yield_t_ha - (data.shocks[name]?.[k] ?? 0)) * MAUND_PER_ACRE * (f.acres || 0) : 0), 0), 0);
    // Which field holds up best: smallest share of its normal value lost
    const perField = fields.map((f, i) => {
      const b = fieldValue(f, byKey, "baseline");
      return { i, share: b ? (b - fieldValue(f, byKey, name, data.shocks)) / b : 0 };
    }).sort((a, b) => a.share - b.share);
    return { name, loss: normal - value, pct: normal ? Math.round((100 * (normal - value)) / normal) : 0, maunds, safest: perField[0] };
  });
  const worst = [...rows].sort((a, b) => b.loss - a.loss)[0];

  return (
    <section className="shock" aria-labelledby="shock-title">
      <div className="shock-head">
        <h2 id="shock-title">{t("shockTitle")}</h2>
        <p className="shock-normal">{t("normalIncome")} <Money value={normal} lang={lang} /></p>
      </div>
      {worst.loss > 0 && (
        <p className="shock-headline" role="status">
          <span className="shock-emoji" aria-hidden="true">{SHOCK_ICON[worst.name]}</span>
          {t("worstThreat", { sc: t(`sc_${worst.name}`), money: formatRs(worst.loss, lang), pct: worst.pct })}
        </p>
      )}
      <div className="shock-cards">
        {rows.map((r) => (
          <button key={r.name} type="button" className={`shock-card shock-${r.name}`}
                  aria-pressed={scenario === r.name} onClick={() => onScenario(r.name)}>
            <span className="shock-icon" aria-hidden="true">{SHOCK_ICON[r.name]}</span>
            <span className="shock-name">{t(`sc_${r.name}`)}</span>
            <span className="shock-loss">
              <Money value={-r.loss} lang={lang} sign />
            </span>
            <span className="shock-meter" aria-hidden="true"><i style={{ inlineSize: `${Math.min(100, Math.max(0, r.pct))}%` }} /></span>
            <span className="shock-sub">
              {r.loss >= 0 ? t("shockPctLoss", { pct: r.pct }) : t("shockPctGain", { pct: -r.pct })}
              {" · "}{t("maundsLost", { n: Math.round(Math.abs(r.maunds)).toLocaleString("en-US") })}
            </span>
            {fields.length > 1 && (
              <span className="shock-safe">🛡️ {t("safestField", { n: r.safest.i + 1 })}</span>
            )}
            <span className="shock-watch">{scenario === r.name ? t("watchingNow") : t("tapToWatch")} ▶</span>
          </button>
        ))}
      </div>
      <p className="muted small">{t("priceNote")}</p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// The farmer's fields: choose crops and size, and see each rotation's result.
export function FieldBoard({ fields, setFields, data, selected, onSelect, unit }) {
  const { t, lang, crop } = useI18n();
  const byKey = data ? Object.fromEntries(data.plots.map((p) => [p.crop, p])) : {};
  const ready = (f) => data && cropsOf(f).every((k) => byKey[k]);
  const update = (i, patch) => setFields(fields.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const values = fields.map((f) => (ready(f) && f.acres ? fieldValue(f, byKey, "scenario") / f.acres : null));
  const best = values.some((v) => v != null) && fields.length > 1 ? values.indexOf(Math.max(...values.filter((v) => v != null))) : -1;

  return (
    <section className="fields" aria-labelledby="fields-title">
      <div className="fields-head">
        <h2 id="fields-title">{t("fieldsTitle")}</h2>
        <p className="muted">{t("fieldsHint")}</p>
      </div>
      <div className="field-cards">
        {fields.map((f, i) => {
          const done = ready(f);
          const perAcre = values[i];
          const vsCurrent = i > 0 && perAcre != null && values[0] != null ? perAcre - values[0] : null;
          const bare = done ? bareDays(f, byKey, data.dates.length) : null;
          const feeds = cropsOf(f).filter((k) => NITROGEN_FIXERS.has(k));
          return (
            <article key={i} className={`field-card ${selected === i ? "is-selected" : ""}`}
                     onClick={(e) => { if (!e.target.closest("select,input,button")) onSelect(i); }}>
              <header className="field-card-head">
                <button type="button" className="field-card-title" onClick={() => onSelect(i)} aria-pressed={selected === i}>
                  <span className="field-no">{i + 1}</span>
                  <span>
                    <strong>{t("fieldN", { n: i + 1 })}</strong>
                    <small>{i === 0 ? t("currentRotation") : t("optionN", { n: i })}</small>
                  </span>
                </button>
                {best === i && <span className="badge-best"><Star size={14} aria-hidden="true" />{t("bestHere2")}</span>}
                {fields.length > 1 && (
                  <button type="button" className="icon-btn" aria-label={t("removeField")} title={t("removeField")}
                          onClick={() => { setFields(fields.filter((_, j) => j !== i)); onSelect(0); }}>
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                )}
              </header>

              <div className="field-pickers">
                {[["kharif", KHARIF_ORDER, "☀️"], ["rabi", RABI_ORDER, "❄️"]].map(([season, list, icon]) => {
                  const key = f[season];
                  const p = key && byKey[key];
                  const lvl = p ? cropStatus(p).level : null;
                  const b = p?.baseline.summary.yield_t_ha, s = p?.scenario.summary.yield_t_ha;
                  const pct = p && b ? Math.round((100 * (s - b)) / b) : 0;
                  return (
                    <div key={season} className={`season-pick season-${season} ${lvl ? `status-${lvl}` : ""}`}>
                      <label>
                        <span className="season-name">{icon} {t(`${season}Crop`)}</span>
                        <select className="select" value={key || ""} onChange={(e) => update(i, { [season]: e.target.value || null })}>
                          <option value="">{t("noCrop")}</option>
                          {list.map((k) => <option key={k} value={k}>{CROP_ICON[k]} {crop(k)}</option>)}
                        </select>
                      </label>
                      {p && (
                        <div className="season-result">
                          <bdi className="num">{toUnit(s, unit).toFixed(unit === "maund" ? 0 : 1)}</bdi>
                          <span className="status-unit">{t(`unit_${unit}`)}</span>
                          {Math.abs(pct) >= 3 && (
                            <span className={`delta ${pct < 0 ? "delta-down" : "delta-up"}`}><bdi>{pct > 0 ? "+" : ""}{pct}%</bdi></span>
                          )}
                          <span className={`dot dot-${lvl}`} title={t(`lvl_${lvl}`)} aria-label={t(`lvl_${lvl}`)} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <label className="acres">
                <span>{t("acres")}</span>
                <input type="number" min="0.5" max="500" step="0.5" dir="ltr" value={f.acres}
                       onChange={(e) => update(i, { acres: Math.max(0, +e.target.value) })} />
              </label>

              {done && (
                <div className="field-facts">
                  <div className="fact-money">
                    <span className="muted small">{t("valuePerAcre")}</span>
                    <Money value={perAcre} lang={lang} />
                    {vsCurrent != null && Math.abs(vsCurrent) >= 500 && (
                      <span className={`delta ${vsCurrent < 0 ? "delta-down" : "delta-up"}`}>
                        {vsCurrent > 0 ? "+" : "−"}{formatRs(vsCurrent, lang)} {t("vsCurrent")}
                      </span>
                    )}
                  </div>
                  <ul className="fact-tags">
                    <li className={bare > 120 ? "tag-warn" : ""} title={t("bareTip")}>🟫 {t("bareDaysN", { n: bare })}</li>
                    {feeds.length > 0 && <li className="tag-good" title={t("nitrogenTip")}>🌱 {t("feedsSoil")}</li>}
                  </ul>
                </div>
              )}
            </article>
          );
        })}
        {fields.length < MAX_FIELDS && (
          <button type="button" className="field-add"
                  onClick={() => setFields([...fields, { kharif: "maize", rabi: "berseem", acres: 2 }])}>
            <Plus size={26} aria-hidden="true" />
            <span>{t("addField")}</span>
            <small className="muted">{t("addFieldHint")}</small>
          </button>
        )}
      </div>
    </section>
  );
}
