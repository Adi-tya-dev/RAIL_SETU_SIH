function pageWindow(page, totalPages) {
  const items = [];
  const pushPage = (p) => {
    if (p >= 1 && p <= totalPages && (items.length === 0 || items[items.length - 1] !== p)) items.push(p);
  };

  pushPage(1);

  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);

  if (start > 2) items.push("…");
  for (let p = start; p <= end; p += 1) pushPage(p);
  if (end < totalPages - 1) items.push("…");

  if (totalPages > 1) pushPage(totalPages);

  return items;
}

export default function Pagination({ pagination, onChange, disabled = false }) {
  if (!pagination) return null;

  const { page = 1, total = 0, totalPages = 0, limit = 0 } = pagination;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="pagination">
      <span className="pagination__meta">
        Showing {from}–{to} of {total} records
      </span>
      <button
        type="button"
        className="page-btn"
        disabled={disabled || page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label="Previous page"
      >
        Previous
      </button>
      {totalPages > 0 &&
        pageWindow(page, totalPages).map((item, i) =>
          item === "…" ? (
            <span key={`e-${i}`} className="page-ellipsis">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              className={`page-btn ${item === page ? "is-current" : ""}`}
              disabled={disabled}
              onClick={() => onChange(item)}
              aria-current={item === page ? "page" : undefined}
            >
              {item}
            </button>
          )
        )}
      <button
        type="button"
        className="page-btn"
        disabled={disabled || page >= totalPages}
        onClick={() => onChange(page + 1)}
        aria-label="Next page"
      >
        Next
      </button>
    </div>
  );
}