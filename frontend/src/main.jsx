import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ToastProvider } from "./contexts/ToastContext";
import { SystemStatusProvider } from "./contexts/SystemStatusContext";
import { LiveEventsProvider } from "./contexts/LiveEventsContext";
import ErrorBoundary from "./components/common/ErrorBoundary";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <SystemStatusProvider>
          <ToastProvider>
            <LiveEventsProvider>
              <App />
            </LiveEventsProvider>
          </ToastProvider>
        </SystemStatusProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);