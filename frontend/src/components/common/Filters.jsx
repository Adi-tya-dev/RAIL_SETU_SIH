export function FilterField({ label, children, grow = false, className = "" }) {
  return (
    <div className={`filter-field ${grow ? "filter-field--grow" : ""} ${className}`}>
      <label>{label}</label>
      {children}
    </div>
  );
}

export default function Filters({ children, tip }) {
  return (
    <div className="filters">
      {children}
      {tip && <div className="filters__tip">{tip}</div>}
    </div>
  );
}