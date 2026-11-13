// The app's name is Urdu: "آپ کا کھیت" (Aap ka Khet, "your field").
// The lockup shows the Urdu name with its Latin transliteration in both languages.
export function Logo({ size = 30 }) {
  // Three furrow lines: the mark echoes the plan strips used across the app.
  return (
    <svg className="logo" style={{ width: size, height: size }} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--canopy-brand, #24583a)" />
      <path d="M7 22c5-2 13-2 18 0M7 17c5-2 13-2 18 0M7 12c5-2 13-2 18 0"
            stroke="#d4a23a" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export default function Brand({ size = 30, href = "#/" }) {
  return (
    <a className="brand" href={href} aria-label="آپ کا کھیت – Aap ka Khet">
      <Logo size={size} />
      <span className="brand-text">
        <span className="brand-ur" lang="ur" dir="rtl">آپ کا کھیت</span>
        <span className="brand-en" lang="en" dir="ltr">Aap ka Khet</span>
      </span>
    </a>
  );
}
