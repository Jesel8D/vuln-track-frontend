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
