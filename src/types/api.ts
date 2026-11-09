export interface User {
  id: string;
  username: string;
}
export interface Token {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
}
export interface Page {
  limit: number;
  offset: number;
  total: number;
}
export interface AssetInput {
  device_type: string;
  manufacturer: string;
  model: string;
  version: string | null;
  site_label: string;
  inventory_label: string | null;
  notes: string | null;
}
export interface Asset extends AssetInput {
  id: string;
  created_at: string;
}
export interface AssetList {
  items: Asset[];
  page: Page;
}
export type IdentificationState = "pending" | "confirmed" | "needs_review";
export type ComponentKind = "hardware" | "firmware" | "os" | "software";
export interface Candidate {
  cpe_name_id: string;
  cpe_name: string;
  title: string | null;
  deprecated: boolean;
}
export interface CandidateList {
  items: Candidate[];
  page: Page;
  source_timestamp: string;
}
export type IdentificationInput =
  | {
      state: "confirmed";
      cpe_name_id: string;
      component_kind: ComponentKind;
      expected_current_id: string | null;
      reason: string;
    }
  | {
      state: "needs_review";
      expected_current_id: string | null;
      reason: string;
    };
export interface Identification {
  id: string;
  asset_id: string;
  state: Exclude<IdentificationState, "pending">;
  cpe_name_id: string;
  cpe_name: string;
  component_kind: ComponentKind;
  observed_version: string | null;
  source: "NVD";
  validated_at: string;
  recorded_by: string;
  recorded_at: string;
  reason: string;
  replaces_id: string | null;
}
export interface HistoryEvent extends Identification {
  valid_to: string | null;
  is_current: boolean;
}
export interface IdentificationList {
  current_state: IdentificationState;
  items: HistoryEvent[];
  page: Page;
}

// Backend app/schemas/analyses.py; validated at the HTTP boundary.
export type AnalysisStatus = "queued" | "running" | "completed" | "failed";
export type AnalysisCoverage = "complete" | "partial" | null;
export interface AnalysisProgress {
  total_results: number | null;
  retrieved_count: number;
  stored_count: number;
  page_count: number;
  next_index: number;
  retry_count: number;
}
export interface AnalysisRun extends AnalysisProgress {
  id: string;
  asset_id: string;
  identification_id: string | null;
  initiated_by: string;
  selected_cpe: string;
  observed_version: string | null;
  status: AnalysisStatus;
  coverage: AnalysisCoverage;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  source_timestamp: string | null;
  query_parameters: Record<string, unknown>;
  warning_codes: string[];
  source_timestamps: string[];
  page_manifest: Record<string, unknown>[];
  failure_code: string | null;
  nvd_cooldown_until: string | null;
}
export interface AnalysisInput {
  identification_id: string;
}
export interface AcceptedAnalysis {
  id: string;
  accepted_at: string;
}
export interface AnalysisList {
  items: AnalysisRun[];
  page: Page;
}
export type FindingApplicability =
  "potential" | "undetermined" | "not_applicable";
export interface FindingReview {
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_reason: string | null;
  review_evidence: string | null;
}
export interface Finding extends FindingReview {
  id: string;
  analysis_id: string;
  external_id: string;
  source: "NVD";
  title: string | null;
  applicability: FindingApplicability;
  status: "open" | "reviewed";
  cvss: Record<string, unknown> | null;
  evidence: Record<string, unknown> | null;
  observed_at: string;
  created_at: string;
  updated_at: string;
}
export interface FindingList {
  items: Finding[];
  page: Page;
  run_status: AnalysisStatus;
  coverage: AnalysisCoverage;
}
export interface ReviewInput {
  status: "reviewed";
  applicability: FindingApplicability;
  expected_updated_at: string;
  reason: string;
  evidence: string;
}
