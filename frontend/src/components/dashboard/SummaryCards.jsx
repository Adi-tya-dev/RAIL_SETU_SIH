import { formatNumber } from "../../utils/formatters";

function SkeletonCard() {
  return (
    <div className="summary-card">
      <div className="summary-card__label" />
      <div />
      <div className="summary-card__sub" />
    </div>
  );
}

function CardContent({ label, value, sub, tone = "amber" }) {
  return (
    <div className={`summary-card summary-card--${tone}`}>
      <div className="summary-card__label">{label}</div>
      <div className="summary-card__value">{value}</div>
      {sub && <div className="summary-card__sub">{sub}</div>}
    </div>
  );
}

export default function SummaryCards({ data, loading, error, onRetry }) {
  if (loading) {
    return (
      <div className="summary-grid" aria-busy="true">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="card card--padded">
        <div className="state state--error" role="alert">
          <p className="state__title">Dashboard summary unavailable</p>
          <p>{error.message}</p>
          {onRetry && (
            <button type="button" className="btn btn--secondary btn--sm" onClick={onRetry}>
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card card--padded">
        <div className="state state--empty">No summary data available.</div>
      </div>
    );
  }

  const m = data.maintenance || {};
  const b = data.blocks || {};
  const t = data.trains || {};
  const a = data.assets || {};
  const p = data.plans || {};

  return (
    <div className="summary-grid">
      <CardContent
        label="Maintenance Tasks"
        value={formatNumber(m.total)}
        tone="amber"
        sub={<span className="pill">Total requests</span>}
      />
      <CardContent
        label="Available Blocks"
        value={formatNumber(b.available)}
        tone="green"
        sub={<span className="pill">{formatNumber(b.total)} total</span>}
      />
      <CardContent
        label="Active Trains"
        value={formatNumber(t.active)}
        tone="blue"
        sub={<span className="pill">{formatNumber(t.total)} total</span>}
      />
      <CardContent
        label="Critical Assets"
        value={formatNumber(a.critical)}
        tone="red"
        sub={<span className="pill">{formatNumber(a.defective)} defective</span>}
      />
      <CardContent
        label="Pending Maintenance"
        value={formatNumber(m.pending)}
        tone="amber"
        sub={<span className="pill">{formatNumber(m.completed)} completed</span>}
      />
      <CardContent
        label="Unavailable Blocks"
        value={formatNumber(b.unavailable)}
        tone="red"
        sub={<span className="pill">Currently blocked</span>}
      />
      <CardContent
        label="Generated Plans"
        value={formatNumber(p.total)}
        tone="cyan"
        sub={<span className="pill">{formatNumber(p.active)} active</span>}
      />
      <CardContent
        label="Open Conflicts"
        value="—"
        tone="gray"
        sub={<span className="pill">Loaded from saved plans</span>}
      />
    </div>
  );
}