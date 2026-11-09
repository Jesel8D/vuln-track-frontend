import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../features/auth/context";
import type { AnalysisRun } from "../types/api";
export const activeRun = (run?: AnalysisRun) =>
  run?.status === "queued" || run?.status === "running";
export function useAnalyses(assetId: string, limit = 20, offset = 0) {
  const { api, user } = useAuth();
  return useQuery({
    queryKey: ["analyses", user?.id, assetId, limit, offset],
    queryFn: ({ signal }) => api.analyses(assetId, limit, offset, signal),
    enabled: !!user,
  });
}
export function useAnalysis(assetId: string, runId: string) {
  const { api, user } = useAuth();
  const [openedAt] = useState(() => Date.now());
  return useQuery({
    queryKey: ["analysis", user?.id, assetId, runId],
    queryFn: ({ signal }) => api.analysis(assetId, runId, signal),
    enabled: !!user && !!runId,
    retry: false,
    refetchOnWindowFocus: false,
    refetchIntervalInBackground: false,
    refetchInterval: (q) =>
      !q.state.error &&
      activeRun(q.state.data) &&
      Date.now() - openedAt < 15 * 60_000
        ? 4000
        : false,
    refetchOnReconnect: (q) => activeRun(q.state.data),
  });
}
export function useFindings(assetId: string, runId: string, offset = 0) {
  const { api, user } = useAuth();
  return useQuery({
    queryKey: ["findings", user?.id, assetId, runId, offset],
    queryFn: ({ signal }) => api.findings(assetId, runId, offset, signal),
    enabled: !!user && !!runId,
  });
}
export function useFinding(id: string) {
  const { api, user } = useAuth();
  return useQuery({
    queryKey: ["finding", user?.id, id],
    queryFn: ({ signal }) => api.finding(id, signal),
    enabled: !!user && !!id,
  });
}
