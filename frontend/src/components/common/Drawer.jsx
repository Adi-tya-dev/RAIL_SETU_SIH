import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export default function Drawer({ open, onClose, title, subtitle, children, footer, width }) {
  const bodyRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Always reset scroll to the very top whenever the drawer opens or title/content changes
  useEffect(() => {
    if (open && bodyRef.current) {
      bodyRef.current.scrollTop = 0;
    }
  }, [open, title]);

  if (!open) return null;

  const drawerContent = (
    <div className="drawer-overlay" onClick={onClose} role="presentation">
      <aside
        className="drawer"
        style={width ? { width } : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="drawer__head">
          <div className="drawer__head-text">
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="drawer__close" onClick={onClose} aria-label="Close details">
            ✕
          </button>
        </header>
        <div className="drawer__body" ref={bodyRef}>
          {children}
        </div>
        {footer && <footer className="drawer__foot">{footer}</footer>}
      </aside>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(drawerContent, document.body)
    : drawerContent;
}