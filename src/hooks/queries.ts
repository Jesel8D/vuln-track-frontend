import { useQueries, useQuery } from "@tanstack/react-query";
import { useAuth } from "../features/auth/context";
import type { Asset } from "../types/api";
export function useAssets(limit = 10, offset = 0) {
  const { api, user } = useAuth();
  return useQuery({
    queryKey: ["assets", user?.id, limit, offset],
    queryFn: ({ signal }) => api.assets(limit, offset, signal),
    enabled: !!user,
  });
}
export function useAsset(id: string) {
  const { api, user } = useAuth();
  return useQuery({
    queryKey: ["asset", user?.id, id],
    queryFn: ({ signal }) => api.asset(id, signal),
    enabled: !!user,
  });
}
export function useIdentification(
  id: string,
  scope: "current" | "history" = "current",
  offset = 0,
) {
  const { api, user } = useAuth();
  return useQuery({
    queryKey: ["identification", user?.id, id, scope, offset],
    queryFn: ({ signal }) => api.identifications(id, scope, offset, signal),
    enabled: !!user,
  });
}
export function useAssetStates(assets: Asset[]) {
  const { api, user } = useAuth();
  return useQueries({
    queries: assets.map((asset) => ({
      queryKey: ["identification", user?.id, asset.id, "current", 0],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        api.identifications(asset.id, "current", 0, signal),
      enabled: !!user,
    })),
  });
}
