// Small shared building blocks used across pages.
export function PageHeader({ title, lead, actions }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {lead && <p className="page-lead">{lead}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Button({ variant = "secondary", icon: Icon, children, ...props }) {
  return (
    <button type="button" className={`btn btn-${variant}`} {...props}>
      {Icon && <Icon size={18} aria-hidden="true" className="flip-rtl" />}
      <span>{children}</span>
    </button>
  );
}

export function Panel({ title, children, className = "" }) {
  return (
    <section className={`panel ${className}`}>
      {title && <h2 className="panel-title">{title}</h2>}
      {children}
    </section>
  );
}

export function EmptyState({ icon: Icon, title, body, action }) {
  return (
    <div className="empty-state">
      {Icon && <Icon size={40} strokeWidth={1.5} aria-hidden="true" />}
      <h2>{title}</h2>
      <p>{body}</p>
      {action}
    </div>
  );
}

export function ScoreBar({ label, value }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="score-bar">
      <div className="score-bar-head">
        <span>{label}</span>
        <bdi className="num">{pct}</bdi>
      </div>
      <div className="score-track" role="meter" aria-valuemin={0} aria-valuemax={100}
           aria-valuenow={pct} aria-label={label}>
        <div className="score-fill" style={{ inlineSize: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Stat({ label, value }) {
  return (
    <div className="stat">
      <bdi className="stat-value">{value}</bdi>
      <span className="stat-label">{label}</span>
    </div>
  );
}

// Traffic-light word chip: level is "good", "watch" or "risk".
export function Level({ level, children }) {
  return <span className={`level level-${level}`}>{children}</span>;
}

// Folded section for the detailed, technical charts.
export function Advanced({ label, children }) {
  return (
    <details className="advanced">
      <summary>{label}</summary>
      <div className="advanced-body">{children}</div>
    </details>
  );
}
