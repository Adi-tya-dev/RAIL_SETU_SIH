export default function Card({ title, subtitle, actions, children, className = "", bodyClassName = "" }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="card__head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions && <div>{actions}</div>}
        </div>
      )}
      <div className={title || actions ? `card__body ${bodyClassName}` : bodyClassName}>{children}</div>
    </section>
  );
}