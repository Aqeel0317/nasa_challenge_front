import { useEffect, useRef, useState } from "react";
import { LocateFixed, MapPin, Search, X } from "lucide-react";
import { useI18n } from "../../i18n.jsx";
import { QUICK_PLACES, placeName, searchPlaces } from "../../weather.js";

// Where is your farm? Search by name, use the phone's GPS, or tap a district.
// The chosen place drives the NASA simulation, the live NASA panel and the forecast.
export default function LocationPicker({ place, lat, lon, onPick }) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [gpsMsg, setGpsMsg] = useState("");
  const inputRef = useRef(null);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  // Search as the farmer types (after a short pause)
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

  const choose = (p) => { onPick(p); setOpen(false); setQ(""); setResults([]); setGpsMsg(""); };

  const useGps = () => {
    if (!navigator.geolocation) { setGpsMsg(t("gpsNone")); return; }
    setGpsMsg(t("gpsFinding"));
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const la = +pos.coords.latitude.toFixed(3), lo = +pos.coords.longitude.toFixed(3);
      const name = (await placeName(la, lo, lang)) || t("myLocation");
      choose({ name, lat: la, lon: lo });
    }, () => setGpsMsg(t("gpsDenied")), { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 });
  };

  const label = place || `${(+lat).toFixed(2)}, ${(+lon).toFixed(2)}`;

  return (
    <section className={`locpick ${open ? "is-open" : ""}`}>
      <div className="locpick-bar">
        <span className="locpick-pin" aria-hidden="true"><MapPin size={20} /></span>
        <div className="locpick-now">
          <span className="locpick-k">{t("yourFarmIn")}</span>
          <strong><bdi>{label}</bdi></strong>
        </div>
        <button type="button" className="locpick-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? <X size={18} aria-hidden="true" /> : null}{open ? t("close") : t("changePlace")}
        </button>
      </div>

      {open && (
        <div className="locpick-panel">
          <button type="button" className="locpick-gps" onClick={useGps}>
            <LocateFixed size={20} aria-hidden="true" /> {t("useMyLocation")}
          </button>
          {gpsMsg && <p className="locpick-msg" role="status">{gpsMsg}</p>}

          <label className="locpick-search">
            <Search size={18} aria-hidden="true" />
            <input ref={inputRef} type="search" value={q} onChange={(e) => setQ(e.target.value)}
                   placeholder={t("searchPlace")} aria-label={t("searchPlace")} autoComplete="off" />
          </label>
          {busy && <p className="locpick-msg">{t("searching")}</p>}
          {results.length > 0 && (
            <ul className="locpick-results">
              {results.map((r) => (
                <li key={`${r.lat},${r.lon}`}>
                  <button type="button" onClick={() => choose(r)}>
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
                      aria-pressed={Math.abs(p.lat - lat) < 0.01 && Math.abs(p.lon - lon) < 0.01}
                      onClick={() => choose({ name: lang === "ur" ? p.ur : p.name, lat: p.lat, lon: p.lon })}>
                {lang === "ur" ? p.ur : p.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
