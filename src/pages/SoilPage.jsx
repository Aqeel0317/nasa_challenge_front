import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { planName } from "./PlansPage.jsx";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { useI18n } from "../i18n.jsx";
import { Advanced, Level, PageHeader, Panel } from "../components/ui.jsx";
import FieldStrip from "../components/FieldStrip.jsx";

const AXIS = { fill: "var(--muted)", fontSize: 12 };

// Plain verdicts from the soil trajectory the engine returns.
function carbonVerdict(tr) {
  const start = tr.soc_g_kg[0], end = tr.soc_g_kg[tr.soc_g_kg.length - 1];
  const pct = (100 * (end - start)) / start;
  return { start, end, pct, level: pct > 1.5 ? "good" : pct > -1.5 ? "watch" : "risk",
           word: pct > 1.5 ? "up" : pct > -1.5 ? "flat" : "down" };
}
function nitrogenVerdict(tr) {
  const end = tr.n_bank_kg_ha[tr.n_bank_kg_ha.length - 1];
  return { end, level: end > 20 ? "good" : end > -20 ? "watch" : "risk",
           word: end > 20 ? "up" : end > -20 ? "flat" : "down" };
}
const ARROW = { up: ArrowUp, flat: ArrowRight, down: ArrowDown };

export default function SoilPage({ rotations, selected, setSelected }) {
  const { t, crop, season } = useI18n();
  if (!rotations.length) return <div className="page"><div className="notice">{t("noRotation")}</div></div>;
  const r = rotations[selected] || rotations[0];
  const tr = r.trajectory;
  const c = carbonVerdict(tr), n = nitrogenVerdict(tr);
  const CArrow = ARROW[c.word], NArrow = ARROW[n.word];

  const steps = r.sequence.map((cr, i) => ({
    crop: cr, season: r.seasons[i],
    dc: tr.soc_g_kg[i + 1] - tr.soc_g_kg[i],
    dn: tr.n_bank_kg_ha[i + 1] - tr.n_bank_kg_ha[i],
    pest: tr.pest_pressure[i + 1] > tr.pest_pressure[i] + 0.5,
  }));
  const compare = rotations.map((x) => ({ rank: x.rank, current: x.current, ...carbonVerdict(x.trajectory) }));
  const maxAbs = Math.max(...compare.map((x) => Math.abs(x.pct)), 0.5);

  return (
    <div className="page">
      <PageHeader title={t("soilTitle")} lead={t("soilLeadSimple")} />
      <div className="segmented segmented-lg" role="group" aria-label={t("planLabel")}>
        {rotations.map((x, i) => (
          <button key={x.current ? "current" : x.rank} type="button" aria-pressed={i === selected} onClick={() => setSelected(i)}>
            {planName(x, t)}
          </button>
        ))}
      </div>

      {/* ---- two verdict cards ---- */}
      <div className="verdicts">
        <div className={`verdict verdict-${c.level}`}>
          <div className="verdict-head"><span className="verdict-icon"><CArrow size={22} /></span>
            <span className="verdict-title">{t("v_carbon")}</span></div>
          <p className="verdict-main">{t(`v_carbon_${c.word}`)}</p>
          <p className="verdict-nums" dir="ltr">
            <bdi>{c.start.toFixed(1)}</bdi> <ArrowRight size={14} aria-hidden="true" /> <bdi>{c.end.toFixed(1)} g/kg</bdi>
            <span className="muted"> ({c.pct > 0 ? "+" : ""}{c.pct.toFixed(1)}%)</span>
          </p>
          <p className="muted small">{t("v_carbon_why")}</p>
        </div>
        <div className={`verdict verdict-${n.level}`}>
          <div className="verdict-head"><span className="verdict-icon"><NArrow size={22} /></span>
            <span className="verdict-title">{t("v_nitrogen")}</span></div>
          <p className="verdict-main">{t(`v_n_${n.word}`, { n: Math.round(Math.abs(n.end)) })}</p>
          <p className="muted small">{t("v_n_why")}</p>
        </div>
      </div>

      {/* ---- season by season ---- */}
      <Panel title={t("stepsTitle")}>
        <p className="muted small panel-sub">{t("stepsLead")}</p>
        <ol className="soil-steps">
          {steps.map((s, i) => (
            <li key={i} className={`soil-step band-${s.season}`}>
              <span className="band-season">{t("yearN", { y: Math.floor(i / 2) + 1 })}, {season(s.season)}</span>
              <span className="band-crop">{crop(s.crop)}</span>
              <span className="step-effects">
                <span className={`effect ${s.dc > 0.02 ? "eff-up" : s.dc < -0.02 ? "eff-down" : ""}`}>
                  {s.dc > 0.02 ? <ArrowUp size={14} /> : s.dc < -0.02 ? <ArrowDown size={14} /> : <ArrowRight size={14} />}
                  {t("e_carbon")}
                </span>
                <span className={`effect ${s.dn > 5 ? "eff-up" : s.dn < -5 ? "eff-down" : ""}`}>
                  {s.dn > 5 ? <ArrowUp size={14} /> : s.dn < -5 ? <ArrowDown size={14} /> : <ArrowRight size={14} />}
                  {t("e_nitrogen")}
                </span>
                {s.pest && <span className="effect eff-down">{t("e_pests")}</span>}
              </span>
            </li>
          ))}
        </ol>
      </Panel>

      {/* ---- compare plans ---- */}
      <Panel title={t("cmpTitle")}>
        <p className="muted small panel-sub">{t("cmpLead")}</p>
        <div className="cmp">
          {compare.map((x, i) => (
            <button key={x.current ? "current" : x.rank} type="button" className="cmp-row" aria-pressed={i === selected} onClick={() => setSelected(i)}>
              <span className="cmp-name">{planName(x, t)}</span>
              <span className="cmp-track" dir="ltr">
                <span className="cmp-mid" />
                <span className={`cmp-bar cmp-${x.level}`}
                      style={x.pct >= 0
                        ? { left: "50%", width: `${(50 * x.pct) / maxAbs}%` }
                        : { right: "50%", width: `${(50 * -x.pct) / maxAbs}%` }} />
              </span>
              <bdi className="cmp-val">{x.pct > 0 ? "+" : ""}{x.pct.toFixed(1)}%</bdi>
              <Level level={x.level}>{t(`v_carbon_short_${x.word}`)}</Level>
            </button>
          ))}
        </div>
      </Panel>

      <Advanced label={t("advancedCharts")}>
        <SoilChart r={r} />
        <p className="muted small">{t("modelNote")}</p>
      </Advanced>
    </div>
  );
}

