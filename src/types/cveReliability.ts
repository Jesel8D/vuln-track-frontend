export interface CveReliability {
  storage?: {
    resolution: "provider" | "reused" | "failed";
    refresh_attempted: boolean;
    used_at: string | null;
    obtained_at: string | null;
    expires_at: string | null;
  };
  assessment?: {
    execution: "queued" | "running" | "completed" | "failed";
    coverage: "complete" | "partial" | "unknown";
    freshness: "fresh" | "stale" | "unknown";
    correspondence: "current" | "historical" | "unknown";
    requires_new_query: boolean;
    expires_at: string | null;
    freshness_policy_seconds: number;
  };
  provenance?: {
    cve_source: "fixture" | "simulated" | "live" | "unknown";
    contract: string | null;
    identification_id: string | null;
    cpe_mode: "fixture" | "live" | "unknown" | null;
    cpe_source: string | null;
    observed_version: string | null;
    requested_at: string | null;
    response_received_at: string | null;
    source_timestamp: string | null;
  };
}
