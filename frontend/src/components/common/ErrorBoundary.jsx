import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: 32,
            margin: 24,
            background: "#1e1e24",
            border: "2px solid #ef4444",
            borderRadius: 12,
            color: "#f8fafc",
            fontFamily: "monospace",
          }}
        >
          <h2 style={{ color: "#ef4444", margin: "0 0 12px" }}>
            ⚠ Application Error Detected
          </h2>
          <p style={{ fontSize: 14, color: "#cbd5e1", marginBottom: 16 }}>
            {this.state.error?.toString()}
          </p>
          <pre
            style={{
              background: "#0f172a",
              padding: 16,
              borderRadius: 8,
              fontSize: 12,
              overflowX: "auto",
              color: "#fca5a5",
              whiteSpace: "pre-wrap",
            }}
          >
            {this.state.error?.stack}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: 16,
              padding: "8px 16px",
              background: "#ef4444",
              color: "#ffffff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
