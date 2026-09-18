import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { ToastProvider } from "./contexts/ToastContext";
import { SystemStatusProvider } from "./contexts/SystemStatusContext";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SystemStatusProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </SystemStatusProvider>
  </React.StrictMode>
);