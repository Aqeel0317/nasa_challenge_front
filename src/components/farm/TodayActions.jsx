import { Send, Square, Volume2 } from "lucide-react";
import { useI18n } from "../../i18n.jsx";
import { Term } from "./Glossary.jsx";
import { CROP_ICON, activeCrop } from "./farmUtils.js";
import { useSpeech } from "./FarmAdvice.jsx";

// "Today on your farm": a few plain decisions for today, worked out from the
// simulation of this season (crop stage and soil water in each field), the 7-day
// forecast and NASA's latest soil-moisture reading. Each one says why.
export default function TodayActions({ data, fields, fc, nasaDays = [] }) {
  const { t, crop, lang } = useI18n();
  const { supported, speaking, noVoice, speak } = useSpeech(lang);
  const tl = data?.weather?.timeline;
  const i = tl?.today ? data.dates.indexOf(tl.today) : -1;
  if (i < 0) return <p className="today-off">{t("today_pastSeason")}</p>;

  const byKey = Object.fromEntries(data.plots.map((p) => [p.crop, p]));
  const locale = lang === "ur" ? "ur-PK" : "en-GB";
  const dayName = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString(locale, { weekday: "long" });
  const d = fc?.daily;
  const rain3 = d ? d.precipitation_sum.slice(0, 3).reduce((a, b) => a + (b || 0), 0) : 0;
  const hot = d ? d.temperature_2m_max.slice(0, 3).reduce((m, v, k) => (v > m.v ? { v, k } : m), { v: -99, k: 0 }) : null;
  const cold = d ? d.temperature_2m_min.slice(0, 3).reduce((m, v, k) => (v < m.v ? { v, k } : m), { v: 99, k: 0 }) : null;
  const wet = d ? d.precipitation_sum.slice(0, 3).reduce((m, v, k) => ((v || 0) > m.v ? { v: v || 0, k } : m), { v: 0, k: 0 }) : null;
  const nasaSoil = [...nasaDays].reverse().find((x) => x.soil != null)?.soil;

  const actions = [];
  // 1. Farm-wide weather warnings for the next three days
  if (hot && hot.v >= 40) actions.push({ lvl: "risk", icon: "🔥", head: t("today_heat_h", { t: Math.round(hot.v), day: dayName(d.time[hot.k]) }), why: t("today_heat_w") });
  if (cold && cold.v <= 2) actions.push({ lvl: "risk", icon: "❄️", head: t("today_frost_h", { t: Math.round(cold.v), day: dayName(d.time[cold.k]) }), why: t("today_frost_w"), term: "frost" });
  if (wet && wet.v >= 30) actions.push({ lvl: "watch", icon: "⛈️", head: t("today_storm_h", { mm: Math.round(wet.v), day: dayName(d.time[wet.k]) }), why: t("today_storm_w") });

  // 2. Each field: water today, or what is next
  fields.forEach((f, n) => {
    const name = t("fieldN", { n: n + 1 });
    const act = activeCrop(f, byKey, i);
    if (act.growing) {
      const p = byKey[act.key];
      const sw = p.scenario.series.soil_water[i] ?? 60;
      const who = `${name} · ${CROP_ICON[act.key] || ""} ${crop(act.key)}`;
      if (rain3 >= 8) actions.push({ lvl: "good", icon: "🌧️", pill: t("today_noWater"), head: who, why: t("today_rainComing", { mm: Math.round(rain3) }) });
      else if (sw < 40) actions.push({ lvl: "risk", icon: "💧", pill: t("today_water"), head: who, why: t("today_dry", { pct: Math.round(sw) }) + (nasaSoil != null ? ` ${t("today_nasaSoil", { pct: nasaSoil })}` : "") });
      else if (sw < 60) actions.push({ lvl: "watch", icon: "💧", pill: t("today_soon"), head: who, why: t("today_soonWhy", { pct: Math.round(sw) }) });
      else {
        // when will this field need water? the first day the model's soil water drops below 60%
        const series = p.scenario.series.soil_water;
        let j = i + 1;
        while (j < series.length && j - i <= 45 && (series[j] ?? 100) >= 60) j += 1;
        const soonDays = j < series.length && j - i <= 45 ? j - i : null;
        const date = soonDays != null ? new Date(`${data.dates[j]}T00:00:00`).toLocaleDateString(locale, { day: "numeric", month: "long" }) : null;
        let why = soonDays != null ? t("today_enough_next", { pct: Math.round(sw), days: soonDays, date }) : t("today_enough", { pct: Math.round(sw) });
        if (nasaSoil != null && nasaSoil < 35) why += ` ${t("today_nasaAreaDry", { pct: nasaSoil })}`;
        actions.push({ lvl: "good", icon: "✅", pill: t("today_noWater"), head: who, why });
      }
    } else {
      // next crop to sow in this field
      const next = [f.kharif, f.rabi].map((k) => k && byKey[k]).filter(Boolean)
        .map((p) => ({ p, at: data.dates.indexOf(p.sow_date) })).filter((x) => x.at > i).sort((a, b) => a.at - b.at)[0];
      if (next && next.at - i <= 21) {
        const date = new Date(`${next.p.sow_date}T00:00:00`).toLocaleDateString(locale, { day: "numeric", month: "long" });
        actions.push({ lvl: "info", icon: "🌱", pill: t("today_prepare"), head: `${name} · ${CROP_ICON[next.p.crop] || ""} ${crop(next.p.crop)}`, why: t("today_sowSoon", { date, n: next.at - i }) });
      } else {
        actions.push({ lvl: "info", icon: "🟫", pill: t("today_resting"), head: name, why: t("today_restWhy") });
      }
    }
  });

  const date = new Date(`${tl.today}T00:00:00`).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
  const spoken = [t("today_title"), date, ...actions.map((a) => [a.pill, a.head, a.why].filter(Boolean).join(". "))].join(". ");

  // Send today's list to family or farm workers (WhatsApp is how most farmers share)
  const share = async () => {
    const text = [`📅 ${t("today_title")} · ${date}`,
      ...actions.map((a) => `${a.icon} ${[a.pill, a.head].filter(Boolean).join(": ")}\n   ${a.why}`),
      `🌾 ${lang === "ur" ? "آپ کا کھیت" : "Aap ka Khet"}: ${window.location.origin}`].join("\n");
    if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) { if (e?.name === "AbortError") return; } }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };

  return (
    <section className="today-card" aria-labelledby="today-title">
      <header className="today-head">
        <div>
          <p className="today-kicker">📅 {date}</p>
          <h2 id="today-title">{t("today_title")}</h2>
        </div>
        <div className="today-btns">
          <button type="button" className="today-share" onClick={share}>
            <Send size={18} className="flip-rtl" aria-hidden="true" /><span>{t("today_share")}</span>
          </button>
          {supported && (
            <button type="button" className={`listen ${speaking ? "is-on" : ""}`} onClick={() => speak(spoken)}>
              {speaking ? <Square size={18} aria-hidden="true" /> : <Volume2 size={20} aria-hidden="true" />}
              <span>{speaking ? t("stopListen") : t("listen")}</span>
            </button>
          )}
        </div>
      </header>
      {noVoice && <p className="advice-note">{t("noUrduVoice")}</p>}
      <ul className="today-list">
        {actions.map((a, k) => (
          <li key={k} className={`today-item lvl-${a.lvl}`}>
            <span className="today-ic" aria-hidden="true">{a.icon}</span>
            <div>
              <p className="today-line">{a.pill && <b className="today-pill">{a.pill}</b>}<strong>{a.head}</strong>{a.term && <Term k={a.term} />}</p>
              <p className="today-why">{a.why}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="advice-note">{t("today_src")}</p>
    </section>
  );
}