function SoilChart({ r }) {
  const { t, crop, season } = useI18n();
  const tr = r.trajectory;
  const data = [null, ...r.sequence].map((c, i) => ({
    step: i === 0 ? t("start") : crop(c),
    when: i === 0 ? "" : season(r.seasons[i - 1]),
    soc: tr.soc_g_kg[i], n: tr.n_bank_kg_ha[i],
  }));
  return (
    <Panel>
      <FieldStrip sequence={r.sequence} seasons={r.seasons} />
      <div className="chart chart-gap">
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="step" interval={0} height={50} tickLine={false}
                   tick={({ x, y, index }) => (
                     <text x={x} y={y + 14} textAnchor="middle" fontSize={11} fill="var(--muted)">
                       <tspan x={x} fontWeight={600} fill="var(--ink)">{data[index].step}</tspan>
                       <tspan x={x} dy={16}>{data[index].when}</tspan>
                     </text>
                   )} />
            <YAxis yAxisId="soc" tick={AXIS} tickLine={false} axisLine={false} width={44} />
            <YAxis yAxisId="n" orientation="right" tick={AXIS} tickLine={false} axisLine={false} width={48} />
            <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8 }} />
            <Legend verticalAlign="top" height={32} />
            <Line yAxisId="soc" dataKey="soc" name={t("socLine")} stroke="var(--soil)" strokeWidth={2.5} />
            <Line yAxisId="n" dataKey="n" name={t("nLine")} stroke="var(--canopy)" strokeDasharray="5 4" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
