import { useEffect, useState } from "react";
import {
  ArrowLeft, ArrowRight, Check, CloudRain, Droplet, Droplets, LocateFixed, MapPin, Scale, Search,
  SlidersHorizontal, Sprout, Wallet,
} from "lucide-react";
import { useI18n } from "../i18n.jsx";
import { useFarmProfile } from "../farmProfile.js";
import { PRICE_PER_MAUND } from "../components/farm/farmUtils.js";
import { Button, PageHeader } from "../components/ui.jsx";
import { QUICK_PLACES, fieldLabel, placeName, searchPlaces } from "../weather.js";

const STEPS = ["step1", "step2", "step3", "step4"];
const PRESETS = {
  balanced: { soil_health: 6, water_saving: 6, climate_resilience: 6, profit: 6 },
  soil: { soil_health: 10, water_saving: 5, climate_resilience: 6, profit: 4 },
  water: { soil_health: 5, water_saving: 10, climate_resilience: 7, profit: 4 },
  income: { soil_health: 4, water_saving: 4, climate_resilience: 5, profit: 10 },
};
const PRIORITIES = ["soil_health", "water_saving", "climate_resilience", "profit"];

// Water as three plain choices; each maps to seasonal irrigation in mm for the engine.
const WATER = [
  { id: "rain", mm: 0, icon: CloudRain },
  { id: "some", mm: 300, icon: Droplet },
  { id: "plenty", mm: 600, icon: Droplets },
];
const PRESET_ICONS = { balanced: Scale, soil: Sprout, water: Droplets, income: Wallet };

// #/setup        -> the simple one-screen setup (place, water, what matters most)
// #/setup/1..4   -> the full wizard ("More options")
export default function SetupPage(props) {
  return props.step ? <SetupWizard {...props} /> : <QuickSetup {...props} />;
}

