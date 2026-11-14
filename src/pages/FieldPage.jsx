import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { CloudRain, Droplets, Flame, Sun, ThermometerSun } from "lucide-react";
import { useI18n } from "../i18n.jsx";
import Glossary, { Term } from "../components/farm/Glossary.jsx";
import { Advanced, Level, PageHeader, Panel } from "../components/ui.jsx";

const AXIS = { fill: "var(--muted)", fontSize: 12 };
const TIP = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8 };

// Simple, explainable thresholds. Adjust with local agronomists.
const band = (v, low, high) => (v < low ? "good" : v < high ? "watch" : "risk");
function climateRisks(extremes, future) {
  const dp = future.delta_p_pct;
  return [
    { key: "heat", icon: Flame, value: Math.round(extremes.heat_days_per_year),
      unit: "days", level: band(extremes.heat_days_per_year, 10, 40) },
    { key: "dry", icon: Sun, value: Math.round(extremes.max_dry_spell_days),
      unit: "days", level: band(extremes.max_dry_spell_days, 20, 45) },
    { key: "warm", icon: ThermometerSun, value: `+${future.delta_t.toFixed(1)}`,
      unit: "°C", level: band(future.delta_t, 1, 2) },
    { key: "rain", icon: CloudRain, value: `${dp > 0 ? "+" : ""}${Math.round(dp)}`,
      unit: "%", level: dp < -15 || dp > 25 ? "risk" : dp < -5 || dp > 10 ? "watch" : "good" },
  ];
}

function soilChecks(soil) {
  const soc = soil.soc ?? 0, ph = soil.phh2o ?? 7, n = soil.nitrogen ?? 0;
  return [
    { key: "soc", value: `${soc.toFixed(1)} g/kg`,
      level: soc < 5 ? "risk" : soc < 10 ? "watch" : "good" },
    { key: "ph", value: ph.toFixed(1),
      level: ph < 5.5 || ph > 8.5 ? "risk" : ph > 7.8 ? "watch" : "good",
      sub: ph < 5.5 ? "acid" : ph > 8.5 ? "alkaline" : ph > 7.8 ? "slightly_alkaline" : "neutral" },
    { key: "n", value: `${n.toFixed(2)} g/kg`,
      level: n < 0.7 ? "risk" : n < 1.5 ? "watch" : "good" },
  ];
}

