import { useI18n } from "../../i18n.jsx";
import {
  FARM_H, FARM_W, FARMHOUSE, PLOT, ROAD_Y, SCALES, STAGE_KEYS, TUBEWELL,
  formatMetric, metricColor, metricValue, plotPos, stageOf,
} from "./farmUtils.js";

// Top-down map of every plot, coloured by the chosen metric on the chosen day.
// Each plot is simulated as one uniform zone, so each is filled with one colour.
const M = 8; // margin around the farm, metres

export default function Farm2D({ plots, day, metric, selected, onSelect }) {
  const { t, cropShort, lang } = useI18n();
  const sc = SCALES[metric];
  const rtl = lang === "ur";

  return (
    <div className="farm2d">
      <svg viewBox={`${-M} ${-M} ${FARM_W + 2 * M} ${FARM_H + 2 * M}`} role="img" aria-label={t("farmMapLabel")}>
        <defs>
          <pattern id="rows" width="2.2" height="2.2" patternUnits="userSpaceOnUse">
            <path d="M0 1.1H2.2" stroke="rgba(0,0,0,.12)" strokeWidth=".3" />
          </pattern>
          <pattern id="fallow" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <rect width="3" height="3" fill="var(--fallow)" />
            <path d="M0 1.5H3" stroke="rgba(0,0,0,.10)" strokeWidth=".6" />
          </pattern>
          <pattern id="flooded" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)">
            <path d="M0 1.5H3" stroke="rgba(47,111,156,.75)" strokeWidth=".7" />
          </pattern>
        </defs>
        <rect x={-M} y={-M} width={FARM_W + 2 * M} height={FARM_H + 2 * M} rx="4" fill="var(--farm-track)" />

        {/* block names along the farm road */}
        <text x={rtl ? FARM_W : 0} y={ROAD_Y - 0.6} textAnchor={rtl ? "end" : "start"} className="farm2d-block">
          ▲ {t("kharifBlock")}
        </text>
        <text x={rtl ? FARM_W : 0} y={ROAD_Y + 3.6} textAnchor={rtl ? "end" : "start"} className="farm2d-block">
          ▼ {t("rabiBlock")}
        </text>

        {/* farmhouse and tube-well */}
        <g className="farm2d-extra">
          <rect x={FARMHOUSE.x + 6} y={FARMHOUSE.y + 8} width="16" height="12" rx="1" fill="#c9b6a0" stroke="rgba(0,0,0,.25)" strokeWidth=".3" />
          <path d={`M${FARMHOUSE.x + 4} ${FARMHOUSE.y + 9} L${FARMHOUSE.x + 14} ${FARMHOUSE.y + 3} L${FARMHOUSE.x + 24} ${FARMHOUSE.y + 9} Z`} fill="#9b5b3c" />
          <text x={FARMHOUSE.x + PLOT / 2} y={FARMHOUSE.y + PLOT - 2} textAnchor="middle" className="farm2d-sub">{t("farmhouse")}</text>
          <circle cx={TUBEWELL.x + PLOT / 2} cy={TUBEWELL.y + 13} r="6" fill="#6fa3c4" stroke="rgba(0,0,0,.25)" strokeWidth=".3" />
          <rect x={TUBEWELL.x + PLOT / 2 - 1.5} y={TUBEWELL.y + 3} width="3" height="5" fill="#7b7f84" />
          <text x={TUBEWELL.x + PLOT / 2} y={TUBEWELL.y + PLOT - 2} textAnchor="middle" className="farm2d-sub">{t("tubewell")}</text>
        </g>

        {plots.map((p, idx) => {
          const { x, y } = plotPos(p.crop, idx);
          const st = stageOf(p, day);
          const growing = st >= 0 && st <= 3;
          const v = growing ? metricValue(p, metric, day) : null;
          const isSel = selected === p.crop;
          const wet = p.scenario.waterlog[day] === 1;
          const tx = rtl ? x + PLOT - 2 : x + 2;
          const anchor = rtl ? "end" : "start";
          return (
            <g key={p.crop} className="farm2d-plot" role="button" tabIndex={0}
               aria-pressed={isSel} aria-label={cropShort(p.crop)}
               onClick={() => onSelect(p.crop)}
               onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(p.crop)}>
              <rect x={x} y={y} width={PLOT} height={PLOT} rx="1.2"
                    fill={growing && v != null ? metricColor(metric, v) : "url(#fallow)"} />
              {growing && <rect x={x} y={y} width={PLOT} height={PLOT} rx="1.2" fill="url(#rows)" />}
              {wet && <rect x={x} y={y} width={PLOT} height={PLOT} rx="1.2" fill="url(#flooded)" />}
              <rect x={x} y={y} width={PLOT} height={PLOT} rx="1.2" fill="none"
                    stroke={isSel ? "var(--ink)" : "rgba(0,0,0,.15)"} strokeWidth={isSel ? 0.9 : 0.3} />
              <rect x={x + 1} y={y + 1} width={PLOT - 2} height={growing ? 12.5 : 9} rx="1.4" fill="var(--surface)" opacity=".9" />
              <text x={tx} y={y + 5} textAnchor={anchor} className="farm2d-name">{cropShort(p.crop)}</text>
              <text x={tx} y={y + 8.6} textAnchor={anchor} className="farm2d-sub">
                {st < 0 ? t("notSown") : st === 4 ? t("harvested") : t(`stS_${STAGE_KEYS[st]}`)}
              </text>
              {growing && <text x={tx} y={y + 12} textAnchor={anchor} className="farm2d-value">{formatMetric(metric, v)}</text>}
            </g>
          );
        })}
      </svg>
      <div className="legend" aria-hidden="true">
        <span>{t(`metric_${metric}_low`)}</span>
        <span className="legend-bar" style={{ background: `linear-gradient(to right, ${sc.stops.join(",")})` }} />
        <span>{t(`metric_${metric}_high`)}</span>
      </div>
    </div>
  );
}
