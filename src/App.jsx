import { Component, Suspense, lazy as reactLazy, useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Layers, RotateCw } from "lucide-react";
import { getCrops, getRotations } from "./api.js";
import { useI18n } from "./i18n.jsx";
import useHashRoute from "./hooks/useHashRoute.js";
import useStoredState from "./hooks/useStoredState.js";
import AppShell from "./components/AppShell.jsx";
import { Button, EmptyState } from "./components/ui.jsx";
import BrandLoader from "./components/BrandLoader.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import { irrigationMm, totalAcres, useFarmProfile } from "./farmProfile.js";

// After a new deploy, a page that was already open asks for code files that no
// longer exist. Reload once to pick up the new build instead of showing a blank screen.
const RELOAD_KEY = "aapkakhet-chunk-reload";
function reloadOnce() {
  try {
    if (sessionStorage.getItem(RELOAD_KEY)) return false;
    sessionStorage.setItem(RELOAD_KEY, "1");
  } catch { /* storage blocked: still try one reload */ }
  window.location.reload();
  return true;
}
if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", (e) => { if (reloadOnce()) e.preventDefault(); });
  window.addEventListener("load", () => setTimeout(() => { try { sessionStorage.removeItem(RELOAD_KEY); } catch { /* ignore */ } }, 10000));
}
const lazy = (load) => reactLazy(() => load().catch((err) => {
  if (reloadOnce()) return new Promise(() => {});   // the reload takes over
  throw err;
}));

// Everything after the landing page loads on demand, so the first visit only
// downloads the landing page (charts and the 3D farm come later, when needed).
const SetupPage = lazy(() => import("./pages/SetupPage.jsx"));
const PlansPage = lazy(() => import("./pages/PlansPage.jsx"));
const FieldPage = lazy(() => import("./pages/FieldPage.jsx"));
const CropsPage = lazy(() => import("./pages/CropsPage.jsx"));
const SoilPage = lazy(() => import("./pages/SoilPage.jsx"));
const FarmPage = lazy(() => import("./pages/FarmPage.jsx"));
const StartPage = lazy(() => import("./pages/StartPage.jsx"));
const TourPage = lazy(() => import("./pages/TourPage.jsx"));


// Farm-simulator crop keys -> the planner's crop names
const ENGINE_NAME = { cotton: "Cotton", rice: "Rice", maize: "Maize", sorghum: "Sorghum", pearl_millet: "Pearl millet",
  mung_bean: "Mung bean", soybean: "Soybean", guar: "Guar", sunflower: "Sunflower", sesbania: "Sesbania (green manure)",
  wheat: "Wheat", barley: "Barley", chickpea: "Chickpea", lentil: "Lentil", mustard: "Mustard / canola",
  potato: "Potato", berseem: "Berseem clover", oats: "Oats (cover)" };
const SHARED = ["lat", "lon", "place", "irrigation_mm"];
// Named soil types -> typical clay and sand (%)
const TEXTURE = { sandy: { clay: 8, sand: 75 }, loam: { clay: 20, sand: 40 }, clay: { clay: 48, sand: 20 } };

const DEFAULT_FORM = {
  lat: 31.42,          // Faisalabad
  lon: 73.08,
  place: "Faisalabad",
  irrigation_mm: 300,
  years: 3,
  start_season: "warm",
  weights: { soil_health: 6, water_saving: 6, climate_resilience: 6, profit: 6 },
  allowed_crops: null, // null = all crops, filled in once the list loads
  allow_fallow: false,
  use_soil_test: false,
  soil_override: { phh2o: 7.0, soc: 8, clay: 25, sand: 40 },
};

