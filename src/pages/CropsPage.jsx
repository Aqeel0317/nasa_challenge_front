import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { useI18n } from "../i18n.jsx";
import { Advanced, Level, PageHeader, Panel } from "../components/ui.jsx";

const AXIS = { fill: "var(--muted)", fontSize: 12 };
const fitLevel = (v) => (v >= 0.75 ? "good" : v >= 0.5 ? "watch" : "risk");
const trend = (now, fut) => (fut - now > 0.05 ? "up" : fut - now < -0.05 ? "down" : "flat");
const TREND_ICON = { up: ArrowUp, flat: ArrowRight, down: ArrowDown };

export default function CropsPage({ rows }) {
  const { t, crop } = useI18n();
  // Headline names main crops, not cover crops
  const best = (season) => rows.filter((r) => r.season === season && r.role !== "cover").sort((a, b) => b.now - a.now)[0];
  const bw = best("warm"), bc = best("cool");

  return (
    <div className="page">
      <PageHeader title={t("nav_crops")} lead={t("cropsLeadSimple")} />
      {bw && bc && (
        <p className="headline">{t("fitHeadline", { warm: crop(bw.crop), cool: crop(bc.crop) })}</p>
      )}

      <div className="detail-grid">
        {["warm", "cool"].map((season) => (
          <Panel key={season} title={t(`${season}Season`)}>
            <ul className="fit-list">
              {rows.filter((r) => r.season === season).sort((a, b) => b.now - a.now).map((r) => {
                const lvl = fitLevel(r.now);
                const tr = trend(r.now, r.future);
                const Icon = TREND_ICON[tr];
                return (
                  <li key={r.crop} className="fit-row">
                    <div className="fit-head">
                      <span className="fit-name">{crop(r.crop)}</span>
                      <Level level={lvl}>{t(`fit_${lvl}`)}</Level>
                    </div>
                    <div className="fit-track" aria-hidden="true">
                      <span className={`fit-fill fit-${lvl}`} style={{ inlineSize: `${Math.round(r.now * 100)}%` }} />
                      <span className="fit-future" style={{ insetInlineStart: `calc(${Math.round(r.future * 100)}% - 1px)` }} />
                    </div>
                    <span className={`fit-trend trend-${tr}`}>
                      <Icon size={14} aria-hidden="true" className={tr === "flat" ? "flip-rtl" : ""} />
                      {t(`trend_${tr}`)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Panel>
        ))}
      </div>
      <div className="cal-key">
        <span><i className="fit-good" />{t("fit_good")}</span>
        <span><i className="fit-watch" />{t("fit_watch")}</span>
        <span><i className="fit-risk" />{t("fit_risk")}</span>
        <span><i className="key-future" />{t("fitFutureKey")}</span>
      </div>

      <Advanced label={t("advancedCharts")}>
        <p className="muted small">{t("fitLead")}</p>
        <div className="detail-grid">
          {["warm", "cool"].map((season) => {
            const data = rows.filter((r) => r.season === season)
              .sort((a, b) => b.now - a.now).map((r) => ({ ...r, label: crop(r.crop) }));
            return (
              <Panel key={season} title={t(`${season}Season`)}>
                <div className="chart">
                  <ResponsiveContainer width="100%" height={70 + data.length * 36}>
                    <BarChart data={data} layout="vertical" margin={{ left: 0, right: 12 }} barGap={2}>
                      <CartesianGrid stroke="var(--line)" horizontal={false} />
                      <XAxis type="number" domain={[0, 1]} tick={AXIS} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="label" width={150} tick={{ ...AXIS, fill: "var(--ink)" }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8 }} />
                      <Legend />
                      <Bar dataKey="now" name={t("today")} fill="var(--canopy)" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="future" name={t("future")} fill="var(--kharif)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            );
          })}
        </div>
      </Advanced>
    </div>
  );
}
