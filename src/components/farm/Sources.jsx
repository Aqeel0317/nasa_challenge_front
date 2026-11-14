import { useI18n } from "../../i18n.jsx";

// Every dataset the app uses, what it is used for, and where it comes from.
const SOURCES = [
  ["NASA POWER", "https://power.larc.nasa.gov/", "src_power"],
  ["NASA MODIS NDVI (MOD13, via NASA GIBS)", "https://nasa-gibs.github.io/gibs-api-docs/available-visualizations/", "src_modis"],
  ["NASA SMAP L4 soil moisture (via NASA GIBS)", "https://nsidc.org/data/spl4smgp", "src_smap"],
  ["NASA EONET", "https://eonet.gsfc.nasa.gov/", "src_eonet"],
  ["ISRIC SoilGrids 2.0", "https://soilgrids.org/", "src_soil"],
  ["Open-Meteo forecast", "https://open-meteo.com/en/docs", "src_meteo"],
  ["Open-Meteo Climate API (CMIP6)", "https://open-meteo.com/en/docs/climate-api", "src_cmip6"],
];

export default function Sources() {
  const { t } = useI18n();
  return (
    <details className="glossary sources" id="sources">
      <summary>🔗 {t("src_title")}</summary>
      <ul>
        {SOURCES.map(([name, url, k]) => (
          <li key={k}>
            <a href={url} target="_blank" rel="noopener noreferrer">{name}</a>
            <span className="muted"> · {t(k)}</span>
          </li>
        ))}
      </ul>
      <p className="muted small">{t("src_note")}</p>
    </details>
  );
}