export default function App() {
  const { t } = useI18n();
  const { page, sub, go } = useHashRoute();
  const [crops, setCrops] = useState([]);
  const [plannerForm, setPlannerForm] = useStoredState("rotaterra-form", DEFAULT_FORM);
  // Location, water and farm size live in the shared farm profile (one source of truth
  // with Today and My fields); the planner keeps only its own choices (priorities,
  // crops, soil test, plan length).
  const [profile, setProfile] = useFarmProfile();
  const form = { ...plannerForm, lat: profile.lat, lon: profile.lon, place: profile.place,
    irrigation_mm: irrigationMm(profile), acres: totalAcres(profile) };
  // Always works on the LATEST settings (a ref), so a slow load that finishes later
  // (e.g. the crop list) can never write back old priorities over the farmer's choice.
  const formRef = useRef(form);
  formRef.current = form;
  const setForm = useCallback((update) => {
    const cur = formRef.current;
    const next = typeof update === "function" ? update(cur) : update;
    const shared = Object.fromEntries(SHARED.filter((k) => next[k] !== cur[k]).map((k) => [k, next[k]]));
    if (Object.keys(shared).length) setProfile((p) => ({ ...p, ...shared }));
    const own = Object.fromEntries(Object.entries(next).filter(([k]) => !SHARED.includes(k) && k !== "acres"));
    formRef.current = { ...cur, ...next };
    setPlannerForm(own);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [result, setResult] = useStoredState("rotaterra-result", null, "session");
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getCrops()
      .then((list) => {
        setCrops(list);
        setForm((f) => (f.allowed_crops ? f : { ...f, allowed_crops: list.map((c) => c.name) }));
      })
      .catch((e) => setError(`${t("apiDown")} ${e.message}`));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function findRotations() {
    setLoading(true);
    setError("");
    go("plans");
    const { use_soil_test, soil_override, place, acres, soil_texture, farm_acres, ...rest } = form; // eslint-disable-line no-unused-vars
    // the farmer's own rotation (field 1) is scored too and shown first
    const f1 = profile.fields?.[0];
    const current = f1 ? [f1.kharif, f1.rabi].filter(Boolean).map((k) => ENGINE_NAME[k]).filter(Boolean) : [];
    try {
      const data = await getRotations({
        ...rest,
        current_rotation: current.length ? current : null,
        farm_acres: farm_acres || acres || null,
        equipment: rest.equipment || [],
        market: rest.market || null,
        // the farmer's own mandi prices (Rs per maund), by planner crop name
        prices: Object.fromEntries(Object.entries(profile.prices || {}).filter(([, v]) => v > 0).map(([k, v]) => [ENGINE_NAME[k], v])),
        allowed_crops: form.allowed_crops?.length ? form.allowed_crops : null,
        // a soil test wins; otherwise a named soil type (sandy / loam / clay) sets the texture
        soil_override: use_soil_test ? soil_override : (soil_texture ? TEXTURE[soil_texture] : null),
      });
      // the current rotation goes first; remember what the plans were made for
      const rotations = data.current ? [data.current, ...data.rotations] : data.rotations;
      setResult({ ...data, rotations, _req: { lat: form.lat, lon: form.lon, place: form.place, irrigation_mm: form.irrigation_mm } });
      setSelected(data.current ? 1 : 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const openApp = useCallback(() => go("today", { replace: true }), [go]);
  // The landing and loading pages sit outside the app shell.
  // "Test my farm free" goes straight to the farm setup wizard
  if (page === "home") return <LandingPage onStart={() => go("today/setup")} />;
  if (page === "tour") return <Safe key="tour"><Suspense fallback={<BrandLoader />}><TourPage onExit={() => go("")} /></Suspense></Safe>;
  if (page === "start") return <Safe key="start"><Suspense fallback={<BrandLoader />}><StartPage onDone={openApp} /></Suspense></Safe>;

  const safeForm = { ...form, allowed_crops: form.allowed_crops || [] };
  // Plans made for another place or water than the farm has now
  const outdated = Boolean(result?._req) && (Math.abs(result._req.lat - form.lat) > 0.005
    || Math.abs(result._req.lon - form.lon) > 0.005 || result._req.irrigation_mm !== form.irrigation_mm);
  let content;
  if (page === "today") {
    content = <FarmPage view="today" go={go} fieldForm={result ? form : null} openSetup={sub === "setup"} />;
  } else if (page === "farm") {
    content = <FarmPage view="fields" go={go} fieldForm={result ? form : null} />;
  } else if (page === "setup" || !["plans", "field", "crops", "soil"].includes(page)) {
    // ("today" and "farm" are handled above; unknown pages fall back to setup)
    content = (
      <SetupPage step={sub} go={go} form={safeForm} setForm={setForm} crops={crops}
                 onSubmit={findRotations} loading={loading} />
    );
  } else if (loading) {
    content = <LoadingState />;
  } else if (error && page === "plans") {
    content = (
      <EmptyState icon={AlertTriangle} title={t("errorTitle")} body={error}
                  action={<Button variant="primary" icon={RotateCw} onClick={findRotations}>{t("retry")}</Button>} />
    );
  } else if (!result) {
    content = (
      <EmptyState icon={Layers} title={t("noResultsTitle")} body={t("noResultsBody")}
                  action={<Button variant="primary" onClick={() => go("setup")}>{t("startPlan")}</Button>} />
    );
  } else if (page === "plans") {
    content = <PlansPage result={result} selected={selected} setSelected={setSelected} go={go} />;
  } else if (page === "field") {
    content = <FieldPage site={result.site} />;
  } else if (page === "crops") {
    content = <CropsPage rows={result.suitability} site={result.site} />;
  } else {
    content = <SoilPage rotations={result.rotations} selected={selected} setSelected={setSelected} />;
  }

  return (
    <AppShell page={page === "setup" ? "setup" : page} go={go} hasResult={!!result} form={form}>
      {error && page === "setup" && <div className="notice notice-top">{error}</div>}
      {outdated && ["plans", "field", "crops", "soil"].includes(page) && !loading && (
        <div className="notice notice-top notice-outdated" role="status">
          <span>{t("plansOutdated", { then: result._req.place || "", now: form.place || "" })}</span>
          <Button variant="primary" icon={RotateCw} onClick={findRotations}>{t("updatePlans")}</Button>
        </div>
      )}
      <Safe key={page}><Suspense fallback={<div className="page"><BrandLoader /></div>}>{content}</Suspense></Safe>
    </AppShell>
  );
}

function LoadingState() {
  const { t } = useI18n();
  return (
    <div className="page">
      <BrandLoader
        title={t("loadingTitle")}
        messages={[t("lm_weather"), t("lm_soil"), t("lm_satellite"), t("lm_future"), t("lm_combos")]}
        note={t("loading")}
      />
    </div>
  );
}

// Never leave the farmer on a blank screen: if a page fails, say so and offer a reload.
class Safe extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) { console.error(err); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="safe-fail" role="alert">
        <p className="safe-ur" lang="ur" dir="rtl">کچھ غلط ہو گیا۔ دوبارہ کوشش کریں۔</p>
        <p>Something went wrong loading this page.</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>↻ Reload / دوبارہ کھولیں</button>
      </div>
    );
  }
}
