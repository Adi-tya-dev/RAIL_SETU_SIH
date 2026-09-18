export function DetailSection({ title, children }) {
  return (
    <div>
      <h3 className="detail-section__title">{title}</h3>
      {children}
    </div>
  );
}

export function DetailList({ items }) {
  const rows = items.filter(Boolean).filter((item) => item && item.label);
  if (rows.length === 0) return null;

  return (
    <dl className="detail-list">
      {rows.map((item, index) => (
        <div className="detail-list__row" key={index}>
          <dt>{item.label}</dt>
          <dd>{item.value === null || item.value === undefined ? "—" : item.value}</dd>
        </div>
      ))}
    </dl>
  );
}