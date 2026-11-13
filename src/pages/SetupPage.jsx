import { ArrowLeft, ArrowRight, Check, LocateFixed, Search } from "lucide-react";
import { useI18n } from "../i18n.jsx";
import { Button, PageHeader } from "../components/ui.jsx";

const STEPS = ["step1", "step2", "step3", "step4"];
const PRESETS = {
  balanced: { soil_health: 6, water_saving: 6, climate_resilience: 6, profit: 6 },
  soil: { soil_health: 10, water_saving: 5, climate_resilience: 6, profit: 4 },
  water: { soil_health: 5, water_saving: 10, climate_resilience: 7, profit: 4 },
  income: { soil_health: 4, water_saving: 4, climate_resilience: 5, profit: 10 },
};
const PRIORITIES = ["soil_health", "water_saving", "climate_resilience", "profit"];

export default function SetupPage({ step, go, form, setForm, crops, onSubmit, loading }) {
  const { t } = useI18n();
  const n = Math.min(Math.max(Number(step) || 1, 1), STEPS.length);
  const last = n === STEPS.length;

  return (
    <div className="page page-narrow">
      <PageHeader title={t("setupTitle")} lead={t("setupLead")} />

      <ol className="stepper" aria-label={t("stepsLabel")}>
        {STEPS.map((key, i) => {
          const state = i + 1 < n ? "done" : i + 1 === n ? "current" : "todo";
          return (
            <li key={key} className={`step step-${state}`}>
              <button type="button" onClick={() => go(`setup/${i + 1}`)}
                      aria-current={state === "current" ? "step" : undefined}>
                <span className="step-dot">{state === "done" ? <Check size={14} /> : i + 1}</span>
                <span className="step-name">{t(key)}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <form className="panel setup-card" onSubmit={(e) => { e.preventDefault(); last ? onSubmit() : go(`setup/${n + 1}`); }}>
        <h2 className="panel-title">{t(STEPS[n - 1])}</h2>
        <p className="panel-lead">{t(`${STEPS[n - 1]}Lead`)}</p>
        {n === 1 && <StepField form={form} setForm={setForm} />}
        {n === 2 && <StepPriorities form={form} setForm={setForm} />}
        {n === 3 && <StepCrops form={form} setForm={setForm} crops={crops} />}
        {n === 4 && <StepSoil form={form} setForm={setForm} />}

        <div className="setup-footer">
          {n > 1 ? (
            <Button icon={ArrowLeft} onClick={() => go(`setup/${n - 1}`)}>{t("back")}</Button>
          ) : <span />}
          <div className="setup-footer-end">
            {!last && (
              <Button variant="ghost" icon={Search} onClick={onSubmit} disabled={loading}>
                {t("find")}
              </Button>
            )}
            {last ? (
              <button type="submit" className="btn btn-primary" disabled={loading}>
                <Search size={18} aria-hidden="true" />
                <span>{loading ? t("finding") : t("find")}</span>
              </button>
            ) : (
              <button type="submit" className="btn btn-primary">
                <span>{t("next")}</span>
                <ArrowRight size={18} aria-hidden="true" className="flip-rtl" />
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

function StepField({ form, setForm }) {
  const { t } = useI18n();
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const locate = () =>
    navigator.geolocation?.getCurrentPosition(
      (p) => setForm((f) => ({ ...f, lat: +p.coords.latitude.toFixed(4), lon: +p.coords.longitude.toFixed(4) })),
      () => alert(t("locationBlocked"))
    );
  return (
    <div className="form-grid">
      <label className="field">
        <span className="field-label">{t("latitude")}</span>
        <input type="number" step="0.0001" min="-60" max="75" required dir="ltr"
               value={form.lat} onChange={(e) => set("lat", +e.target.value)} />
      </label>
      <label className="field">
        <span className="field-label">{t("longitude")}</span>
        <input type="number" step="0.0001" min="-180" max="180" required dir="ltr"
               value={form.lon} onChange={(e) => set("lon", +e.target.value)} />
      </label>
      <div className="field span-2 field-inline">
        <span className="field-help">{t("locationHelp")}</span>
        <Button variant="ghost" icon={LocateFixed} onClick={locate}>{t("useLocation")}</Button>
      </div>

      <label className="field span-2">
        <span className="field-label">
          {t("irrigation")} <bdi className="num">{form.irrigation_mm} {t("mm")}</bdi>
        </span>
        <input type="range" min="0" max="800" step="25" value={form.irrigation_mm}
               onChange={(e) => set("irrigation_mm", +e.target.value)} />
        <span className="field-help">{t("irrigationHelp")}</span>
      </label>

      <fieldset className="field">
        <legend className="field-label">{t("planLength")}</legend>
        <div className="segmented">
          {[1, 2, 3, 4].map((y) => (
            <button key={y} type="button" aria-pressed={form.years === y}
                    onClick={() => set("years", y)}>{y} {t(y > 1 ? "years" : "year")}</button>
          ))}
        </div>
      </fieldset>
      <fieldset className="field">
        <legend className="field-label">{t("nextSeason")}</legend>
        <div className="segmented">
          {["warm", "cool"].map((s) => (
            <button key={s} type="button" aria-pressed={form.start_season === s}
                    onClick={() => set("start_season", s)}>{t(s)}</button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

function StepPriorities({ form, setForm }) {
  const { t } = useI18n();
  const active = Object.entries(PRESETS)
    .find(([, w]) => PRIORITIES.every((k) => w[k] === form.weights[k]))?.[0];
  return (
    <>
      <div className="chips" role="group">
        {Object.keys(PRESETS).map((p) => (
          <button key={p} type="button" className="chip" aria-pressed={active === p}
                  onClick={() => setForm((f) => ({ ...f, weights: { ...PRESETS[p] } }))}>
            {t(`preset_${p}`)}
          </button>
        ))}
      </div>
      <div className="sliders">
        {PRIORITIES.map((k) => (
          <label key={k} className="field">
            <span className="field-label">{t(`w_${k}`)} <bdi className="num">{form.weights[k]}</bdi></span>
            <input type="range" min="0" max="10" value={form.weights[k]}
                   onChange={(e) => setForm((f) => ({ ...f, weights: { ...f.weights, [k]: +e.target.value } }))} />
            <span className="range-ends"><span>{t("less")}</span><span>{t("more")}</span></span>
          </label>
        ))}
      </div>
    </>
  );
}

function StepCrops({ form, setForm, crops }) {
  const { t, crop } = useI18n();
  const toggle = (name) => setForm((f) => ({
    ...f,
    allowed_crops: f.allowed_crops.includes(name)
      ? f.allowed_crops.filter((c) => c !== name) : [...f.allowed_crops, name],
  }));
  const setSeason = (season, on) => setForm((f) => {
    const names = crops.filter((c) => c.season === season).map((c) => c.name);
    const rest = f.allowed_crops.filter((c) => !names.includes(c));
    return { ...f, allowed_crops: on ? [...rest, ...names] : rest };
  });
  return (
    <>
      {["warm", "cool"].map((season) => {
        const list = crops.filter((c) => c.season === season);
        const chosen = list.filter((c) => form.allowed_crops.includes(c.name)).length;
        return (
          <fieldset key={season} className={`crop-set crop-set-${season}`}>
            <div className="crop-set-head">
              <legend>{t(`${season}Season`)}</legend>
              <span className="muted">{t("cropsSelected", { n: chosen, total: list.length })}</span>
              <button type="button" className="text-btn" onClick={() => setSeason(season, true)}>{t("selectAll")}</button>
              <button type="button" className="text-btn" onClick={() => setSeason(season, false)}>{t("clearAll")}</button>
            </div>
            <div className="chips">
              {list.map((c) => (
                <button key={c.name} type="button" className="chip chip-crop"
                        aria-pressed={form.allowed_crops.includes(c.name)} onClick={() => toggle(c.name)}>
                  {form.allowed_crops.includes(c.name) && <Check size={15} aria-hidden="true" />}
                  {crop(c.name)}
                </button>
              ))}
            </div>
          </fieldset>
        );
      })}
      <label className="switch-row">
        <input type="checkbox" role="switch" checked={form.allow_fallow}
               onChange={(e) => setForm((f) => ({ ...f, allow_fallow: e.target.checked }))} />
        <span>{t("allowFallow")}</span>
      </label>
    </>
  );
}

function StepSoil({ form, setForm }) {
  const { t } = useI18n();
  const setSoil = (k, v) => setForm((f) => ({ ...f, soil_override: { ...f.soil_override, [k]: v } }));
  return (
    <>
      <label className="switch-row">
        <input type="checkbox" role="switch" checked={form.use_soil_test}
               onChange={(e) => setForm((f) => ({ ...f, use_soil_test: e.target.checked }))} />
        <span>{t("useSoilTest")}</span>
      </label>
      <div className={`form-grid ${form.use_soil_test ? "" : "is-disabled"}`}>
        {[["phh2o", "ph", 0.1], ["soc", "socInput", 0.5], ["clay", "clayInput", 1], ["sand", "sandInput", 1]]
          .map(([k, label, step]) => (
            <label key={k} className="field">
              <span className="field-label">{t(label)}</span>
              <input type="number" step={step} dir="ltr" disabled={!form.use_soil_test}
                     value={form.soil_override[k]} onChange={(e) => setSoil(k, +e.target.value)} />
            </label>
          ))}
      </div>
    </>
  );
}
