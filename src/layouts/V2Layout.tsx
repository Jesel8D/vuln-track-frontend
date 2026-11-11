import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import {
  Boxes,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  ScanLine,
  X,
} from "lucide-react";
import { Brand } from "../components/ui";
import { useAuth } from "../features/auth/context";
import {
  WorkspaceProvider,
  useWorkspace,
} from "../features/v2/WorkspaceContext";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/aplicaciones", label: "Aplicaciones", icon: Boxes, end: false },
  {
    to: "/analisis",
    label: "Análisis de seguridad",
    icon: ScanLine,
    end: false,
  },
  { to: "/historial", label: "Historial", icon: History, end: false },
];

function LayoutContent() {
  const { user, logout } = useAuth();
  const { workspaces, selectedId, select, isPending, error } = useWorkspace();
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const section = navItems.find((item) =>
    item.end ? pathname === item.to : pathname.startsWith(item.to),
  );

  const navigation = (
    <nav className="v2-nav" aria-label="Navegación principal">
      {navItems.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `v2-nav-link${isActive ? " active" : ""}`
          }
          onClick={() => setMenuOpen(false)}
        >
          <Icon size={18} aria-hidden="true" />
          {label}
        </NavLink>
      ))}
      <span
        className="v2-nav-link v2-nav-disabled"
        aria-disabled="true"
        title="Seguimiento de hallazgos pendiente de integración"
      >
        Seguimiento <small>Pendiente</small>
      </span>
    </nav>
  );

  return (
    <div className="v2-shell">
      <a className="v2-skip-link" href="#main-content">
        Saltar al contenido
      </a>
      <aside className="v2-sidebar">
        <NavLink to="/" className="v2-brand" aria-label="VulnTrack, Dashboard">
          <Brand />
        </NavLink>
        <div className="v2-workspace-label">WORKSPACE</div>
        {isPending ? (
          <p className="v2-sidebar-message">Cargando espacios…</p>
        ) : error ? (
          <p className="v2-sidebar-message">
            No se pudieron cargar los espacios.
          </p>
        ) : workspaces.length ? (
          <label className="v2-workspace-picker">
            <span>Espacio activo</span>
            <select
              aria-label="Workspace activo"
              value={selectedId ?? ""}
              onChange={(event) => select(event.target.value)}
            >
              {workspaces.map((workspace) => (
                <option
                  key={workspace.workspace_id}
                  value={workspace.workspace_id}
                >
                  {workspace.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="v2-sidebar-message">Crea un workspace para comenzar.</p>
        )}
        <div className="v2-workspace-label">NAVEGACIÓN OPERATIVA</div>
        {navigation}
        <div className="v2-sidebar-bottom">
          <div className="v2-scope-note">
            <span className="v2-status-dot" />
            <strong>Consultas NVD bajo demanda</strong>
            <p>La coincidencia requiere revisar y confirmar el CPE.</p>
          </div>
          <div className="v2-user-row">
            <div className="v2-avatar">
              {user?.username.slice(0, 2).toUpperCase()}
            </div>
            <div className="v2-user-copy">
              <strong>{user?.username}</strong>
              <small>Sesión activa</small>
            </div>
            <button
              className="v2-logout"
              onClick={logout}
              aria-label="Cerrar sesión"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="v2-main-column">
        <header className="v2-topbar">
          <div className="v2-breadcrumb">
            <span>VULNTRACK</span>
            <span>/</span>
            <strong>{section?.label ?? "VulnTrack"}</strong>
          </div>
          <div className="v2-topbar-actions">
            <span className="v2-api-indicator">
              <i /> Sesión autenticada
            </span>
            {workspaces.length > 1 && (
              <label className="v2-top-workspace">
                <span>Workspace</span>
                <select
                  aria-label="Workspace activo"
                  value={selectedId ?? ""}
                  onChange={(event) => select(event.target.value)}
                >
                  {workspaces.map((workspace) => (
                    <option
                      key={workspace.workspace_id}
                      value={workspace.workspace_id}
                    >
                      {workspace.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              className="v2-mobile-menu"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span className="v2-top-user">{user?.username}</span>
          </div>
        </header>
        {menuOpen && <div className="v2-mobile-nav">{navigation}</div>}
        <main id="main-content" tabIndex={-1} className="v2-main-content">
          <Outlet />
        </main>
        <footer className="v2-footer">
          <span>VulnTrack · Gestión de seguridad de aplicaciones web</span>
          <span>NVD 2.0 · Revisión humana</span>
        </footer>
      </div>
    </div>
  );
}

export function V2Layout() {
  return (
    <WorkspaceProvider>
      <LayoutContent />
    </WorkspaceProvider>
  );
}
