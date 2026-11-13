import { Component, Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, MapPin, RotateCcw } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, LineChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { FARM_DEFAULTS, LAST_YEAR, farmRequest, fetchFarm, readCached } from "../farmCache.js";
import { useI18n } from "../i18n.jsx";
import useStoredState from "../hooks/useStoredState.js";
import { Button, PageHeader, Panel } from "../components/ui.jsx";
import Farm2D from "../components/farm/Farm2D.jsx";
import BrandLoader, { MiniBars } from "../components/BrandLoader.jsx";
import { CROP_ICON, METRICS, STAGE_KEYS, activeCrop, stageOf } from "../components/farm/farmUtils.js";
import { HarvestOutlook, Headline, SeasonCalendar, WaterTank, WeatherByMonth, toUnit } from "../components/farm/FarmerDashboard.jsx";
import { FieldBoard, SCENARIO_ICON, ShockPanel } from "../components/farm/FieldBoard.jsx";
import LivePanel from "../components/farm/LivePanel.jsx";

const Farm3D = lazy(() => import("../components/farm/Farm3D.jsx"));

const SCENARIOS = ["normal", "drought", "heatwave", "flood", "custom"];
const IRRIGATION = ["rainfed", "deficit", "full"];
const CURVES = ["cc", "soil_water", "biomass"];
const AXIS = { fill: "var(--muted)", fontSize: 12 };
const TIP = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8 };

const YEARS = Array.from({ length: 12 }, (_, i) => LAST_YEAR - i);

const DEFAULTS = FARM_DEFAULTS;

class WebGLGuard extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export default function FarmPage({ fieldForm }) {
  const { t, lang, crop } = useI18n();
  const [stored, setSettings] = useStoredState("aapkakhet-farm-v2", DEFAULTS);
  const settings = { ...DEFAULTS, ...stored, fields: stored.fields?.length ? stored.fields : DEFAULTS.fields };
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState(false);
  const [view, setView] = useState("3d");
  const [metric, setMetric] = useState("ndvi");
  const [curve, setCurve] = useState("cc");
  const [selected, setSelected] = useState(0);
  const [day, setDay] = useState(105);
  const [playing, setPlaying] = useState(false);
  const [unit, setUnit] = useStoredState("rotaterra-unit", { v: lang === "ur" ? "maund" : "tha" });
  const runId = useRef(0);

  const set = (k, v) => setSettings((s) => ({ ...DEFAULTS, ...s, [k]: v }));
  const fields = settings.fields;
  const sel = Math.min(selected, fields.length - 1);

  // Field size only changes the money, so it does not re-run the simulation.
  const requestKey = JSON.stringify(farmRequest(settings));

