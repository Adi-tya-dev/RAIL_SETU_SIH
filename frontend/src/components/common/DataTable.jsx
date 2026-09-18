function renderCell(row, column) {
  const value = column.key === undefined ? undefined : row[column.key];
  return column.render ? column.render(row) : String(value ?? "");
}

export default function DataTable({
  columns,
  rows = [],
  rowKey,
  onRowClick,
  loading = false,
  emptyMessage = "No records found.",
  ariaLabel,
}) {
  if (!loading && rows.length === 0) {
    return <div className="state state--empty">{emptyMessage}</div>;
  }

  return (
    <div className="table-wrap">
      {loading && rows.length > 0 && (
        <div className="table-loading-bar" role="status">
          <span className="spinner spinner--xs" />
          Refreshing data…
        </div>
      )}
      <table className="data-table" aria-label={ariaLabel}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key || col.label} className={col.className}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={rowKey ? rowKey(row, index) : index}
              className={onRowClick ? "is-clickable" : ""}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={
                onRowClick
                  ? (e) => {
                      if (e.key === "Enter") onRowClick(row);
                    }
                  : undefined
              }
            >
              {columns.map((col) => (
                <td key={col.key || col.label} className={col.className}>
                  {renderCell(row, col)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}