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
