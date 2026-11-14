import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { AlertTriangle, Layers, RotateCw } from "lucide-react";
import { getCrops, getRotations } from "./api.js";
import { useI18n } from "./i18n.jsx";
import useHashRoute from "./hooks/useHashRoute.js";
import useStoredState from "./hooks/useStoredState.js";
import AppShell from "./components/AppShell.jsx";
import { Button, EmptyState } from "./components/ui.jsx";
import BrandLoader from "./components/BrandLoader.jsx";
import LandingPage from "./pages/LandingPage.jsx";

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
  const [form, setForm] = useStoredState("rotaterra-form", DEFAULT_FORM);
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
    const { use_soil_test, soil_override, place, ...rest } = form; // eslint-disable-line no-unused-vars
    try {
      const data = await getRotations({
        ...rest,
        allowed_crops: form.allowed_crops?.length ? form.allowed_crops : null,
        soil_override: use_soil_test ? soil_override : null,
      });
      setResult(data);
      setSelected(0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const openApp = useCallback(() => go("today", { replace: true }), [go]);
  // The landing and loading pages sit outside the app shell.
  if (page === "home") return <LandingPage onStart={() => go("start")} />;
  if (page === "tour") return <Suspense fallback={<BrandLoader />}><TourPage onExit={() => go("")} /></Suspense>;
  if (page === "start") return <Suspense fallback={<BrandLoader />}><StartPage onDone={openApp} /></Suspense>;

  const safeForm = { ...form, allowed_crops: form.allowed_crops || [] };
  let content;
  if (page === "today") {
    content = <FarmPage view="today" go={go} fieldForm={result ? form : null} />;
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
    content = <CropsPage rows={result.suitability} />;
  } else {
    content = <SoilPage rotations={result.rotations} selected={selected} setSelected={setSelected} />;
  }

  return (
    <AppShell page={page === "setup" ? "setup" : page} go={go} hasResult={!!result} form={form}>
      {error && page === "setup" && <div className="notice notice-top">{error}</div>}
      <Suspense fallback={<div className="page"><BrandLoader /></div>}>{content}</Suspense>
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
