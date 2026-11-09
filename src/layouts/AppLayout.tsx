import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavLink, Outlet, useLocation } from "react-router";
import {
  ArrowUpRight,
  ChevronDown,
  LayoutDashboard,
  Layers3,
  LogOut,
  Menu,
  Plus,
  UserRound,
  X,
} from "lucide-react";
import { useAuth } from "../features/auth/context";
import { Brand, Button } from "../components/ui";
const links = [
  { to: "/", label: "Resumen", icon: LayoutDashboard },
  { to: "/activos", label: "Mis activos", icon: Layers3 },
  { to: "/activos/nuevo", label: "Registrar activo", icon: Plus },
];
export function AppLayout() {
  const { user, api, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const health = useQuery({
    queryKey: ["health"],
    queryFn: ({ signal }) => api.health(signal),
    refetchInterval: 60000,
  });
  useEffect(() => {
    document.getElementById("main-content")?.focus();
    window.scrollTo({ top: 0 });
  }, [location.pathname]);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Saltar al contenido
      </a>
      <aside className="sidebar">
        <NavLink to="/" aria-label="VulnTrack, resumen">
          <Brand />
        </NavLink>
        <p className="nav-label">ESPACIO PERSONAL</p>
        <nav aria-label="Navegación principal">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                `nav-link ${isActive ? "active" : ""}`
              }
            >
              <Icon size={18} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="scope-note">
            <span className="scope-mark" />
            <strong>Una identidad. Con trazabilidad.</strong>
            <p>Del inventario al CPE oficial, con tu confirmación.</p>
            <span className="mono small">MVP–A / NVD</span>
          </div>
          <NavLink to="/cuenta" className="nav-link">
            <UserRound size={18} aria-hidden="true" />
            Mi cuenta
          </NavLink>
          <button className="sidebar-user" onClick={logout}>
            <span className="avatar">
              {user?.username.slice(0, 2).toUpperCase()}
            </span>
            <span>
              <strong>{user?.username}</strong>
              <small>Cerrar sesión</small>
            </span>
            <LogOut size={16} aria-hidden="true" />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="mobile-brand">
            <Brand compact />
            <strong>VulnTrack</strong>
          </div>
          <div className="breadcrumb">
            <span>INVENTARIO TECNOLÓGICO</span>
            <span className="breadcrumb-slash">/</span>
            <span>
              {location.pathname === "/"
                ? "Resumen"
                : location.pathname.startsWith("/cuenta")
                  ? "Mi cuenta"
                  : "Mis activos"}
            </span>
          </div>
          <div className="topbar-right">
            <span
              className={`connection ${health.data?.status === "ok" ? "online" : ""}`}
            >
              <i />
              {health.isPending
                ? "Conectando"
                : health.data?.status === "ok"
                  ? "API disponible"
                  : "Sin conexión"}
            </span>
            <NavLink to="/cuenta" className="user-link">
              <span className="avatar small-avatar">
                {user?.username.slice(0, 2).toUpperCase()}
              </span>
              <span>{user?.username}</span>
              <ChevronDown size={14} aria-hidden="true" />
            </NavLink>
            <Button
              variant="ghost"
              className="mobile-menu-button"
              aria-expanded={open}
              aria-controls="mobile-navigation"
              aria-label={open ? "Cerrar navegación" : "Abrir navegación"}
              onClick={() => setOpen(!open)}
            >
              {open ? <X size={22} /> : <Menu size={22} />}
            </Button>
          </div>
        </header>
        {open && (
          <nav
            id="mobile-navigation"
            className="mobile-navigation"
            aria-label="Navegación móvil"
          >
            {[
              ...links,
              { to: "/cuenta", label: "Mi cuenta", icon: UserRound },
            ].map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} end onClick={() => setOpen(false)}>
                <Icon size={18} aria-hidden="true" />
                {label}
              </NavLink>
            ))}
            <button onClick={logout}>
              <LogOut size={18} aria-hidden="true" />
              Cerrar sesión
            </button>
          </nav>
        )}
        <main id="main-content" tabIndex={-1} className="main-content">
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>
            VulnTrack <span className="muted">/</span> Inventario con identidad
            verificable
          </span>
          <span>
            Identificación asistida{" "}
            <ArrowUpRight size={12} aria-hidden="true" />
          </span>
        </footer>
      </div>
    </div>
  );
}
