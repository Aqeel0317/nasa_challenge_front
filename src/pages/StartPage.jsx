import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { getCrops } from "../api.js";
import { useI18n } from "../i18n.jsx";
import { Logo } from "../components/Brand.jsx";

// Shown after "Get started". It does real work while it is on screen: fetches the
// crop list and downloads the 3D farm code, so the app opens ready to use.
// It stays at least 1.6 s so the steps can be read, and never waits forever.
const STEPS = ["ld_crops", "ld_farm", "ld_ready"];

export default function StartPage({ onDone }) {
  const { t } = useI18n();
  const [done, setDone] = useState(0);

  useEffect(() => {
    let alive = true;
    const tick = () => alive && setDone((d) => d + 1);
    const minWait = new Promise((r) => setTimeout(r, 1600));
    const crops = getCrops().catch(() => null).finally(tick);
    const farm = import("../components/farm/Farm3D.jsx").catch(() => null).finally(tick);
    const timeout = new Promise((r) => setTimeout(r, 8000));
    Promise.race([Promise.all([crops, farm, minWait]), timeout]).then(() => {
      if (!alive) return;
      setDone(STEPS.length);
      setTimeout(() => alive && onDone(), 450);
    });
    return () => { alive = false; };
  }, [onDone]);

  return (
    <div className="start-page" role="status" aria-live="polite">
      <Logo size={76} />
      <p className="start-name" lang="ur" dir="rtl">آپ کا کھیت</p>
      <p className="start-latin">Aap ka Khet</p>
      <div className="start-bars" aria-hidden="true"><span /><span /><span /></div>
      <ul className="start-steps">
        {STEPS.map((k, i) => (
          <li key={k} className={i < done ? "is-done" : i === done ? "is-active" : ""}>
            <span className="start-tick">{i < done && <Check size={13} aria-hidden="true" />}</span>
            {t(k)}
          </li>
        ))}
      </ul>
    </div>
  );
}
