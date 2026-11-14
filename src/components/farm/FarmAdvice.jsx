import { useEffect, useState } from "react";
import { Volume2, Square } from "lucide-react";
import { useI18n } from "../../i18n.jsx";
import { NITROGEN_FIXERS, PRICE_PER_MAUND, bareDays, formatRs } from "./farmUtils.js";
import { farmMoney, fieldValue } from "./FieldBoard.jsx";

// "Your farm at a glance": one verdict, the biggest money risk, and a few plain
// actions worked out from this farm's own results. A Listen button reads it aloud
// for farmers who find reading hard.
const SHOCKS = ["drought", "heatwave", "flood"];
const ICON = { drought: "🏜️", heatwave: "🔥", flood: "🌊" };

export function buildAdvice(data, fields, t, crop, lang) {
  // Same totals as the disaster panel (farmMoney), so the two can never disagree.
  const money = farmMoney(data, fields);
  const { byKey, normal } = money;
  const ready = money.ready.map(({ f }) => f);
  const losses = money.shocks.map((r) => ({ sc: r.name, loss: r.loss, pct: r.pct, waterlogDays: r.waterlogDays, maunds: r.maunds })).sort((a, b) => b.loss - a.loss);
  const worst = losses[0];
  const level = worst.pct < 8 ? "good" : worst.pct < 20 ? "watch" : "risk";
  const rotation = (f) => [f.kharif, f.rabi].filter(Boolean).map((k) => crop(k)).join(" → ");
  const label = (i) => t("fieldN", { n: fields.indexOf(ready[i]) + 1 });

  const tips = [];
  // 1. which rotation holds up best against the biggest threat
  if (ready.length > 1 && worst.loss > 0) {
    const share = ready.map((f, i) => {
      const b = fieldValue(f, byKey, "baseline");
      return { i, perAcre: f.acres ? b / f.acres : 0,
               pct: b ? Math.round((100 * (b - fieldValue(f, byKey, worst.sc, data.shocks))) / b) : 0 };
    }).sort((a, b) => a.pct - b.pct);
    const weak = share[share.length - 1];
    // Only suggest a rotation that also earns well in a normal year, not just one that
    // loses little because it earns little.
    // ...and both of whose crops are sold (green manure earns nothing, so its
    // "small loss" would be misleading).
    const sold = (f) => [f.kharif, f.rabi].filter(Boolean).every((k) => (PRICE_PER_MAUND[k] ?? 0) > 0);
    const best = share.find((x) => x.i !== weak.i && x.perAcre >= 0.7 * weak.perAcre && sold(ready[x.i]));
    if (best && weak.pct - best.pct >= 5) {
      tips.push({ icon: "🛡️", text: t("adv_rotation", {
        weak: label(weak.i), weakRot: rotation(ready[weak.i]), weakPct: weak.pct,
        best: label(best.i), bestRot: rotation(ready[best.i]), bestPct: Math.max(0, best.pct), sc: t(`sc_${worst.sc}`),
      }) });
    }
  }
  // 2. fields left bare for a long time
  const bare = ready.map((f, i) => ({ i, d: bareDays(f, byKey, data.dates.length) })).sort((a, b) => b.d - a.d)[0];
  if (bare && bare.d > 100) tips.push({ icon: "🟫", text: t("adv_bare", { field: label(bare.i), days: bare.d }) });
  // 3. no pulse crop anywhere
  if (!ready.some((f) => [f.kharif, f.rabi].some((k) => NITROGEN_FIXERS.has(k)))) {
    tips.push({ icon: "🌱", text: t("adv_legume") });
  }
  // 4. what to do about the biggest threat
  if (worst.loss > 0) tips.push({ icon: ICON[worst.sc], text: t(`adv_${worst.sc}`) });

  const headline = worst.loss > 0
    ? t(`verdict_${level}`, { sc: t(`sc_${worst.sc}`), money: formatRs(worst.loss, lang), pct: worst.pct })
    : t("verdict_safe");
  return { level, worst, normal, losses, tips: tips.slice(0, 4), headline };
}

