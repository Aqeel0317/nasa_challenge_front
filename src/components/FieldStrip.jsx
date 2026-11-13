import { useI18n } from "../i18n.jsx";

// The plan drawn like strips on a field: one band per season, gold for kharif
// (warm) and blue for rabi (cool), grouped under year labels.
export default function FieldStrip({ sequence, seasons }) {
  const { t, crop, season } = useI18n();
  const years = [];
  sequence.forEach((c, i) => {
    const y = Math.floor(i / 2);
    (years[y] ||= []).push({ crop: c, season: seasons[i] });
  });

  return (
    <ol className="strip">
      {years.map((ys, y) => (
        <li key={y} className="strip-year">
          <span className="strip-year-label">{t("yearN", { y: y + 1 })}</span>
          <ol className="strip-bands">
            {ys.map((b, k) => (
              <li key={k} className={`band band-${b.season}`}>
                <span className="band-season">{season(b.season)}</span>
                <span className="band-crop">{crop(b.crop)}</span>
              </li>
            ))}
          </ol>
        </li>
      ))}
    </ol>
  );
}
