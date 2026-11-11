export interface Workspace {
  workspace_id: string;
  name: string;
  role: "owner" | "editor" | "viewer";
  created_at: string;
}

export interface WorkspaceCreated {
  id: string;
  name: string;
}

export interface WorkspaceList {
  items: Workspace[];
}

export interface Application {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
}

export interface ApplicationInput {
  name: string;
  description: string | null;
}

export interface ApplicationList {
  items: Application[];
}

export interface Technology {
  id: string;
  product: string;
  vendor: string | null;
  version: string;
  selected_cpe: string | null;
  detection_method: "manual" | "http_fingerprint" | "manifest_import";
  confidence: "unconfirmed" | "user_confirmed" | "high" | "medium" | "low";
  observed_at: string;
}

export interface TechnologyList {
  items: Technology[];
}

export interface TechnologyInput {
  product: string;
  vendor: string | null;
  version: string;
  detection_method: "manual" | "http_fingerprint" | "manifest_import";
}

export interface CpeCandidate {
  cpe_name_id: string;
  cpe_name: string;
  title: string | null;
  deprecated: boolean;
}

export interface CpeCandidateList {
  items: CpeCandidate[];
  page: { limit: number; offset: number; total: number };
  source_timestamp: string;
}

export type V2AnalysisStatus = "queued" | "running" | "completed" | "failed";
export type V2Coverage = "complete" | "partial" | null;

export interface AnalysisAccepted {
  id: string;
  status?: V2AnalysisStatus;
  coverage?: V2Coverage;
  total_results?: number | null;
  stored_count?: number;
}

export interface AnalysisRun extends AnalysisAccepted {
  status: V2AnalysisStatus;
  coverage: V2Coverage;
  total_results: number | null;
  retrieved_count: number;
  stored_count: number;
  page_count: number;
  warning_codes: string[];
  failure_code: string | null;
  source_timestamp: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface AnalysisHistoryItem extends AnalysisRun {
  technology_id: string;
  product: string;
  version: string;
}

export interface AnalysisHistory {
  items: AnalysisHistoryItem[];
  page: { limit: number; offset: number; total: number };
}

export interface NvdFinding {
  id: string;
  external_id: string;
  title: string | null;
  severity: "critical" | "high" | "medium" | "low" | "none" | "unknown" | null;
  cvss: Record<string, unknown> | null;
  applicability: "potential" | "undetermined" | "not_applicable";
  status: "open" | "reviewed" | "resolved" | "accepted_risk";
  evidence: Record<string, unknown>;
  published_at: string;
  last_modified_at: string;
  observed_at: string;
  updated_at: string;
}

export type NvdApplicability = "potential" | "undetermined" | "not_applicable";

export interface NvdFindingList {
  items: NvdFinding[];
  page: { limit: number; offset: number; total: number };
  run_status: V2AnalysisStatus;
  coverage: V2Coverage;
}
