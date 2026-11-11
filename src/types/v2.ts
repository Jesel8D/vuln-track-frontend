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

export type RecommendationStatus =
  "pending" | "in_progress" | "fixed" | "accepted_risk";

export interface Recommendation {
  id: string;
  finding_id: string;
  recommendation: string;
  source_url: string | null;
  status: RecommendationStatus;
  assigned_to: string | null;
  created_by: string;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecommendationList {
  items: Recommendation[];
}

export interface ApplicationTarget {
  id: string;
  url: string;
  label: string | null;
  authorization_status: "pending" | "approved" | "rejected" | "expired";
  authorization_expires_at: string | null;
  authorization_reference: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicationTargetList {
  items: ApplicationTarget[];
}

export interface WorkspaceTarget extends ApplicationTarget {
  application_id: string;
  application_name: string;
  application_status: "active" | "archived";
}

export interface WorkspaceTargetList {
  items: WorkspaceTarget[];
  page: { limit: number; offset: number; total: number };
}

export interface V2Dashboard {
  summary: {
    applications_total: number;
    targets_total: number;
    authorized_targets_total: number;
    technologies_total: number;
    confirmed_cpe_total: number;
    analyses_total: number;
    analyses_in_progress: number;
    analyses_failed: number;
    findings_total: number;
    findings_open: number;
    critical_open: number;
    high_open: number;
    medium_open: number;
    low_open: number;
    severity_unknown: number;
    technologies_with_completed_analysis: number;
  };
  recent_analyses: Array<{
    id: string;
    application_id: string;
    application_name: string;
    technology_id: string;
    product: string;
    version: string;
    status: V2AnalysisStatus;
    coverage: V2Coverage;
    stored_count: number;
    warning_codes: string[];
    created_at: string;
    completed_at: string | null;
    finding_count: number;
  }>;
  priority_findings: Array<{
    id: string;
    external_id: string;
    title: string | null;
    severity: NvdFinding["severity"];
    applicability: NvdApplicability;
    status: "open";
    observed_at: string;
    application_id: string;
    application_name: string;
    product: string;
    version: string;
  }>;
  analysis_trend: Array<{ month: string; analyses: number }>;
}

export interface NvdFindingList {
  items: NvdFinding[];
  page: { limit: number; offset: number; total: number };
  run_status: V2AnalysisStatus;
  coverage: V2Coverage;
}
