export default function KpiCard({ icon: Icon, value, label, desc, color = "var(--accent)", bgColor = "var(--accent-dim)", loading }) {
  return (
    <article className="kpi-card">
      <div className="kpi-card__icon" style={{ color, background: bgColor }}>
        {Icon && <Icon size={18} aria-hidden="true" />}
      </div>
      <div className="kpi-card__content">
        <div className="kpi-card__value" style={{ color }}>{loading ? "—" : value ?? "—"}</div>
        <div className="kpi-card__label">{label}</div>
        <div className="kpi-card__desc">{desc}</div>
      </div>
    </article>
  );
}