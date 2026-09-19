import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { ToastProvider } from "./contexts/ToastContext";
import { SystemStatusProvider } from "./contexts/SystemStatusContext";
import { LiveEventsProvider } from "./contexts/LiveEventsContext";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SystemStatusProvider>
      <ToastProvider>
        <LiveEventsProvider>
          <App />
        </LiveEventsProvider>
      </ToastProvider>
    </SystemStatusProvider>
  </React.StrictMode>
);