export default function FieldPage({ site }) {
  const { t, lang, source } = useI18n();
  const { climate, extremes, future, soil, ndvi, sources } = site;
  const locale = lang === "ur" ? "ur-PK" : "en-GB";
  const monthName = (i, style = "short") => new Date(2024, i, 1).toLocaleString(locale, { month: style });
  const seasons = site.seasons || { warm: [4, 5, 6, 7, 8, 9], cool: [10, 11, 0, 1, 2, 3] };
  const fallback = Object.values(sources).some((s) => s.includes("fallback"));

  const temps = climate.t_mean, rain = climate.precip_mm;
  const hottest = temps.indexOf(Math.max(...temps));
  const coolest = temps.indexOf(Math.min(...temps));
  const wettest = rain.indexOf(Math.max(...rain));
  const yearRain = Math.round(rain.reduce((a, b) => a + b, 0));
  const maxRain = Math.max(...rain, 1);

  const greenShare = Math.round(100 * ndvi.series.filter(([, v]) => v >= 0.4).length / Math.max(1, ndvi.series.length));
  const bareShare = Math.round(ndvi.bare_soil_fraction * 100);

  // Temperature colour for the month tiles: cool blue to hot red
  const tempColor = (c) => {
    const x = Math.max(0, Math.min(1, (c - 5) / 30));
    const hue = 210 - 200 * x;
    return `hsl(${hue} 60% 86%)`;
  };

  return (
    <div className="page">
      <PageHeader title={t("yourField")} lead={t("fieldLead")} />
      {fallback && <div className="notice">{t("fallbackAlert")}</div>}

      {/* ---- key facts ---- */}
      <div className="fact-row">
        <div className="fact"><span className="fact-label">{t("f_hottest")}</span>
          <span className="fact-value">{monthName(hottest, "long")}</span>
          <bdi className="fact-sub">{Math.round(climate.t_max[hottest])} °C {t("f_dayMax")}</bdi></div>
        <div className="fact"><span className="fact-label">{t("f_coolest")}</span>
          <span className="fact-value">{monthName(coolest, "long")}</span>
          <bdi className="fact-sub">{Math.round(climate.t_min[coolest])} °C {t("f_nightMin")}</bdi></div>
        <div className="fact"><span className="fact-label">{t("f_wettest")}</span>
          <span className="fact-value">{monthName(wettest, "long")}</span>
          <bdi className="fact-sub">{Math.round(rain[wettest])} {t("mm")}</bdi></div>
        <div className="fact"><span className="fact-label">{t("f_yearRain")}</span>
          <bdi className="fact-value">{yearRain} {t("mm")}</bdi>
          <span className="fact-sub">{t(yearRain < 300 ? "f_dry" : yearRain < 700 ? "f_moderate" : "f_wet")}</span></div>
      </div>

      {/* ---- the year at a glance ---- */}
      <Panel title={t("yearTitle")}>
        <p className="muted small panel-sub">{t("yearLead")}</p>
        <div className="months">
          {temps.map((c, i) => {
            const s = seasons.warm.includes(i) ? "warm" : "cool";
            return (
              <div key={i} className={`month month-${s}`}>
                <span className="month-name">{monthName(i)}</span>
                <span className="month-temp" style={{ background: tempColor(c) }}><bdi>{Math.round(c)}°</bdi></span>
                <span className="month-rain" aria-label={`${Math.round(rain[i])} ${t("mm")}`}>
                  <span className="month-rain-fill" style={{ height: `${Math.max(4, (100 * rain[i]) / maxRain)}%` }} />
                </span>
                <bdi className="month-mm">{Math.round(rain[i])}</bdi>
              </div>
            );
          })}
        </div>
        <div className="cal-key">
          <span><i className="key-temp" />{t("k_temp")}</span>
          <span><Droplets size={14} aria-hidden="true" />{t("k_rain")}</span>
          <span><i className="key-warm" />{t("warmSeason")}</span>
          <span><i className="key-cool" />{t("coolSeason")}</span>
        </div>
      </Panel>

      {/* ---- climate risks ---- */}
      <Panel title={t("riskTitle")}>
        <div className="risk-grid">
          {climateRisks(extremes, future).map(({ key, icon: Icon, value, unit, level }) => (
            <div key={key} className={`risk risk-${level}`}>
              <div className="risk-head">
                <Icon size={20} aria-hidden="true" />
                <Level level={level}>{t(`lvl_r_${level}`)}</Level>
              </div>
              <bdi className="risk-value">{value}{unit === "%" ? "%" : ` ${unit === "days" ? t("days") : unit}`}</bdi>
              <span className="risk-label">{t(`r_${key}`)}</span>
              <span className="risk-means">{t(`r_${key}_${level}`)}</span>
            </div>
          ))}
        </div>
      </Panel>

      {/* ---- soil check ---- */}
      <div className="detail-grid">
        <Panel title={t("soilCheck")}>
          <div className="soil-type">
            <div className="texture-bar" aria-hidden="true">
              <span className="tx-sand" style={{ inlineSize: `${soil.sand}%` }} />
              <span className="tx-silt" style={{ inlineSize: `${soil.silt ?? Math.max(0, 100 - soil.sand - soil.clay)}%` }} />
              <span className="tx-clay" style={{ inlineSize: `${soil.clay}%` }} />
            </div>
            <div className="cal-key">
              <span><i className="tx-sand" />{t("sand")} <bdi>{Math.round(soil.sand)}%</bdi></span>
              <span><i className="tx-silt" />{t("silt")} <bdi>{Math.round(soil.silt ?? 0)}%</bdi></span>
              <span><i className="tx-clay" />{t("clay")} <bdi>{Math.round(soil.clay)}%</bdi></span>
            </div>
            <p className="soil-type-name">{t(`soilType_${site.texture}`)}</p>
            <p className="muted small">{t(`soilTypeTip_${site.texture}`)}</p>
          </div>
          <ul className="checks">
            {soilChecks(soil).map((c) => (
              <li key={c.key}>
                <div className="check-head">
                  <span className="check-name">{t(`sc_${c.key}`)}</span>
                  <bdi className="check-val">{c.value}</bdi>
                  <Level level={c.level}>{t(c.sub ? `ph_${c.sub}` : `lvl_s_${c.level}`)}</Level>
                </div>
                <p className="muted small">{t(`tip_${c.key}_${c.level}`)}</p>
              </li>
            ))}
          </ul>
        </Panel>

        {/* ---- satellite view ---- */}
        <Panel title={t("satellite")}>
          <p className="sat-sentence">{t("satSentence", { green: greenShare, bare: bareShare, n: ndvi.crop_cycles_per_year })} <Term k="ndvi" /></p>
          <div className="green-strip" aria-hidden="true">
            {ndvi.series.map(([date, v]) => (
              <span key={date} title={`${date}: ${v.toFixed(2)}`}
                    style={{ background: v < 0.2 ? "var(--fallow)" : v < 0.4 ? "#c9c46a" : v < 0.6 ? "#7fae4a" : "#2f7d43" }} />
            ))}
          </div>
          <div className="strip-ends">
            <bdi>{new Date(`${ndvi.series[0][0]}T00:00:00`).toLocaleDateString(locale, { month: "short", year: "numeric" })}</bdi>
            <bdi>{new Date(`${ndvi.series[ndvi.series.length - 1][0]}T00:00:00`).toLocaleDateString(locale, { month: "short", year: "numeric" })}</bdi>
          </div>
          <div className="cal-key">
            <span><i style={{ background: "var(--fallow)" }} />{t("g_bare")}</span>
            <span><i style={{ background: "#c9c46a" }} />{t("g_little")}</span>
            <span><i style={{ background: "#7fae4a" }} />{t("g_green")}</span>
            <span><i style={{ background: "#2f7d43" }} />{t("g_dense")}</span>
          </div>
          <p className="muted small">{t("satNote")}</p>
        </Panel>
      </div>

      <p className="muted small">
        {t("sources")}: {Object.entries(sources).map(([k, v]) => `${t(k)}: ${source(v)}`).join("; ")}
      </p>

      <Advanced label={t("advancedCharts")}>
        <FieldCharts site={site} />
      </Advanced>
      <Glossary />
    </div>
  );
}

