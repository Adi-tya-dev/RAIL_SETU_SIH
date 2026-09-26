export default function Card({ title, subtitle, actions, children, className = "", bodyClassName = "" }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="card__head" style={actions ? { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 } : undefined}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {title && <h2>{title}</h2>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions && <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>{actions}</div>}
        </div>
      )}
      <div className={title || actions ? `card__body ${bodyClassName}` : bodyClassName}>{children}</div>
    </section>
  );
}