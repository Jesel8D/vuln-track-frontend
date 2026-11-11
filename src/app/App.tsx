import { Component } from "react";
import type { ReactNode } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router";
import { useAuth } from "../features/auth/context";
import { LoginPage } from "../pages/LoginPage";
import { AccountPage } from "../pages/AccountPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { V2Layout } from "../layouts/V2Layout";
import { V2DashboardPage } from "../pages/V2DashboardPage";
import { V2ApplicationsPage } from "../pages/V2ApplicationsPage";
function Protected() {
  const { user } = useAuth();
  const location = useLocation();
  return user ? (
    <Outlet />
  ) : (
    <Navigate
      to="/login"
      replace
      state={{ from: location.pathname + location.search }}
    />
  );
}
export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Protected />}>
        <Route element={<V2Layout />}>
          <Route index element={<V2DashboardPage />} />
          <Route path="aplicaciones" element={<V2ApplicationsPage />} />
          <Route path="cuenta" element={<AccountPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
export class AppErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    /* Never log errors with potentially sensitive request/session state. */
  }
  render() {
    return this.state.failed ? (
      <main className="fatal-error">
        <h1>No pudimos abrir esta vista.</h1>
        <p>Recarga la aplicación para iniciar una sesión nueva.</p>
        <a href="/login" className="button primary">
          Volver al inicio
        </a>
      </main>
    ) : (
      this.props.children
    );
  }
}
