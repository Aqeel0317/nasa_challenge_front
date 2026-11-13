import { useEffect, useState } from "react";
import { Logo } from "./Brand.jsx";

// Branded loading state: the logo, three moving bars (green, gold, blue) and a
// status line. When given several messages it cycles through them; these say
// what the app is working on, not how far it has got, so none is ever ticked off.
export default function BrandLoader({ title, messages = [], size = "page", note }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (messages.length < 2) return undefined;
    const id = setInterval(() => setI((n) => (n + 1) % messages.length), 1800);
    return () => clearInterval(id);
  }, [messages.length]);

  return (
    <div className={`brand-loader brand-loader-${size}`} role="status" aria-live="polite" aria-busy="true">
      <Logo size={size === "page" ? 64 : 48} />
      {title && <p className="brand-loader-title">{title}</p>}
      <div className="loader-bars" aria-hidden="true"><span /><span /><span /></div>
      {messages.length > 0 && (
        <p className="brand-loader-msg" key={i}>{messages[i]}</p>
      )}
      {note && <p className="brand-loader-note">{note}</p>}
    </div>
  );
}

// Small inline version for quick refreshes (three short moving bars).
export function MiniBars({ label }) {
  return (
    <span className="mini-loader" role="status">
      <span className="loader-bars loader-bars-mini" aria-hidden="true"><span /><span /><span /></span>
      {label}
    </span>
  );
}
