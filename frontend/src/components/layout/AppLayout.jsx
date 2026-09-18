import { useState } from "react";
import Header from "./Header";
import Sidebar from "./Sidebar";

export default function AppLayout({ children, currentPath, noPadding }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className={`app-shell${collapsed ? " sidebar-collapsed" : ""}`}>
      <Header currentPath={currentPath} onToggleSidebar={() => setCollapsed((c) => !c)} collapsed={collapsed} />
      <Sidebar currentPath={currentPath} collapsed={collapsed} />
      <main className="page-content">
        {noPadding ? (
          <div style={{ height: "100%", overflow: "hidden" }}>{children}</div>
        ) : (
          <div className="page-inner">{children}</div>
        )}
      </main>
    </div>
  );
}