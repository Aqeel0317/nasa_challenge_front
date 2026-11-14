import { useEffect, useState } from "react";

// The loading mark: a seedling draws itself and opens its leaves while a small
// satellite circles it (NASA data feeding the field). Pure SVG + CSS, so it is
// smooth on phones; it holds still for people who ask for reduced motion.
export function GrowMark({ size = 96 }) {
  return (
    <svg className="grow-mark" viewBox="0 0 120 120" width={size} height={size} aria-hidden="true">
      <defs>
        <radialGradient id="gm-glow">
          <stop offset="0" stopColor="currentColor" stopOpacity=".28" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="60" cy="60" r="58" fill="url(#gm-glow)" className="gm-halo" />
      <circle cx="60" cy="60" r="48" className="gm-track" />
      <circle cx="60" cy="60" r="48" className="gm-arc" pathLength="100" />
      <g className="gm-orbit">
        <circle cx="60" cy="12" r="7" className="gm-sat-glow" />
        <circle cx="60" cy="12" r="3.4" className="gm-sat" />
      </g>
      <path d="M34 88 Q60 80 86 88" className="gm-ground" />
      <path d="M60 86 C60 76 60 66 60 50" className="gm-stem" pathLength="100" />
      <path d="M60 70 C49 69 42 62 41 52 C51 52 59 59 60 70Z" className="gm-leaf gm-leaf-l" />
      <path d="M60 60 C71 59 78 52 79 42 C69 42 61 49 60 60Z" className="gm-leaf gm-leaf-r" />
    </svg>
  );
}

// Branded loading state: the growing mark, a title, a thin shimmering line and a
// status line. Several messages fade from one to the next; they say what the app
// is working on, not how far it has got, so none is ever ticked off.
export default function BrandLoader({ title, messages = [], size = "page", note }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (messages.length < 2) return undefined;
    // steps move forward and stop at the last one (a checklist, not an endless loop)
    const id = setInterval(() => setI((n) => Math.min(n + 1, messages.length - 1)), 2600);
    return () => clearInterval(id);
  }, [messages.length]);

  return (
    <div className={`brand-loader brand-loader-${size}`} role="status" aria-live="polite" aria-busy="true">
      <GrowMark size={size === "page" ? 104 : 76} />
      {title && <p className="brand-loader-title">{title}</p>}
      <div className="grow-line" aria-hidden="true"><i /></div>
      {messages.length > 1 && (
        <>
          <div className="load-bar" aria-hidden="true"><i style={{ inlineSize: `${Math.round(((i + 1) / messages.length) * 100)}%` }} /></div>
          <ol className="load-steps">
            {messages.map((m, k) => (
              <li key={k} className={k < i ? "done" : k === i ? "now" : ""}>
                <span aria-hidden="true">{k < i ? "✓" : k === i ? "●" : "○"}</span> {m}
              </li>
            ))}
          </ol>
        </>
      )}
      {messages.length === 1 && <p className="brand-loader-msg">{messages[0]}</p>}
      {note && <p className="brand-loader-note">{note}</p>}
    </div>
  );
}

// Small inline version for quick refreshes: three dots that pulse in turn.
export function MiniBars({ label }) {
  return (
    <span className="mini-loader" role="status">
      <span className="grow-dots" aria-hidden="true"><i /><i /><i /></span>
      {label}
    </span>
  );
}
