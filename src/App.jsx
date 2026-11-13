import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Layers, RotateCw } from "lucide-react";
import { getCrops, getRotations } from "./api.js";
import { useI18n } from "./i18n.jsx";
import useHashRoute from "./hooks/useHashRoute.js";
import useStoredState from "./hooks/useStoredState.js";
import AppShell from "./components/AppShell.jsx";
import { Button, EmptyState } from "./components/ui.jsx";
import BrandLoader from "./components/BrandLoader.jsx";
import SetupPage from "./pages/SetupPage.jsx";
import PlansPage from "./pages/PlansPage.jsx";
import FieldPage from "./pages/FieldPage.jsx";
import CropsPage from "./pages/CropsPage.jsx";
import SoilPage from "./pages/SoilPage.jsx";
import FarmPage from "./pages/FarmPage.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import StartPage from "./pages/StartPage.jsx";

const DEFAULT_FORM = {
  lat: 41.6,
  lon: -93.6,
  irrigation_mm: 150,
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
    const { use_soil_test, soil_override, ...rest } = form;
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

  const openApp = useCallback(() => go("setup/1", { replace: true }), [go]);
  // The landing and loading pages sit outside the app shell.
  if (page === "home") return <LandingPage onStart={() => go("start")} />;
  if (page === "start") return <StartPage onDone={openApp} />;

  const safeForm = { ...form, allowed_crops: form.allowed_crops || [] };
  let content;
  if (page === "farm") {
    content = <FarmPage fieldForm={result ? form : null} />;
  } else if (page === "setup" || !["plans", "field", "crops", "soil"].includes(page)) {
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
                  action={<Button variant="primary" onClick={() => go("setup/1")}>{t("startPlan")}</Button>} />
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
      {content}
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
