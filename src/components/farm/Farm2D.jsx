import { useI18n } from "../../i18n.jsx";
import {
  CROP_ICON, FARM_H, FARMHOUSE, PLOT, SCALES, SITE_W, STAGE_KEYS, TUBEWELL,
  activeCrop, fieldPos, formatMetric, metricColor, metricValue,
} from "./farmUtils.js";

// Top-down map of the fields, each coloured by the chosen measure for the crop
// that is in the ground on the chosen day.
const M = 6; // margin around the farm, metres

export default function Farm2D({ fields, plots, day, metric, selected, onSelect }) {
  const { t, cropShort, lang } = useI18n();
  const sc = SCALES[metric];
  const rtl = lang === "ur";
  const byKey = Object.fromEntries(plots.map((p) => [p.crop, p]));

  return (
    <div className="farm2d">
      <svg viewBox={`${-M} ${-M} ${SITE_W + 2 * M} ${FARM_H + 2 * M}`} role="img" aria-label={t("farmMapLabel")}>
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
        <rect x={-M} y={-M} width={SITE_W + 2 * M} height={FARM_H + 2 * M} rx="4" fill="var(--farm-track)" />
        <rect x={PLOT + 3} y={0} width={2} height={FARM_H} fill="#6fa3c4" />

        {/* farmhouse and tube-well */}
        <g className="farm2d-extra">
          <rect x={FARMHOUSE.x + 2} y={FARMHOUSE.y + 8} width="16" height="12" rx="1" fill="#c9b6a0" stroke="rgba(0,0,0,.25)" strokeWidth=".3" />
          <path d={`M${FARMHOUSE.x} ${FARMHOUSE.y + 9} L${FARMHOUSE.x + 10} ${FARMHOUSE.y + 3} L${FARMHOUSE.x + 20} ${FARMHOUSE.y + 9} Z`} fill="#9b5b3c" />
          <text x={FARMHOUSE.x + 10} y={FARMHOUSE.y + 25} textAnchor="middle" className="farm2d-sub">{t("farmhouse")}</text>
          <circle cx={TUBEWELL.x + 10} cy={TUBEWELL.y + 13} r="6" fill="#6fa3c4" stroke="rgba(0,0,0,.25)" strokeWidth=".3" />
          <rect x={TUBEWELL.x + 8.5} y={TUBEWELL.y + 1} width="3" height="5" fill="#7b7f84" />
          <text x={TUBEWELL.x + 10} y={TUBEWELL.y + 24} textAnchor="middle" className="farm2d-sub">{t("tubewell")}</text>
        </g>

        {fields.map((f, idx) => {
          const { x, y } = fieldPos(idx);
          const act = activeCrop(f, byKey, day);
          const p = act.key ? byKey[act.key] : null;
          const st = p ? p.scenario.stage[day] : -1;
          const growing = act.growing;
          const v = growing ? metricValue(p, metric, day) : null;
          const isSel = selected === idx;
          const wet = growing && p.scenario.waterlog[day] === 1;
          const tx = rtl ? x + PLOT - 2.5 : x + 2.5;
          const anchor = rtl ? "end" : "start";
          return (
            <g key={idx} className="farm2d-plot" role="button" tabIndex={0}
               aria-pressed={isSel} aria-label={t("fieldN", { n: idx + 1 })}
               onClick={() => onSelect(idx)}
               onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(idx)}>
              <rect x={x} y={y} width={PLOT} height={PLOT} rx="1.5"
                    fill={growing && v != null ? metricColor(metric, v) : "url(#fallow)"} />
              {growing && <rect x={x} y={y} width={PLOT} height={PLOT} rx="1.5" fill="url(#rows)" />}
              {wet && <rect x={x} y={y} width={PLOT} height={PLOT} rx="1.5" fill="url(#flooded)" />}
              <rect x={x} y={y} width={PLOT} height={PLOT} rx="1.5" fill="none"
                    stroke={isSel ? "var(--ink)" : "rgba(0,0,0,.15)"} strokeWidth={isSel ? 1 : 0.3} />
              <rect x={x + 1.2} y={y + 1.2} width={PLOT - 2.4} height={growing ? 16 : 12} rx="1.6" fill="var(--surface)" opacity=".92" />
              <text x={tx} y={y + 5.6} textAnchor={anchor} className="farm2d-name">
                {t("fieldN", { n: idx + 1 })} · {act.key ? `${CROP_ICON[act.key] || ""} ${cropShort(act.key)}` : t("bareNow")}
              </text>
              <text x={tx} y={y + 10} textAnchor={anchor} className="farm2d-sub">
                {!p ? t("bareHint") : st === 4 ? t("harvested") : t(`stS_${STAGE_KEYS[st]}`)}
              </text>
              {growing && <text x={tx} y={y + 14.4} textAnchor={anchor} className="farm2d-value">{formatMetric(metric, v)}</text>}
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
