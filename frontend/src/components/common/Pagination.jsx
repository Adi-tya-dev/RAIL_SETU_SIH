import { ChevronLeft, ChevronRight } from "lucide-react";
import { PAGE_SIZE_OPTIONS } from "../../utils/constants";

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

export default function Pagination({
  pagination,
  onChange,
  disabled = false,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
}) {
  if (!pagination) return null;

  const { page = 1, total = 0, totalPages = 0, limit = 0 } = pagination;
  const currentLimit = pageSize || limit || 10;
  const computedTotalPages =
    total > 0 && currentLimit > 0
      ? Math.ceil(total / currentLimit)
      : (totalPages > 0 ? totalPages : 0);
  const from = total === 0 ? 0 : (page - 1) * currentLimit + 1;
  const to = Math.min(page * currentLimit, total);

  return (
    <div className="pagination">
      <div className="pagination__info">
        <span className="pagination__meta">
          Showing <strong>{from}</strong>–<strong>{to}</strong> of <strong>{total}</strong> records
        </span>

        {Boolean(onPageSizeChange) && (
          <div className="pagination__size">
            <span className="pagination__size-divider">|</span>
            <label htmlFor="pagination-page-size" className="pagination__size-label">
              Show:
            </label>
            <select
              id="pagination-page-size"
              className="pagination__size-select"
              value={pageSize || limit}
              disabled={disabled}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onChange(1);
              }}
              aria-label="Records per page"
            >
              {(pageSizeOptions || PAGE_SIZE_OPTIONS).map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="pagination__pages">
        <button
          type="button"
          className="page-btn page-btn--nav"
          disabled={disabled || page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={15} />
          <span>Previous</span>
        </button>

        {computedTotalPages > 0 &&
          pageWindow(page, computedTotalPages).map((item, i) =>
            item === "…" ? (
              <span key={`e-${i}`} className="page-ellipsis">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                className={`page-btn ${item === page ? "is-active is-current" : ""}`}
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
          className="page-btn page-btn--nav"
          disabled={disabled || (computedTotalPages > 0 ? page >= computedTotalPages : true)}
          onClick={() => onChange(page + 1)}
          aria-label="Next page"
        >
          <span>Next</span>
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}