import { Component } from "react";
import type { ReactNode } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router";
import { useAuth } from "../features/auth/context";
import { AppLayout } from "../layouts/AppLayout";
import { LoginPage } from "../pages/LoginPage";
import { DashboardPage } from "../pages/DashboardPage";
import { AssetsPage } from "../pages/AssetsPage";
import { RegisterAssetPage } from "../pages/RegisterAssetPage";
import { AssetDetailPage } from "../pages/AssetDetailPage";
import { IdentificationPage } from "../pages/IdentificationPage";
import { HistoryPage } from "../pages/HistoryPage";
import { AccountPage } from "../pages/AccountPage";
import { NotFoundPage } from "../pages/NotFoundPage";
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
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="activos" element={<AssetsPage />} />
          <Route path="activos/nuevo" element={<RegisterAssetPage />} />
          <Route path="activos/:assetId" element={<AssetDetailPage />} />
          <Route
            path="activos/:assetId/identificacion"
            element={<IdentificationPage />}
          />
          <Route path="activos/:assetId/historial" element={<HistoryPage />} />
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
