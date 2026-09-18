import { createContext, useCallback, useContext, useState, useRef } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";

const ToastContext = createContext(null);

let _id = 0;
function nextId() { return ++_id; }

function Toast({ toast, onDismiss }) {
  const icons = {
    success: CheckCircle2,
    error:   XCircle,
    warning: AlertTriangle,
    info:    Info,
  };
  const Icon = icons[toast.type] || Info;

  return (
    <div className={`toast toast--${toast.type}`} role="alert">
      <span className="toast__icon"><Icon size={16} /></span>
      <span className="toast__message">{toast.message}</span>
      <button className="toast__dismiss" onClick={() => onDismiss(toast.id)} aria-label="Dismiss">
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const push = useCallback((type, message, duration = 4000) => {
    const id = nextId();
    setToasts((t) => [...t, { id, type, message }]);
    timers.current[id] = setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  const toast = {
    success: (msg, d) => push("success", msg, d),
    error:   (msg, d) => push("error",   msg, d),
    warning: (msg, d) => push("warning", msg, d),
    info:    (msg, d) => push("info",    msg, d),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}