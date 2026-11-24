import { useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "../auth/context";
import { useWorkspace } from "./WorkspaceContext";

export function workspaceLanding(pathname: string) {
  if (pathname.startsWith("/dispositivos")) return "/dispositivos";
  if (pathname.startsWith("/aplicaciones")) return "/aplicaciones";
  if (pathname.startsWith("/historial")) return "/historial";
  return pathname === "/cuenta" ? "/cuenta" : "/";
}

/** Unmount all resource observers and local forms at the workspace boundary.
 * Requests already accepted by the server can finish in their original scope;
 * their callbacks cannot become observers of the newly mounted workspace.
 */
export function WorkspaceOutlet() {
  const { user } = useAuth();
  const { selectedId, current } = useWorkspace();
  const { pathname } = useLocation();
  const [routeScope, setRouteScope] = useState(selectedId);
  const landing = workspaceLanding(pathname);
  // Also cover an implicit fallback after membership/directory refresh. Do not
  // mount a detail page with a previous workspace's URL, even for one render.
  if (routeScope !== null && routeScope !== selectedId && pathname !== landing)
    return <Navigate to={landing} replace />;
  if (routeScope !== selectedId) setRouteScope(selectedId);
  return (
    <Outlet key={`${user?.id}/${selectedId}/${current?.role}/${pathname}`} />
  );
}