// The original technical charts, kept for advisers.
function FieldCharts({ site }) {
  const { t, lang } = useI18n();
  const { climate, ndvi } = site;
  const locale = lang === "ur" ? "ur-PK" : "en";
  const monthly = climate.precip_mm.map((_, i) => ({
    month: new Date(2024, i, 1).toLocaleString(locale, { month: "short" }),
    rain: Math.round(climate.precip_mm[i]),
    temp: +climate.t_mean[i].toFixed(1),
  }));
  const ndviSeries = ndvi.series.map(([date, v]) => ({ date, ndvi: +v.toFixed(3) }));
  return (
    <div className="detail-grid">
      <Panel title={t("typicalYear")}>
        <div className="chart">
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="month" tick={AXIS} tickLine={false} />
              <YAxis yAxisId="rain" tick={AXIS} tickLine={false} axisLine={false} width={40} />
              <YAxis yAxisId="temp" orientation="right" tick={AXIS} tickLine={false} axisLine={false} width={40} />
              <Tooltip contentStyle={TIP} />
              <Legend />
              <Bar yAxisId="rain" dataKey="rain" name={t("rainMm")} fill="var(--rabi)" radius={[4, 4, 0, 0]} />
              <Line yAxisId="temp" dataKey="temp" name={t("tempC")} stroke="var(--soil)" strokeWidth={2.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      <Panel title={t("ndvi")}>
        <div className="chart">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={ndviSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="date" tick={AXIS} tickLine={false} minTickGap={48} />
              <YAxis domain={[0, 1]} tick={AXIS} tickLine={false} axisLine={false} width={36} />
              <Tooltip contentStyle={TIP} />
              <Line dataKey="ndvi" name={t("ndvi")} stroke="var(--canopy)" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  );
}
