export default function MiniBarChart({ data, tone = "accent", valueSuffix = "" }) {
  const max = Math.max(1, ...data.map((d) => Number(d.value) || 0));

  return (
    <div className="bars">
      {data.map((d) => (
        <div className="bar-row" key={d.label}>
          <span className="bar-row__label" title={d.label}>
            {d.label}
          </span>
          <div className="bar-row__track">
            <div
              className={`bar-row__fill fill--${d.tone || tone}`}
              style={{ width: `${(Number(d.value) || 0) / max * 100}%` }}
            />
          </div>
          <span className="bar-row__value">
            {Number(d.value) || 0}
            {valueSuffix}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items }) {
  return (
    <div className="legend">
      {items.map((item) => (
        <span className="legend__item" key={item.label}>
          <span className="legend__swatch" style={{ background: swatchColor(item.tone) }} />
          {item.label}: {item.value}
        </span>
      ))}
    </div>
  );
}

function swatchColor(tone) {
  const colors = {
    amber: "#f59e0b",
    green: "#34d399",
    red: "#f87171",
    blue: "#38bdf8",
    cyan: "#22d3ee",
    gray: "#64748b",
    orange: "#fb923c",
  };
  return colors[tone] || "#64748b";
}