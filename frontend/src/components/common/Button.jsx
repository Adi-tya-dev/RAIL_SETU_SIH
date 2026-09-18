export default function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  loadingText,
  icon: Icon,
  disabled,
  children,
  className = "",
  type = "button",
  ...rest
}) {
  return (
    <button
      type={type}
      className={`btn btn--${variant} btn--${size} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <span className="spinner spinner--xs" aria-hidden="true" />}
      {!loading && Icon && <Icon size={15} aria-hidden="true" />}
      {loading ? loadingText || "Loading…" : children}
    </button>
  );
}