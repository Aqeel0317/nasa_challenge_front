import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { useI18n } from "../../i18n.jsx";
import { Panel } from "../ui.jsx";
import { KHARIF_ORDER, RABI_ORDER } from "./farmUtils.js";

// Split plots into kharif and rabi groups, in farm-layout order.
export function groupPlots(plots) {
  const order = (list) => (a, b) => list.indexOf(a.crop) - list.indexOf(b.crop);
  return [
    { key: "kharif", plots: plots.filter((p) => p.season_group !== "rabi").sort(order(KHARIF_ORDER)) },
    { key: "rabi", plots: plots.filter((p) => p.season_group === "rabi").sort(order(RABI_ORDER)) },
  ].filter((g) => g.plots.length);
}

// Farmer-facing summaries: plain words, traffic lights, and familiar units.

// 1 t/ha = 1000 kg / 40 kg per maund / 2.471 acres per hectare
export const toUnit = (tha, unit) => (unit === "maund" ? tha * 10.12 : tha);
const fmtYield = (tha, unit) => toUnit(tha, unit).toFixed(unit === "maund" ? 0 : 1);

// Share of the best possible yield for this field (normal weather, full water).
export function cropStatus(plot) {
  const best = plot.potential_yield_t_ha || plot.baseline.summary.yield_t_ha || 1;
  const share = plot.scenario.summary.yield_t_ha / best;
  const level = share >= 0.85 ? "good" : share >= 0.6 ? "watch" : "risk";
  return { share, level };
}

const ICON = { good: CheckCircle2, watch: AlertTriangle, risk: XCircle };

// Daily health colour for the season calendar
function dayHealth(plot, i) {
  const st = plot.scenario.stage[i];
  if (st < 0 || st === 4) return null;
  if (plot.scenario.waterlog[i] === 1) return "wet";
  const s = plot.scenario.series;
  const water = 1 - (s.ks[i] ?? 1);
  const heat = st === 2 ? s.heat[i] ?? 0 : 0;
  const worst = Math.max(water, heat);
  return worst < 0.15 ? "good" : worst < 0.45 ? "watch" : "risk";
}

export function Headline({ data }) {
  const { t, crop } = useI18n();
  const changes = data.plots.map((p) => ({
    crop: p.crop,
    pct: p.baseline.summary.yield_t_ha
      ? Math.round((100 * (p.scenario.summary.yield_t_ha - p.baseline.summary.yield_t_ha)) / p.baseline.summary.yield_t_ha)
      : 0,
  })).sort((a, b) => a.pct - b.pct);
  const worst = changes[0], best = changes[changes.length - 1];
  const risky = data.plots.filter((p) => cropStatus(p).level === "risk");

  let text;
  if (data.scenario === "normal") {
    text = risky.length
      ? t("hl_normal_risk", { crops: risky.slice(0, 4).map((p) => crop(p.crop)).join(t("listSep")) + (risky.length > 4 ? t("andMore", { n: risky.length - 4 }) : "") })
      : t("hl_normal_ok");
  } else if (worst.pct > -5) {
    text = t("hl_all_ok");
  } else {
    text = t("hl_worst", { worst: crop(worst.crop), pct: Math.abs(worst.pct), best: crop(best.crop) });
  }
  if (data.scenario !== "normal" && risky.length >= 2) {
    text = `${risky.length === data.plots.length ? t("hl_risk_all") : t("hl_risk_count", { n: risky.length, total: data.plots.length })} ${text}`;
  }
  return <p className="headline" role="status">{text}</p>;
}

