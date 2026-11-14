import { Download, FileJson, LineChart, Pencil } from "lucide-react";
import { useI18n } from "../i18n.jsx";
import { Button, PageHeader, Panel, ScoreBar, Stat } from "../components/ui.jsx";
import FieldStrip from "../components/FieldStrip.jsx";

function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

// CSV keeps English names so spreadsheets read it the same in either language.
function toCsv(rotations) {
  const rows = rotations.flatMap((r) => r.sequence.map((c, j) => ({
    option: r.rank, year: Math.floor(j / 2) + 1, season: r.seasons[j], crop: c,
    ...Object.fromEntries(Object.entries(r.scores).map(([k, v]) => [k, v.toFixed(3)])),
    robustness: r.robustness.toFixed(3),
  })));
  const head = Object.keys(rows[0] || {});
  return [head.join(","), ...rows.map((row) => head.map((h) => `"${row[h]}"`).join(","))].join("\n");
}

// The score the plans are ranked by: today (70%) and the 2041-2050 climate (30%)
const rankScore = (p) => 0.7 * p.total + 0.3 * (p.future_total ?? p.total);
export const planName = (p, t) => (p.current ? t("yourRotation") : t("option", { n: p.rank }));

// Why / Evidence / Benefits / Gaps / Risks, straight from the model run (en + ur)
const BLOCKS = [["why", "🎯"], ["evidence", "🛰️"], ["benefits", "✅"], ["gaps", "❔"], ["risks", "⚠️"]];
function PlanReport({ report, lang, t }) {
  if (!report) return null;
  return (
    <div className="plan-report">
      {BLOCKS.map(([k, icon]) => (report[k]?.length ? (
        <section key={k} className={`report-block report-${k}`}>
          <h3><span aria-hidden="true">{icon}</span> {t(`report_${k}`)}</h3>
          <ul>
            {report[k].map((item, j) => (
              <li key={j}>
                <span>{lang === "ur" ? item.ur : item.en}</span>
                {item.source && (
                  <small className="report-src">
                    {item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer">{item.source}</a> : item.source}
                    {item.date ? ` · ${item.date}` : ""}
                  </small>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null))}
    </div>
  );
}

export default function PlansPage({ result, selected, setSelected, go }) {
  const { t, crop, lang } = useI18n();
  const plans = result.rotations;
  const plan = plans[selected] || plans[0];
  const best = plans.find((p) => !p.current);
  const dec = new Set(plans.map((x) => Math.round(rankScore(x) * 100))).size < plans.length ? 1 : 0;

  return (
    <div className="page">
      <PageHeader
        title={t("plansTitle")}
        lead={t("plansLead")}
        actions={<>
          <Button icon={Pencil} onClick={() => go("setup")}>{t("editInputs")}</Button>
          <Button icon={Download} disabled={!plans.length}
                  onClick={() => download("rotation_plan.csv", toCsv(plans), "text/csv")}>CSV</Button>
          <Button icon={FileJson} variant="ghost"
                  onClick={() => download("rotation_plan.json", JSON.stringify(result, null, 2), "application/json")}>JSON</Button>
        </>}
      />

      {/* close scores: show a decimal so the ranking is visible */}
      {!plans.length ? (
        <div className="notice">{t("noRotation")}</div>
      ) : (
        <div className="plans-layout">
          <div className="plan-list" role="listbox" aria-label={t("plansTitle")}>
            {plans.map((p, i) => (
              <button key={p.current ? "current" : p.rank} type="button" role="option" aria-selected={i === selected}
                      className={`plan-item ${p.current ? "plan-item-current" : ""}`} onClick={() => setSelected(i)}>
                <span className="plan-item-head">
                  <span className="plan-item-name">{planName(p, t)}</span>
                  {p === best && <span className="badge">{t("bestMatch")}</span>}
                  {p.current && <span className="badge badge-current">{t("nowGrowing")}</span>}
                  <bdi className="plan-item-score num">{(rankScore(p) * 100).toFixed(dec)}</bdi>
                </span>
                {p.strategy && !p.current && <span className="plan-item-strategy">{t(`strategy_${p.strategy}`)}</span>}
                <span className="plan-item-crops">
                  {p.sequence.map((c, j) => (
                    <span key={j} className={`crop-dot crop-dot-${p.seasons[j]}`}>{crop(c)}</span>
                  ))}
                </span>
              </button>
            ))}
          </div>

          <article className="plan-detail" aria-live="polite">
            <Panel className="plan-hero">
              <div className="plan-hero-head">
                <h2>{planName(plan, t)}</h2>
                {plan === best && <span className="badge">{t("bestMatch")}</span>}
                {plan.strategy && !plan.current && <span className="badge badge-soft">{t(`strategy_${plan.strategy}`)}</span>}
              </div>
              <FieldStrip sequence={plan.sequence} seasons={plan.seasons} />
              <div className="stats-row">
                <Stat label={t("robustness")} value={`${Math.round(plan.robustness * 100)}%`} />
                <Stat label={t("irrigationPlan")} value={`${Math.round(plan.trajectory.irrigation_mm)} ${t("mm")}`} />
              </div>
            </Panel>

            <div className="detail-grid">
              <Panel title={t("howScores")}>
                {Object.entries(plan.scores).map(([k, v]) => <ScoreBar key={k} label={t(k)} value={v} />)}
              </Panel>
              <Panel title={t("planEvidenceTitle")}>
                <p className="muted small">{t("planEvidenceLead")}</p>
                <Button icon={LineChart} onClick={() => go("soil")}>{t("seeSoil")}</Button>
              </Panel>
            </div>
            <PlanReport report={plan.report} lang={lang} t={t} />
            <p className="muted small judgement-note">🤝 {t("adviceNote")}</p>
          </article>
        </div>
      )}
    </div>
  );
}
