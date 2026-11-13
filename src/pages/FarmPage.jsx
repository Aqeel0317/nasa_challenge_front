import { Component, Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, MapPin } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, LineChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { simulateFarm } from "../api.js";
import { useI18n } from "../i18n.jsx";
import useStoredState from "../hooks/useStoredState.js";
import { Button, PageHeader, Panel } from "../components/ui.jsx";
import Farm2D from "../components/farm/Farm2D.jsx";
import BrandLoader, { MiniBars } from "../components/BrandLoader.jsx";
import { METRICS, STAGE_KEYS, stageOf } from "../components/farm/farmUtils.js";
import {
  CropStatusCards, Headline, HarvestOutlook, SeasonCalendar, WaterTank, WeatherByMonth, groupPlots, toUnit,
} from "../components/farm/FarmerDashboard.jsx";

const Farm3D = lazy(() => import("../components/farm/Farm3D.jsx"));

const SCENARIOS = ["normal", "drought", "heatwave", "flood", "custom"];
const IRRIGATION = ["rainfed", "deficit", "full"];
const CURVES = ["cc", "soil_water", "biomass"];
const AXIS = { fill: "var(--muted)", fontSize: 12 };
const TIP = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8 };

// The last farm year (May-April) that is complete, so NASA POWER has every day.
const now = new Date();
const LAST_YEAR = now.getFullYear() - (now.getMonth() >= 5 ? 1 : 2);
const YEARS = Array.from({ length: 12 }, (_, i) => LAST_YEAR - i);

const DEFAULTS = {
  lat: 31.42, lon: 73.08, year: LAST_YEAR, scenario: "drought",
  irrigation: "deficit", temp_offset: 2, rain_pct: 60,
};

class WebGLGuard extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export default function FarmPage({ fieldForm }) {
  const { t, lang, crop } = useI18n();
  const [settings, setSettings] = useStoredState("rotaterra-farm", DEFAULTS);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState("3d");
  const [metric, setMetric] = useState("ndvi");
  const [curve, setCurve] = useState("cc");
  const [selected, setSelected] = useState("rice");
  const [day, setDay] = useState(115);
  const [playing, setPlaying] = useState(false);
  const [unit, setUnit] = useStoredState("rotaterra-unit", { v: lang === "ur" ? "maund" : "tha" });
  const runId = useRef(0);

  const set = (k, v) => setSettings((s) => ({ ...s, [k]: v }));

