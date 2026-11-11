import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/context";
import type { Workspace } from "../../types/v2";

interface WorkspaceValue {
  workspaces: Workspace[];
  current: Workspace | null;
  selectedId: string | null;
  select: (id: string) => void;
  isPending: boolean;
  error: Error | null;
  refresh: () => void;
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { api, user } = useAuth();
  const query = useQuery({
    queryKey: ["v2", user?.id, "workspaces"],
    queryFn: ({ signal }) => api.workspaces(signal),
    enabled: Boolean(user),
    staleTime: 30_000,
  });
  const workspaces = query.data?.items ?? [];
  const [preferredId, setPreferredId] = useState<string | null>(null);
  const current =
    workspaces.find((item) => item.workspace_id === preferredId) ??
    workspaces[0] ??
    null;
  const selectedId = current?.workspace_id ?? null;

  const value: WorkspaceValue = {
    workspaces,
    current,
    selectedId,
    select: setPreferredId,
    isPending: query.isPending,
    error: query.error,
    refresh: () => void query.refetch(),
  };
  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("WorkspaceProvider requerido");
  return value;
}
