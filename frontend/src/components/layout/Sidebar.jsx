import {
  LayoutDashboard,
  Map,
  Train,
  Grid3x3,
  Wrench,
  Cpu,
  Inbox,
  Database,
  CalendarCog,
  ClipboardList,
  Activity,
  AlertTriangle,
  FlaskConical,
  BrainCircuit,
  Clock,
} from "lucide-react";
import { NAV_SECTIONS } from "../../utils/constants";
import { Link } from "../../hooks/useRoute";

const ICONS = {
  LayoutDashboard,
  Map,
  Train,
  Grid3x3,
  Wrench,
  Cpu,
  Inbox,
  Database,
  CalendarCog,
  ClipboardList,
  Activity,
  AlertTriangle,
  FlaskConical,
  BrainCircuit,
  Clock,
};

export default function Sidebar({ currentPath, collapsed }) {
  const active = currentPath.split("?")[0].replace(/\/$/, "") || "/dashboard";

  return (
    <aside className={`sidebar${collapsed ? " sidebar--collapsed" : ""}`}>
      <nav className="sidebar__nav">
        {NAV_SECTIONS.map((section, si) => (
          <div key={section.label} className="sidebar__section">
            {si > 0 && <div className="sidebar__divider" />}
            <div className="sidebar__section-label">{section.label}</div>
            {section.items.map((item) => {
              const Icon = ICONS[item.icon];
              const isActive = active === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`nav-item${isActive ? " is-active" : ""}`}
                  title={collapsed ? item.label : undefined}
                >
                  {Icon && <Icon size={18} className="nav-item__icon" />}
                  <span className="nav-item__label">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}