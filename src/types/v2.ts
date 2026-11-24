import type { CveReliability } from "./cveReliability";
export interface Workspace {
  workspace_id: string;
  name: string;
  role: "owner" | "editor" | "viewer";
  created_at: string;
}

export interface CoverageCounts {
  total: number;
  confirmed: number;
  pending: number;
  needs_review: number;
  excluded_inactive: number;
}

export interface InventoryCoverage {
  workspace_id: string;
  scope: "active";
  devices: CoverageCounts & {
    without_version: number;
    confirmed_by_mode: { live: number; fixture: number; unknown: number };
  };
  technologies: CoverageCounts & {
    confirmation_provenance: "not_recorded" | "per_confirmation";
  };
}

export interface WorkspaceCreated {
  id: string;
  name: string;
}

export interface WorkspaceList {
  items: Workspace[];
}

export interface TargetSummary {
  total: number;
  approved: number;
  items: Array<{
    id: string;
    url: string;
    label: string | null;
    authorization_status: "pending" | "approved" | "rejected" | "expired";
  }>;
}

export interface Application {
  target_summary?: TargetSummary;
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
  page?: { total: number; limit: number; offset: number };
}

export interface CpeConfirmation {
  id: string;
  cpe_name_id: string;
  cpe_name: string;
  mode: "live" | "fixture";
  source: "nvd-api" | "nvd-feed" | "nvd-captured-fixture";
  observed_vendor: string | null;
  observed_product: string;
  observed_version: string;
  confirmed_at: string;
  reason: string | null;
  evidence: string | null;
  is_current?: boolean;
  catalog_evidence?: {
    record?: {
      vendor: string;
      product: string;
      version: string;
      nvd_modified: string;
    };
    feed?: { source_modified: string; digest: string; status: string } | null;
  };
}
export interface CpeConfirmationList {
  items: CpeConfirmation[];
  page: { total: number; limit: number; offset: number };
  current_confirmation_id: string | null;
  legacy_provenance: "not_recorded" | null;
}

export interface Technology {
  current_cve_query_state?:
    "recorded" | "not_queried" | "unknown" | "identification_required";
  id: string;
  product: string;
  vendor: string | null;
  version: string;
  selected_cpe: string | null;
  detection_method: "manual" | "http_fingerprint" | "manifest_import";
  confidence: "unconfirmed" | "user_confirmed" | "high" | "medium" | "low";
  observed_at: string;
  cpe_confirmation?: CpeConfirmation | null;
}

export interface TechnologyList {
  items: Technology[];
  page?: { total: number; limit: number; offset: number };
  summary?: { confirmed_cpe: number };
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

export interface ApplicationCpeScope {
  part: "a" | "o" | "h";
  mode: "live" | "fixture";
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

export interface AnalysisRun extends AnalysisAccepted, CveReliability {
  nvd_mode?: "fixture" | "live" | "unknown";
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

export interface HistoricalAnalysis extends CveReliability {
  id: string;
  application_id: string;
  technology_id: string | null;
  selected_cpe: string;
  created_at: string;
  nvd_mode: "fixture" | "live" | "unknown";
  evaluated_technology: {
    vendor: string;
    product: string;
    version: string;
    basis: "historical_cpe";
  } | null;
}

export interface AnalysisHistoryItem extends AnalysisRun {
  selected_cpe?: string;
  evaluated_technology?: HistoricalAnalysis["evaluated_technology"];
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
  page?: { limit: number; offset: number; total: number };
}

export interface TargetReadiness {
  policy_version: "web-public-v1";
  authorization_state:
    | "registered"
    | "requested"
    | "verification_pending"
    | "verified"
    | "rejected"
    | "revoked"
    | "expired"
    | "incomplete";
  control_verified: boolean;
  url_policy_allowed: boolean;
  execution_enabled: false;
  blocking_reasons: string[];
}

export interface ApplicationTarget {
  id: string;
  url: string;
  label: string | null;
  authorization_status: "pending" | "approved" | "rejected" | "expired";
  authorization_expires_at: string | null;
  authorization_reference: string | null;
  analysis_readiness: TargetReadiness;
  created_at: string;
  updated_at: string;
}

export interface ApplicationTargetList {
  items: ApplicationTarget[];
  page?: { limit: number; offset: number; total: number };
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
  recent_analyses: Array<
    CveReliability & {
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
    }
  >;
  priority_findings: Array<{
    analysis?: CveReliability;
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
  analysis?: HistoricalAnalysis;
  items: NvdFinding[];
  page: { limit: number; offset: number; total: number };
  run_status: V2AnalysisStatus;
  coverage: V2Coverage;
}
