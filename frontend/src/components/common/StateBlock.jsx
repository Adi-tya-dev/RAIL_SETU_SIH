import Button from "./Button";

export default function StateBlock({
  loading,
  error,
  isEmpty,
  loadingMessage = "Loading…",
  emptyMessage = "No data found.",
  errorMessage,
  onRetry,
  retryLabel = "Retry",
  children,
}) {
  if (loading) {
    return (
      <div className="state state--loading" role="status">
        <span className="spinner" aria-hidden="true" />
        <p>{loadingMessage}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="state state--error" role="alert">
        <p className="state__title">Unable to load data</p>
        <p>{errorMessage || error?.message || "Something went wrong."}</p>
        {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>{retryLabel}</Button>}
      </div>
    );
  }

  if (isEmpty) {
    return <div className="state state--empty">{emptyMessage}</div>;
  }

  return children;
}