  // Show the saved answer for these settings at once; fetch a new one only if it is old
  // or missing. While loading, the previous farm stays on screen.
  useEffect(() => {
    const id = ++runId.current;
    const body = JSON.parse(requestKey);
    if (!body.fields.some((f) => f.kharif || f.rabi)) { setError(t("pickACrop")); return undefined; }
    const cached = readCached(body);
    if (cached) { setData(cached.data); setError(""); }
    setStale(!!cached && !cached.fresh);
    if (cached?.fresh) { setBusy(false); return undefined; }
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await fetchFarm(body);
        if (id === runId.current) { setData(res); setError(""); setStale(false); }
      } catch (e) {
        if (id === runId.current && !cached) setError(e.message);
      } finally {
        if (id === runId.current) setBusy(false);
      }
    }, cached ? 0 : 350);
    return () => clearTimeout(timer);
  }, [requestKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Season playback
  useEffect(() => {
    if (!playing || !data) return undefined;
    const timer = setInterval(() => {
      setDay((d) => {
        if (d >= data.dates.length - 1) { setPlaying(false); return d; }
        return d + 1;
      });
    }, 45);
    return () => clearInterval(timer);
  }, [playing, data]);

  const locale = lang === "ur" ? "ur-PK" : "en-GB";
  const fmtDate = (iso, opts = { day: "numeric", month: "long", year: "numeric" }) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(locale, opts);

  const byKey = useMemo(() => Object.fromEntries((data?.plots || []).map((p) => [p.crop, p])), [data]);
  const d = data ? Math.min(day, data.dates.length - 1) : 0;
  const field = fields[sel];
  const act = data && field ? activeCrop(field, byKey, d) : { key: null };
  // The crop to explain: the one in the ground, otherwise the field's next crop
  const plotKey = act.key || [field?.kharif, field?.rabi].find((k) => k && byKey[k]);
  const plot = plotKey ? byKey[plotKey] : null;

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

  // Jump to the worst day of a disaster so the farmer sees it, then play from there
  const watchScenario = (sc) => {
    set("scenario", sc);
    const start = { heatwave: 100, flood: 90, drought: 60 }[sc];
    if (start != null) { setDay(start); setPlaying(true); }
  };

  const wx = data ? { rain: data.weather.scenario.rain[d] ?? 0, tmax: data.weather.scenario.tmax[d] ?? 0 } : null;
  const alert = wx && (wx.tmax >= 44 ? ["heat", t("fx_heat", { t: Math.round(wx.tmax) })]
    : wx.rain >= 40 ? ["storm", t("fx_storm", { mm: Math.round(wx.rain) })]
      : wx.rain >= 5 ? ["rain", t("fx_rain", { mm: Math.round(wx.rain) })] : null);

  return (
    <div className="page page-wide">
      <PageHeader title={t("farmTitle")} lead={t("farmLead")} />

      <LivePanel lat={settings.lat} lon={settings.lon} />

      {busy && data && (
        <div className="refresh-pill" role="status"><MiniBars label={t("refreshing")} /> <span>{stale ? t("staleNote") : t("refreshing")}</span></div>
      )}

      {/* ---------------- 1. the farmer's own fields ---------------- */}
      <FieldBoard fields={fields} setFields={(f) => set("fields", f)} data={data}
                  selected={sel} onSelect={setSelected} unit={unit.v} />

      {/* ---------------- 2. the weather to test ---------------- */}
      <Panel className="farm-controls">
        <h2 className="step-title">{t("pickWeather")}</h2>
        <div className="scenario-tiles" role="group" aria-label={t("scenarioLabel")}>
          {SCENARIOS.map((s) => (
            <button key={s} type="button" className={`scenario-tile sc-${s}`}
                    aria-pressed={settings.scenario === s} onClick={() => watchScenario(s)}>
              <span className="scenario-emoji" aria-hidden="true">{SCENARIO_ICON[s]}</span>
              <span className="scenario-name">{t(`sc_${s}`)}</span>
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

        <details className="more-settings">
          <summary>{t("moreSettings")}</summary>
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
            <div className="row-actions">
              {fieldForm && (
                <Button variant="ghost" icon={MapPin}
                        onClick={() => setSettings((s) => ({ ...DEFAULTS, ...s, lat: fieldForm.lat, lon: fieldForm.lon }))}>
                  {t("useMyField")}
                </Button>
              )}
              <Button variant="ghost" icon={RotateCcw} onClick={() => setSettings(DEFAULTS)}>{t("resetFarm")}</Button>
            </div>
          </div>
        </details>
      </Panel>

      {error && <div className="notice">{error}</div>}

      {data && (
        <>
          {/* ---------------- 3. what it would cost ---------------- */}
          <ShockPanel data={data} fields={fields} scenario={settings.scenario} onScenario={watchScenario} />

          {/* ---------------- 4. watch it happen ---------------- */}
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
                  <Farm2D fields={fields} plots={data.plots} day={d} metric={metric} selected={sel} onSelect={setSelected} />
                ) : (
                  <WebGLGuard fallback={<div className="notice">{t("no3d")}</div>}>
                    <Suspense fallback={<BrandLoader size="panel" messages={[t("fm_3d")]} />}>
                      <Farm3D fields={fields} plots={data.plots} weather={data.weather.scenario}
                              day={d} selected={sel} onSelect={setSelected} />
                    </Suspense>
                  </WebGLGuard>
                )}
                <div className="wx-ticker" aria-live="polite">
                  <span><bdi>{fmtDate(data.dates[d], { day: "numeric", month: "short" })}</bdi></span>
                  <span>🌡️ <bdi className="num">{Math.round(wx.tmax)}°C</bdi></span>
                  <span>🌧️ <bdi className="num">{Math.round(wx.rain)} {t("mm")}</bdi></span>
                </div>
                {alert && <div className={`wx-alert wx-${alert[0]}`} role="status">{alert[1]}</div>}
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
              <div className="segmented field-tabs" role="group" aria-label={t("pickField")}>
                {fields.map((f, i) => (
                  <button key={i} type="button" aria-pressed={sel === i} onClick={() => setSelected(i)}>
                    {t("fieldN", { n: i + 1 })}
                  </button>
                ))}
              </div>
              {plot ? (
                <>
                  <p className="side-crop">
                    <span aria-hidden="true">{CROP_ICON[plot.crop]}</span> {crop(plot.crop)}
                    {!act.key && <span className="muted small"> · {t("bareNow")}</span>}
                  </p>
                  <CropDetail plot={plot} day={d} fmtDate={fmtDate} unit={unit.v} />
                </>
              ) : <Panel><p className="muted">{t("pickACrop")}</p></Panel>}
            </div>
          </div>

          <SeasonCalendar data={data} fields={fields} day={d} onDay={(v) => { setPlaying(false); setDay(v); }} />

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

            {plot && (
            <Panel title={`${t("seasonCurve")}: ${crop(plot.crop)}`}>
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
            )}
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
          <p className="judgement-note">🤝 {t("judgementNote")}</p>
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