export function CropStatusCards({ data, selected, onSelect, unit }) {
  const { t, cropShort } = useI18n();
  return groupPlots(data.plots).map((g) => (
    <div key={g.key} className="status-group">
      <h3 className="group-heading">{t(`${g.key}Block`)}</h3>
      <div className="status-cards">
        {g.plots.map((p) => {
          const { share, level } = cropStatus(p);
          const Icon = ICON[level];
          const b = p.baseline.summary.yield_t_ha, s = p.scenario.summary.yield_t_ha;
          const diff = toUnit(s - b, unit);
          return (
            <button key={p.crop} type="button" className={`status-card status-${level}`}
                    aria-pressed={selected === p.crop} onClick={() => onSelect(p.crop)}>
              <span className="status-top">
                <span className="status-crop">{cropShort(p.crop)}</span>
                <span className="status-word"><Icon size={15} aria-hidden="true" />{t(`lvl_${level}`)}</span>
              </span>
              <span className="status-yield">
                <bdi className="num">{fmtYield(s, unit)}</bdi>
                <span className="status-unit">{t(`unit_${unit}`)}</span>
              </span>
              <span className="status-label">{t(`ylabel_${p.yield_label.replace(" ", "_")}`)}</span>
              <span className="share-row" title={t("shareOfBest", { pct: Math.round(share * 100) })}>
                <span className="share-track" aria-hidden="true">
                  <span className="share-fill" style={{ inlineSize: `${Math.min(100, Math.round(share * 100))}%` }} />
                </span>
                <bdi className="share-pct">{Math.round(share * 100)}%</bdi>
              </span>
              <span className="status-note">
                {Math.abs(diff) < (unit === "maund" ? 1 : 0.1)
                  ? t("sameAsNormal")
                  : t(diff < 0 ? "lessThanNormal" : "moreThanNormal",
                      { n: Math.abs(diff).toFixed(unit === "maund" ? 0 : 1), unit: t(`unit_${unit}`) })}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  ));
}

export function SeasonCalendar({ data, day, onDay }) {
  const { t, cropShort, lang } = useI18n();
  const n = data.dates.length;
  const locale = lang === "ur" ? "ur-PK" : "en-GB";
  const months = data.dates.map((iso, i) => ({ iso, i })).filter(({ iso }) => iso.endsWith("-01"));

  // Collapse days into runs of the same colour so each row is a handful of bars.
  const runs = (plot) => {
    const out = [];
    for (let i = 0; i < n; i += 1) {
      const h = dayHealth(plot, i);
      const last = out[out.length - 1];
      if (last && last.h === h) last.to = i;
      else out.push({ h, from: i, to: i });
    }
    return out.filter((r) => r.h);
  };

  return (
    <Panel title={t("calTitle")}>
      <p className="muted small panel-sub">{t("calLead")}</p>
      <div className="calendar" dir="ltr">
        <div className="cal-months">
          <span />
          <div className="cal-track">
            {months.map(({ iso, i }) => (
              <span key={iso} style={{ left: `${(100 * i) / n}%` }}>
                {new Date(`${iso}T00:00:00`).toLocaleDateString(locale, { month: "short" })}
              </span>
            ))}
          </div>
        </div>
        {groupPlots(data.plots).map((g) => [
          <div key={g.key} className="cal-group" dir="auto">{t(`${g.key}Block`)}</div>,
          ...g.plots.map((p) => (
          <div key={p.crop} className="cal-row">
            <span className="cal-name" dir="auto">{cropShort(p.crop)}</span>
            <div className="cal-track" onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              onDay(Math.round(((e.clientX - r.left) / r.width) * (n - 1)));
            }}>
              {runs(p).map((r) => (
                <span key={r.from} className={`cal-run cal-${r.h}`}
                      style={{ left: `${(100 * r.from) / n}%`, width: `${(100 * (r.to - r.from + 1)) / n}%` }} />
              ))}
              <span className="cal-today" style={{ left: `${(100 * day) / n}%` }} />
            </div>
          </div>
          )),
        ])}
      </div>
      <div className="cal-key">
        {["good", "watch", "risk", "wet"].map((k) => (
          <span key={k}><i className={`cal-${k}`} />{t(`cal_${k}`)}</span>
        ))}
      </div>
    </Panel>
  );
}

export function HarvestOutlook({ data, unit }) {
  const { t, cropShort } = useI18n();
  return (
    <Panel title={t("harvestTitle", { unit: t(`unit_${unit}`) })}>
      <p className="muted small panel-sub">{t("harvestLeadRow")}</p>
      {groupPlots(data.plots).map((g) => (
        <div key={g.key} className="harvest">
          <div className="cal-group">{t(`${g.key}Block`)}</div>
          {g.plots.map((p) => {
            const b = p.baseline.summary.yield_t_ha, s = p.scenario.summary.yield_t_ha;
            const best = Math.max(p.potential_yield_t_ha, b, s, 0.01);
            return (
              <div key={p.crop} className="harvest-row">
                <span className="harvest-name">{cropShort(p.crop)}</span>
                <div className="harvest-bars">
                  <div className="hbar hbar-normal" style={{ inlineSize: `${Math.max(2, (100 * b) / best)}%` }}>
                    <bdi>{fmtYield(b, unit)}</bdi>
                  </div>
                  <div className={`hbar hbar-scenario status-${cropStatus(p).level}`} style={{ inlineSize: `${Math.max(2, (100 * s) / best)}%` }}>
                    <bdi>{fmtYield(s, unit)}</bdi>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
      <div className="cal-key">
        <span><i className="hbar-normal" />{t("yieldNormal")}</span>
        <span><i className="hbar-scenario-key" />{t("yieldScenario")}</span>
      </div>
    </Panel>
  );
}

export function WeatherByMonth({ data }) {
  const { t, lang } = useI18n();
  const locale = lang === "ur" ? "ur-PK" : "en-GB";
  const rows = useMemo(() => {
    const byMonth = new Map();
    data.dates.forEach((iso, i) => {
      const key = iso.slice(0, 7);
      if (!byMonth.has(key)) {
        byMonth.set(key, {
          month: new Date(`${key}-01T00:00:00`).toLocaleDateString(locale, { month: "short" }),
          normal: 0, scenario: 0, hotNormal: 0, hot: 0,
        });
      }
      const m = byMonth.get(key);
      m.normal += data.weather.baseline.rain[i] || 0;
      m.scenario += data.weather.scenario.rain[i] || 0;
      m.hotNormal += (data.weather.baseline.tmax[i] ?? 0) >= 40 ? 1 : 0;
      m.hot += (data.weather.scenario.tmax[i] ?? 0) >= 40 ? 1 : 0;
    });
    return [...byMonth.values()].map((m) => ({ ...m, normal: Math.round(m.normal), scenario: Math.round(m.scenario) }));
  }, [data, locale]);

  return (
    <Panel title={t("wxTitle")}>
      <p className="muted small panel-sub">{t("wxRainLead")}</p>
      <div className="chart">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={rows} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={1}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="month" tick={{ fill: "var(--muted)", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "var(--line)" }} interval={0} />
            <YAxis tick={{ fill: "var(--muted)", fontSize: 12 }} tickLine={false} axisLine={false} width={36} />
            <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8 }}
                     cursor={{ fill: "var(--surface-2)" }} formatter={(v) => `${v} ${t("mm")}`} />
            <Legend />
            <Bar dataKey="normal" name={t("yieldNormal")} fill="var(--line-strong)" radius={[3, 3, 0, 0]} />
            <Bar dataKey="scenario" name={t("yieldScenario")} fill="var(--rabi)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="muted small panel-sub">{t("wxHotLead")}</p>
      <div className="hot-row" dir="ltr">
        {rows.map((m) => (
          <div key={m.month} className="hot-cell">
            <span className={`hot-n ${m.hot > m.hotNormal ? "hot-up" : ""}`}>{m.hot}</span>
            <span className="hot-m">{m.month}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// Simple vertical tank for soil water
export function WaterTank({ value }) {
  const { t } = useI18n();
  const v = Math.max(0, Math.min(100, value ?? 0));
  const word = v < 30 ? "tank_dry" : v < 60 ? "tank_ok" : "tank_good";
  return (
    <div className="tank-wrap">
      <div className="tank" aria-hidden="true"><div className="tank-fill" style={{ height: `${v}%` }} /></div>
      <div>
        <div className="gauge-label">{t("soilWaterL")}</div>
        <div className="gauge-value"><bdi>{Math.round(v)}%</bdi></div>
        <div className={`gauge-word ${word}`}>{t(word)}</div>
      </div>
    </div>
  );
}