function QuickSetup({ go, form, setForm, onSubmit, loading }) {
  const { crop } = useI18n();
  const [profile, setProfile] = useFarmProfile();
  const { t, lang } = useI18n();
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return undefined; }
    let alive = true;
    const id = setTimeout(() => {
      setBusy(true);
      searchPlaces(q.trim(), lang).then((r) => alive && setResults(r)).catch(() => alive && setResults([]))
        .finally(() => alive && setBusy(false));
    }, 350);
    return () => { alive = false; clearTimeout(id); };
  }, [q, lang]);

  const pick = (p) => {
    setForm((f) => ({ ...f, lat: +(+p.lat).toFixed(4), lon: +(+p.lon).toFixed(4), place: p.name }));
    setQ(""); setResults([]); setMsg("");
  };
  const useGps = () => {
    if (!navigator.geolocation) { setMsg(t("gpsNone")); return; }
    setMsg(t("gpsFinding"));
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const la = +pos.coords.latitude.toFixed(4), lo = +pos.coords.longitude.toFixed(4);
      pick({ name: (await placeName(la, lo, lang)) || t("myLocation"), lat: la, lon: lo });
    }, () => setMsg(t("gpsDenied")), { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 });
  };

  const water = WATER.reduce((a, b) => (Math.abs(b.mm - form.irrigation_mm) < Math.abs(a.mm - form.irrigation_mm) ? b : a));
  const preset = Object.entries(PRESETS)
    .find(([, w]) => PRIORITIES.every((k) => w[k] === form.weights[k]))?.[0];

  return (
    <div className="page page-narrow qs">
      <PageHeader title={t("qs_title")} lead={t("qs_lead")} />

      <form className="qs-form" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
        {/* 1. Where */}
        <section className="panel qs-section" aria-labelledby="qs-q1">
          <h2 className="qs-q" id="qs-q1">{t("qs_q1")}</h2>
          <div className="qs-place">
            <span className="locpick-pin" aria-hidden="true"><MapPin size={20} /></span>
            <div className="locpick-now">
              <span className="locpick-k">{t("qs_fieldIn")}</span>
              <strong><bdi>{fieldLabel(form, lang)}</bdi></strong>
            </div>
          </div>
          <button type="button" className="locpick-gps" onClick={useGps}>
            <LocateFixed size={20} aria-hidden="true" /> {t("useMyLocation")}
          </button>
          {msg && <p className="locpick-msg" role="status">{msg}</p>}
          <label className="locpick-search">
            <Search size={18} aria-hidden="true" />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)}
                   placeholder={t("searchPlace")} aria-label={t("searchPlace")} autoComplete="off" />
          </label>
          {busy && <p className="locpick-msg">{t("searching")}</p>}
          {results.length > 0 && (
            <ul className="locpick-results">
              {results.map((r) => (
                <li key={`${r.lat},${r.lon}`}>
                  <button type="button" onClick={() => pick(r)}>
                    <strong>{r.name}</strong>{r.area && <span>{r.area}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!busy && q.trim().length >= 2 && !results.length && <p className="locpick-msg">{t("noPlace")}</p>}
          <p className="locpick-k">{t("quickPlaces")}</p>
          <div className="locpick-quick">
            {QUICK_PLACES.map((p) => (
              <button key={p.name} type="button" className="chip"
                      aria-pressed={Math.abs(p.lat - form.lat) < 0.02 && Math.abs(p.lon - form.lon) < 0.02}
                      onClick={() => pick({ name: p.name, lat: p.lat, lon: p.lon })}>
                {lang === "ur" ? p.ur : p.name}
              </button>
            ))}
          </div>
        </section>

        {/* 2. Water */}
        <section className="panel qs-section" aria-labelledby="qs-q2">
          <h2 className="qs-q" id="qs-q2">{t("qs_q2")}</h2>
          <div className="choice-grid choice-grid-3" role="group" aria-labelledby="qs-q2">
            {WATER.map(({ id, mm, icon: Icon }) => (
              <button key={id} type="button" className="choice" aria-pressed={water.id === id}
                      onClick={() => setForm((f) => ({ ...f, irrigation_mm: mm }))}>
                <Icon size={26} aria-hidden="true" />
                <strong>{t(`water_${id}`)}</strong>
                <span>{t(`water_${id}_d`)}</span>
              </button>
            ))}
          </div>
        </section>

        {/* 3. What matters most */}
        <section className="panel qs-section" aria-labelledby="qs-q3">
          <h2 className="qs-q" id="qs-q3">{t("qs_q3")}</h2>
          {!preset && <p className="muted small">{t("customPriorities")}</p>}
          <div className="choice-grid" role="group" aria-labelledby="qs-q3">
            {Object.keys(PRESETS).map((p) => {
              const Icon = PRESET_ICONS[p];
              return (
                <button key={p} type="button" className="choice" aria-pressed={preset === p}
                        onClick={() => setForm((f) => ({ ...f, weights: { ...PRESETS[p] } }))}>
                  <Icon size={26} aria-hidden="true" />
                  <strong>{t(`preset_${p}`)}</strong>
                  <span>{t(`prio_${p}_d`)}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 4. The farm itself: size, soil, how the harvest is sold, equipment */}
        <section className="panel qs-section" aria-labelledby="qs-q4">
          <h2 className="qs-q" id="qs-q4">{t("qs_q4")}</h2>
          <label className="qs-row">
            <span>{t("farmAcres")}</span>
            <input className="num qs-num" type="number" inputMode="decimal" min="0.5" max="5000" step="0.5" dir="ltr"
                   value={form.farm_acres ?? form.acres ?? ""}
                   onChange={(e) => setForm((f) => ({ ...f, farm_acres: Math.max(0.5, +e.target.value || 0.5) }))} />
          </label>
          <p className="qs-sub">{t("soilType")}</p>
          <div className="chips" role="group" aria-label={t("soilType")}>
            {["", "sandy", "loam", "clay"].map((k) => (
              <button key={k || "map"} type="button" className="chip" aria-pressed={(form.soil_texture || "") === k}
                      onClick={() => setForm((f) => ({ ...f, soil_texture: k || null }))}>{t(k ? `soil_${k}` : "soil_map")}</button>
            ))}
          </div>
          <p className="qs-sub">{t("sellHow")}</p>
          <div className="chips" role="group" aria-label={t("sellHow")}>
            {["mandi", "home", "contract"].map((k) => (
              <button key={k} type="button" className="chip" aria-pressed={form.market === k}
                      onClick={() => setForm((f) => ({ ...f, market: f.market === k ? null : k }))}>{t(`market_${k}`)}</button>
            ))}
          </div>
          <p className="qs-sub">{t("myPrices")}</p>
          <div className="price-grid">
            {["wheat", "cotton", "rice", "maize"].map((k) => (
              <label key={k} className="price-in">
                <span>{crop(k)}</span>
                <input className="num" type="number" inputMode="numeric" min="0" step="50" dir="ltr"
                       placeholder={String(PRICE_PER_MAUND[k])} value={profile.prices?.[k] ?? ""}
                       onChange={(e) => setProfile((p) => ({ ...p, prices: { ...(p.prices || {}), [k]: e.target.value === "" ? undefined : Math.max(0, +e.target.value) } }))} />
              </label>
            ))}
          </div>
          <p className="muted small">{t("myPricesNote")}</p>
          <p className="qs-sub">{t("equipHave")}</p>
          <div className="chips" role="group" aria-label={t("equipHave")}>
            {["tractor", "laser_leveller", "tubewell"].map((k) => {
              const on = (form.equipment || []).includes(k);
              return (
                <button key={k} type="button" className="chip" aria-pressed={on}
                        onClick={() => setForm((f) => ({ ...f, equipment: on ? (f.equipment || []).filter((x) => x !== k) : [...(f.equipment || []), k] }))}>
                  {on ? "✓ " : ""}{t(`equip_${k}`)}
                </button>
              );
            })}
          </div>
        </section>

        <button type="submit" className="btn btn-primary qs-go" disabled={loading}>
          <Search size={20} aria-hidden="true" />
          <span>{loading ? t("qs_going") : t("qs_go")}</span>
          <ArrowRight size={20} aria-hidden="true" className="flip-rtl" />
        </button>
        <p className="qs-defaults">{t("qs_defaults")}</p>
        <button type="button" className="qs-more" onClick={() => go("setup/1")}>
          <SlidersHorizontal size={16} aria-hidden="true" /> {t("qs_more")}
        </button>
      </form>
    </div>
  );
}

function SetupWizard({ step, go, form, setForm, crops, onSubmit, loading }) {
  const { t } = useI18n();
  const n = Math.min(Math.max(Number(step) || 1, 1), STEPS.length);
  const last = n === STEPS.length;

  return (
    <div className="page page-narrow">
      <button type="button" className="qs-more qs-back" onClick={() => go("setup")}>
        <ArrowLeft size={16} aria-hidden="true" className="flip-rtl" /> {t("qs_back")}
      </button>
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
  // Typing coordinates by hand clears the saved place name (it would no longer match).
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v, ...(k === "lat" || k === "lon" ? { place: "" } : {}) }));
  const locate = () =>
    navigator.geolocation?.getCurrentPosition(
      (p) => setForm((f) => ({ ...f, lat: +p.coords.latitude.toFixed(4), lon: +p.coords.longitude.toFixed(4), place: "" })),
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