// Read text aloud with the phone's own voice, in the page language when it has one.
export function useSpeech(lang) {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [speaking, setSpeaking] = useState(false);
  const [noVoice, setNoVoice] = useState(false);
  useEffect(() => () => { if (supported) window.speechSynthesis.cancel(); }, [supported]);
  const speak = (text) => {
    if (!supported) return;
    const synth = window.speechSynthesis;
    if (speaking) { synth.cancel(); setSpeaking(false); return; }
    const code = lang === "ur" ? "ur" : "en";
    const voice = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith(code));
    if (lang === "ur" && !voice) { setNoVoice(true); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === "ur" ? "ur-PK" : "en-GB";
    if (voice) u.voice = voice;
    u.rate = 0.92;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    synth.cancel();
    synth.speak(u);
    setSpeaking(true);
  };
  return { supported, speaking, noVoice, speak };
}

export default function FarmAdvice({ data, fields, scenario, onScenario, now }) {
  const { t, crop, lang } = useI18n();
  const a = buildAdvice(data, fields, t, crop, lang);
  const { supported, speaking, noVoice, speak } = useSpeech(lang);
  const nowText = now ? `${t("thisWeek")}: ${t(`now_${now.sc}`)}` : null;
  const spoken = [nowText, t(`verdictTitle_${a.level}`), a.headline, ...a.tips.map((x) => x.text)].filter(Boolean).join(". ");

  return (
    <section className={`advice advice-${a.level}`} aria-labelledby="advice-title">
      <div className="advice-top">
        <span className="advice-light" aria-hidden="true">{a.level === "good" ? "✅" : a.level === "watch" ? "⚠️" : "🚨"}</span>
        <div className="advice-head">
          <p className="advice-kicker">{t("adviceKicker")}</p>
          <h2 id="advice-title">{t(`verdictTitle_${a.level}`)}</h2>
          <p className="advice-headline">{a.headline}</p>
        </div>
        {supported && (
          <button type="button" className={`listen ${speaking ? "is-on" : ""}`} onClick={() => speak(spoken)}>
            {speaking ? <Square size={18} aria-hidden="true" /> : <Volume2 size={20} aria-hidden="true" />}
            <span>{speaking ? t("stopListen") : t("listen")}</span>
          </button>
        )}
      </div>
      {noVoice && <p className="advice-note">{t("noUrduVoice")}</p>}
      {now && (
        <p className={`advice-now now-${now.sc}`}>
          <span aria-hidden="true">{now.sc === "normal" ? "🌤️" : ICON[now.sc]}</span>
          <span><strong>{t("thisWeek")}:</strong> {t(`now_${now.sc}`)}</span>
        </p>
      )}
      <p className="advice-sub">{t("riskYear")}</p>

      <div className="advice-meter" role="group" aria-label={t("shockTitle")}>
        {a.losses.slice().sort((x, y) => SHOCKS.indexOf(x.sc) - SHOCKS.indexOf(y.sc)).map((l) => (
          <button key={l.sc} type="button" className={`meter-cell lvl-${l.pct < 8 ? "good" : l.pct < 20 ? "watch" : "risk"}`}
                  aria-pressed={scenario === l.sc} onClick={() => onScenario(l.sc)}>
            <span className="meter-ic" aria-hidden="true">{ICON[l.sc]}</span>
            <span className="meter-name">{t(`sc_${l.sc}`)}</span>
            <span className="meter-pct"><bdi>{l.pct > 0 ? `−${l.pct}%` : "0%"}</bdi></span>
            {l.loss > 0 && <span className="meter-sub"><bdi>−{formatRs(l.loss, lang)}</bdi></span>}
            {l.sc === "flood" && l.waterlogDays > 0 && <span className="meter-sub">💧 {t("shockWaterlogShort", { days: l.waterlogDays })}</span>}
          </button>
        ))}
      </div>

      {a.tips.length > 0 && (
        <>
          <h3 className="advice-sub">{t("whatToDo")}</h3>
          <ol className="advice-tips">
            {a.tips.map((x, i) => (
              <li key={i}><span className="tip-ic" aria-hidden="true">{x.icon}</span><span>{x.text}</span></li>
            ))}
          </ol>
        </>
      )}
      <p className="advice-note">🤝 {t("adviceNote")}</p>
    </section>
  );
}

// Three picture steps that explain the page at a glance.
export function HowSteps() {
  const { t } = useI18n();
  return (
    <ol className="how3" aria-label={t("how3Label")}>
      {[["🌾", "how3_1"], ["⛅", "how3_2"], ["💡", "how3_3"]].map(([ic, k], i) => (
        <li key={k}><span className="how3-n">{i + 1}</span><span className="how3-ic" aria-hidden="true">{ic}</span><span>{t(k)}</span></li>
      ))}
    </ol>
  );
}