  // Re-run the simulation shortly after any setting changes
  useEffect(() => {
    const id = ++runId.current;
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await simulateFarm(settings);
        if (id === runId.current) { setData(res); setError(""); }
      } catch (e) {
        if (id === runId.current) setError(e.message);
      } finally {
        if (id === runId.current) setBusy(false);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [settings]);

  // Season playback
  useEffect(() => {
    if (!playing || !data) return undefined;
    const timer = setInterval(() => {
      setDay((d) => {
        if (d >= data.dates.length - 1) { setPlaying(false); return d; }
        return d + 2;
      });
    }, 70);
    return () => clearInterval(timer);
  }, [playing, data]);

  const locale = lang === "ur" ? "ur-PK" : "en-GB";
  const fmtDate = (iso, opts = { day: "numeric", month: "long", year: "numeric" }) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(locale, opts);

  const plot = data?.plots.find((p) => p.crop === selected) || data?.plots[0];
  const d = data ? Math.min(day, data.dates.length - 1) : 0;

  const yieldRows = useMemo(() => data?.plots.map((p) => ({
    name: crop(p.crop),
    normal: p.baseline.summary.yield_t_ha,
    scenario: p.scenario.summary.yield_t_ha,
  })), [data, crop]);

  const curveRows = useMemo(() => {
    if (!data || !plot) return [];
    return data.dates.map((iso, i) => ({
      date: iso,
      scenario: plot.scenario.series[curve][i] == null ? null
        : curve === "cc" ? +(plot.scenario.series[curve][i] * 100).toFixed(1) : plot.scenario.series[curve][i],
      normal: plot.baseline.series[curve][i] == null ? null
        : curve === "cc" ? +(plot.baseline.series[curve][i] * 100).toFixed(1) : plot.baseline.series[curve][i],
    }));
  }, [data, plot, curve]);

  const weatherRows = useMemo(() => data?.dates.map((iso, i) => ({
    date: iso,
    rain: data.weather.scenario.rain[i],
    tmax: data.weather.scenario.tmax[i],
    tmaxNormal: data.weather.baseline.tmax[i],
  })), [data]);

  const monthTick = (iso) => fmtDate(iso, { month: "short" });
  const monthStarts = data ? data.dates.filter((iso) => iso.endsWith("-01")) : [];

  return (
    <div className="page page-wide">
      <PageHeader title={t("farmTitle")} lead={t("farmLead")} />

      {/* ---------------- controls ---------------- */}
      <Panel className="farm-controls">
        <div className="farm-controls-grid">
          <fieldset className="field">
            <legend className="field-label">{t("scenarioLabel")}</legend>
            <div className="chips">
              {SCENARIOS.map((s) => (
                <button key={s} type="button" className={`chip chip-sc chip-sc-${s}`}
                        aria-pressed={settings.scenario === s} onClick={() => set("scenario", s)}>
                  {t(`sc_${s}`)}
                </button>
              ))}
            </div>
            <p className="field-help">{t(`scDesc_${settings.scenario}`)}</p>
            {settings.scenario === "custom" && (
              <div className="sliders sliders-tight">
                <label className="field">
                  <span className="field-label">{t("tempChange")}
                    <bdi className="num">{settings.temp_offset > 0 ? "+" : ""}{settings.temp_offset} °C</bdi></span>
                  <input type="range" min="-3" max="8" step="0.5" value={settings.temp_offset}
                         onChange={(e) => set("temp_offset", +e.target.value)} />
                </label>
                <label className="field">
                  <span className="field-label">{t("rainChangeLabel")}
                    <bdi className="num">{settings.rain_pct}%</bdi></span>
                  <input type="range" min="0" max="250" step="10" value={settings.rain_pct}
                         onChange={(e) => set("rain_pct", +e.target.value)} />
                </label>
              </div>
            )}
          </fieldset>

          <div className="farm-controls-side">
            <fieldset className="field">
              <legend className="field-label">{t("irrigationMode")}</legend>
              <div className="segmented">
                {IRRIGATION.map((m) => (
                  <button key={m} type="button" aria-pressed={settings.irrigation === m}
                          onClick={() => set("irrigation", m)}>{t(`irr_${m}`)}</button>
                ))}
              </div>
            </fieldset>
            <div className="row-fields">
              <label className="field">
                <span className="field-label">{t("season")}</span>
                <select className="select" value={settings.year} onChange={(e) => set("year", +e.target.value)}>
                  {YEARS.map((y) => (
                    <option key={y} value={y}>{t("seasonOpt", { y, y2: y + 1 })}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">{t("latitude")}</span>
                <input type="number" step="0.01" dir="ltr" value={settings.lat}
                       onChange={(e) => set("lat", +e.target.value)} />
              </label>
              <label className="field">
                <span className="field-label">{t("longitude")}</span>
                <input type="number" step="0.01" dir="ltr" value={settings.lon}
                       onChange={(e) => set("lon", +e.target.value)} />
              </label>
            </div>
            {fieldForm && (
              <Button variant="ghost" icon={MapPin}
                      onClick={() => setSettings((s) => ({ ...s, lat: fieldForm.lat, lon: fieldForm.lon }))}>
                {t("useMyField")}
              </Button>
            )}
          </div>
        </div>
      </Panel>

      {error && <div className="notice">{error}</div>}

      {data && (
        <>
          {/* ---------------- farmer summary ---------------- */}
          <section className="summary" aria-label={t("summaryLabel")}>
            <div className="summary-head">
              <Headline data={data} />
              <div className="segmented segmented-sm" role="group" aria-label={t("unitLabel")}>
                {["maund", "tha"].map((u) => (
                  <button key={u} type="button" aria-pressed={unit.v === u} onClick={() => setUnit({ v: u })}>
                    {t(`unit_${u}`)}
                  </button>
                ))}
              </div>
            </div>
            <p className="muted small">{t("cardsHint")}</p>
            <CropStatusCards data={data} selected={selected} onSelect={setSelected} unit={unit.v} />
          </section>

          {/* ---------------- viewport + details ---------------- */}
          <div className="farm-main">
            <Panel className="farm-viewport">
              <div className="viewport-bar">
                <div className="segmented" role="group" aria-label={t("viewLabel")}>
                  {["3d", "2d"].map((v) => (
                    <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>
                      {t(`view${v}`)}
                    </button>
                  ))}
                </div>
                {view === "2d" ? (
                  <label className="inline-field">
                    <span>{t("colourBy")}</span>
                    <select className="select" value={metric} onChange={(e) => setMetric(e.target.value)}>
                      {METRICS.map((m) => <option key={m} value={m}>{t(`metric_${m}`)}</option>)}
                    </select>
                  </label>
                ) : <span className="muted small">{t("dragHint")}</span>}
                {busy && <span className="busy"><MiniBars label={t("running")} /></span>}
              </div>

              <div className="viewport-stage">
                {view === "2d" ? (
                  <Farm2D plots={data.plots} day={d} metric={metric} selected={selected} onSelect={setSelected} />
                ) : (
                  <WebGLGuard fallback={<div className="notice">{t("no3d")}</div>}>
                    <Suspense fallback={<BrandLoader size="panel" messages={[t("fm_3d")]} />}>
                      <Farm3D plots={data.plots} day={d} selected={selected} onSelect={setSelected} />
                    </Suspense>
                  </WebGLGuard>
                )}
              </div>

              <div className="timeline">
                <Button variant="primary" icon={playing ? Pause : Play}
                        onClick={() => { if (d >= data.dates.length - 1) setDay(0); setPlaying((p) => !p); }}>
                  {playing ? t("pause") : t("play")}
                </Button>
                <div className="timeline-track">
                  <div className="timeline-date"><bdi>{fmtDate(data.dates[d])}</bdi></div>
                  <input type="range" min="0" max={data.dates.length - 1} value={d} aria-label={t("dateLabel")}
                         onChange={(e) => { setPlaying(false); setDay(+e.target.value); }} />
                  <div className="timeline-months" aria-hidden="true">
                    {monthStarts.map((iso) => (
                      <span key={iso}>{monthTick(iso)}</span>
                    ))}
                  </div>
                </div>
              </div>
            </Panel>

            <div className="farm-side">
              <label className="crop-picker">
                <span className="field-label">{t("pickCrop")}</span>
                <select className="select" value={selected} onChange={(e) => setSelected(e.target.value)}>
                  {groupPlots(data.plots).map((g) => (
                    <optgroup key={g.key} label={t(`${g.key}Block`)}>
                      {g.plots.map((p) => <option key={p.crop} value={p.crop}>{crop(p.crop)}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
              {plot && <CropDetail plot={plot} day={d} fmtDate={fmtDate} unit={unit.v} />}
            </div>
          </div>

          <SeasonCalendar data={data} day={d} onDay={(v) => { setPlaying(false); setDay(v); }} />

          <div className="detail-grid">
            <HarvestOutlook data={data} unit={unit.v} />
            <WeatherByMonth data={data} />
          </div>

          <div className="source-row">
            <span className="tag">{t("srcWeather")}: {data.weather.observed ? t("weatherObserved") : t("weatherSynthetic")}</span>
            <span className="tag">{t("srcSoil")}: {t(`tex_${data.soil.class}`)}</span>
            <span className="tag tag-sim">{t("simulatedBadge")}</span>
          </div>

          <details className="advanced">
            <summary>{t("advancedCharts")}</summary>
            <div className="advanced-body">
          {/* ---------------- charts ---------------- */}
          <div className="detail-grid">
            <Panel title={t("compareTitle")}>
              <div className="chart">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={yieldRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="var(--line)" vertical={false} />
                    <XAxis dataKey="name" tick={{ ...AXIS, fill: "var(--ink)" }} tickLine={false} axisLine={{ stroke: "var(--line)" }} />
                    <YAxis tick={AXIS} tickLine={false} axisLine={false} width={40}
                           label={{ value: t("tha"), angle: -90, position: "insideLeft", fill: "var(--muted)", fontSize: 12 }} />
                    <Tooltip contentStyle={TIP} cursor={{ fill: "var(--surface-2)" }} />
                    <Legend />
                    <Bar dataKey="normal" name={t("yieldNormal")} fill="var(--line-strong)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="scenario" name={t("yieldScenario")} fill="var(--canopy)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel title={`${t("seasonCurve")}: ${crop(selected)}`}>
              <div className="segmented segmented-sm">
                {CURVES.map((c) => (
                  <button key={c} type="button" aria-pressed={curve === c} onClick={() => setCurve(c)}>
                    {t(`curve_${c}`)}
                  </button>
                ))}
              </div>
              <div className="chart chart-gap-sm">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={curveRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="var(--line)" vertical={false} />
                    <XAxis dataKey="date" ticks={monthStarts} tickFormatter={monthTick} tick={AXIS} tickLine={false}
                           interval={0} axisLine={{ stroke: "var(--line)" }} />
                    <YAxis tick={AXIS} tickLine={false} axisLine={false} width={40} />
                    <Tooltip contentStyle={TIP} labelFormatter={(iso) => fmtDate(iso)} />
                    <Legend />
                    <ReferenceLine x={data.dates[d]} stroke="var(--muted)" strokeDasharray="3 3" />
                    <Line dataKey="normal" name={t("yieldNormal")} stroke="var(--muted)" strokeDasharray="5 4" dot={false} connectNulls={false} />
                    <Line dataKey="scenario" name={t("yieldScenario")} stroke="var(--canopy)" strokeWidth={2.5} dot={false} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          <Panel title={t("weatherTitle")}>
            <div className="chart">
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={weatherRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="date" ticks={monthStarts} tickFormatter={monthTick} tick={AXIS} tickLine={false}
                         interval={0} axisLine={{ stroke: "var(--line)" }} />
                  <YAxis yAxisId="rain" tick={AXIS} tickLine={false} axisLine={false} width={40} />
                  <YAxis yAxisId="t" orientation="right" tick={AXIS} tickLine={false} axisLine={false} width={40} />
                  <Tooltip contentStyle={TIP} labelFormatter={(iso) => fmtDate(iso)} />
                  <Legend />
                  <ReferenceLine yAxisId="rain" x={data.dates[d]} stroke="var(--muted)" strokeDasharray="3 3" />
                  <Bar yAxisId="rain" dataKey="rain" name={t("rainLegend")} fill="var(--rabi)" />
                  <Line yAxisId="t" dataKey="tmaxNormal" name={t("tmaxNormal")} stroke="var(--muted)" dot={false} strokeWidth={1} />
                  <Line yAxisId="t" dataKey="tmax" name={t("tmaxLegend")} stroke="var(--soil)" dot={false} strokeWidth={1.5} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Panel>
            </div>
          </details>
          <p className="muted small">{t("modelNoteFarm")}</p>
        </>
      )}

      {!data && !error && (
        <BrandLoader
          title={t("fm_title")}
          messages={[t("fm_weather"), t("fm_soil"), t("fm_grow"), t("fm_compare")]}
        />
      )}
    </div>
  );
}

const waterWord = (ks) => {
  const w = 1 - (ks ?? 1);
  return w < 0.15 ? ["good", "w_ok"] : w < 0.45 ? ["watch", "w_thirsty"] : ["risk", "w_very"];
};
const heatWord = (h) => (h < 0.05 ? ["good", "h_ok"] : h < 0.4 ? ["watch", "h_hot"] : ["risk", "h_very"]);

function CropDetail({ plot, day, fmtDate, unit }) {
  const { t } = useI18n();
  const s = plot.scenario.series;
  const st = stageOf(plot, day);
  const growing = st >= 0 && st <= 3;
  const b = plot.baseline.summary, sc = plot.scenario.summary;
  const change = b.yield_t_ha ? Math.round((100 * (sc.yield_t_ha - b.yield_t_ha)) / b.yield_t_ha) : 0;
  const [wLvl, wKey] = waterWord(s.ks[day]);
  const [hLvl, hKey] = heatWord(s.heat[day] ?? 0);
  const leaf = Math.round(100 * (s.cc[day] ?? 0));
  const yieldTxt = (v) => toUnit(v, unit).toFixed(unit === "maund" ? 0 : 1);

  return (
    <div className="crop-detail">
      <Panel>
        <div className="crop-stage">
          <span className={`stage-pill stage-${growing ? STAGE_KEYS[st] : st < 0 ? "none" : "done"}`}>
            {st < 0 ? t("notSown") : st === 4 ? t("harvested") : t(`st_${STAGE_KEYS[st]}`)}
          </span>
          <span className="muted small">
            {t("sowHarvest", { sow: fmtDate(plot.sow_date, { day: "numeric", month: "short" }),
                               harvest: fmtDate(plot.harvest_date, { day: "numeric", month: "short" }) })}
          </span>
        </div>
        {growing ? (
          <div className="gauges">
            <WaterTank value={s.soil_water[day]} />
            <div className="gauge-list">
              <div>
                <div className="gauge-label">{t("leafCover")}</div>
                <div className="leaf-track"><div className="leaf-fill" style={{ inlineSize: `${leaf}%` }} /></div>
                <div className="gauge-word"><bdi>{leaf}%</bdi></div>
              </div>
              <div>
                <div className="gauge-label">{t("waterNeed")}</div>
                <div className={`level level-${wLvl}`}>{t(wKey)}</div>
              </div>
              <div>
                <div className="gauge-label">{t("heatL")}</div>
                <div className={`level level-${hLvl}`}>{t(hKey)}</div>
              </div>
            </div>
          </div>
        ) : <p className="muted">{t("pickGrowingDay")}</p>}
      </Panel>

      <Panel title={t("yieldTitleUnit", { unit: t(`unit_${unit}`) })}>
        <div className="yield-compare">
          <div>
            <span className="muted small">{t("yieldNormal")}</span>
            <bdi className="stat-value">{yieldTxt(b.yield_t_ha)}</bdi>
          </div>
          <div>
            <span className="muted small">{t("yieldScenario")}</span>
            <bdi className="stat-value">{yieldTxt(sc.yield_t_ha)}</bdi>
          </div>
          <span className={`delta ${change < -2 ? "delta-down" : change > 2 ? "delta-up" : ""}`}>
            <bdi>{change > 0 ? "+" : ""}{change}%</bdi>
          </span>
        </div>
        <p className="muted small">
          {t("yieldUnit", { label: t(`ylabel_${plot.yield_label.replace(" ", "_")}`) })}
          {" "}{t("irrigationUsedN", { mm: sc.irrigation_mm })}
          {" "}{t("bestHere", { n: yieldTxt(plot.potential_yield_t_ha), unit: t(`unit_${unit}`) })}
        </p>
      </Panel>

      <Panel title={t("whyTitle")}>
        <ul className="reasons">
          {plot.insights.map((n, i) => (
            <li key={i}>{t(`in_${n.code}`, {
              ...n.params,
              pct: n.code === "yield_change" ? `${n.params.pct > 0 ? "+" : ""}${n.params.pct}` : n.params.pct,
            })}</li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
