import { useEffect } from "react";

export default function Drawer({ open, onClose, title, subtitle, children, footer, width }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="drawer-overlay" onClick={onClose} role="presentation">
      <aside
        className="drawer"
        style={width ? { width } : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="drawer__header">
          <div>
            <h2>{title}</h2>
            {subtitle && <p className="drawer__subtitle">{subtitle}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close details">
            ✕
          </button>
        </header>
        <div className="drawer__body">{children}</div>
        {footer && <footer className="drawer__footer">{footer}</footer>}
      </aside>
    </div>
  );
}