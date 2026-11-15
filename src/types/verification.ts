export interface VerificationChallenge {
  id: string;
  workspace_id: string;
  application_id: string;
  target_id: string;
  method: "https_file";
  origin: string;
  state: "pending" | "verified" | "failed" | "expired" | "revoked";
  effective_state: "pending" | "failed" | "expired" | "revoked" | "unavailable";
  scope_invalidated: boolean;
  version: number;
  attempts: number;
  created_at: string;
  expires_at: string;
  consumed_at: string | null;
  verified_at: null;
  revoked_at: string | null;
  result_code: string;
  control_verified: false;
  remote_verification_available: false;
  execution_enabled: false;
  blocking_reasons: string[];
  evidence: Array<{
    id: string;
    provenance: "laboratory";
    started_at: string;
    completed_at: string | null;
    outcome:
      | "in_progress"
      | "laboratory_match"
      | "proof_mismatch"
      | "transport_failed"
      | "expired"
      | "revoked";
  }>;
}

export interface VerificationList {
  items: VerificationChallenge[];
  remote_verification_available: false;
  execution_enabled: false;
  blocking_reasons: string[];
}

export interface VerificationIssue {
  challenge: VerificationChallenge;
  created: boolean;
  instructions: { url: string; body: string } | null;
}
