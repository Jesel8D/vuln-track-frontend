import type {
  VerificationChallenge,
  VerificationIssue,
  VerificationList,
} from "../types/verification";

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const record = (v: unknown): v is Record<string, unknown> =>
  Boolean(v && typeof v === "object" && !Array.isArray(v));
const date = (v: unknown): v is string =>
  typeof v === "string" &&
  v.length <= 64 &&
  /(?:Z|[+-]\d{2}:\d{2})$/.test(v) &&
  Number.isFinite(Date.parse(v));
const optionalDate = (v: unknown) => v === null || date(v);
const identity = (v: unknown): v is string =>
  typeof v === "string" && uuid.test(v);
function blockers(v: unknown) {
  return (
    Array.isArray(v) &&
    v.length >= 3 &&
    v.length <= 12 &&
    v.every((x) => typeof x === "string" && /^[A-Z_]{1,80}$/.test(x)) &&
    [
      "PUBLIC_EGRESS_UNPROVEN",
      "OPERATIONAL_DNS_UNAVAILABLE",
      "WEB_EXECUTOR_DISABLED",
    ].every((x) => v.includes(x))
  );
}
function origin(v: unknown) {
  if (typeof v !== "string" || v.length > 300) return false;
  try {
    const url = new URL(v);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      url.origin === v
    );
  } catch {
    return false;
  }
}

export function isVerificationChallenge(
  v: unknown,
): v is VerificationChallenge {
  return (
    record(v) &&
    [v.id, v.workspace_id, v.application_id, v.target_id].every(identity) &&
    v.method === "https_file" &&
    origin(v.origin) &&
    ["pending", "verified", "failed", "expired", "revoked"].includes(
      String(v.state),
    ) &&
    ["pending", "failed", "expired", "revoked", "unavailable"].includes(
      String(v.effective_state),
    ) &&
    typeof v.scope_invalidated === "boolean" &&
    Number.isInteger(v.version) &&
    Number(v.version) > 0 &&
    [0, 1].includes(Number(v.attempts)) &&
    typeof v.attempts === "number" &&
    date(v.created_at) &&
    date(v.expires_at) &&
    optionalDate(v.consumed_at) &&
    v.verified_at === null &&
    optionalDate(v.revoked_at) &&
    typeof v.result_code === "string" &&
    /^[A-Z_]{1,80}$/.test(v.result_code) &&
    v.control_verified === false &&
    v.remote_verification_available === false &&
    v.execution_enabled === false &&
    blockers(v.blocking_reasons) &&
    Array.isArray(v.evidence) &&
    v.evidence.length <= 1 &&
    (v.evidence.length === 0 || v.attempts === 1) &&
    v.evidence.every(
      (e) =>
        record(e) &&
        identity(e.id) &&
        e.provenance === "laboratory" &&
        date(e.started_at) &&
        optionalDate(e.completed_at) &&
        [
          "in_progress",
          "laboratory_match",
          "proof_mismatch",
          "transport_failed",
          "expired",
          "revoked",
        ].includes(String(e.outcome)),
    ) &&
    !("proof_sha256" in v) &&
    !("token" in v)
  );
}

export function isVerificationList(v: unknown): v is VerificationList {
  return (
    record(v) &&
    Array.isArray(v.items) &&
    v.items.length <= 20 &&
    v.items.every(isVerificationChallenge) &&
    v.remote_verification_available === false &&
    v.execution_enabled === false &&
    blockers(v.blocking_reasons)
  );
}

export function isVerificationIssue(v: unknown): v is VerificationIssue {
  if (
    !record(v) ||
    !isVerificationChallenge(v.challenge) ||
    typeof v.created !== "boolean"
  )
    return false;
  if (!v.created) return v.instructions === null;
  return (
    record(v.instructions) &&
    v.instructions.url ===
      `${v.challenge.origin}/.well-known/vulntrack-verification/${v.challenge.id}` &&
    typeof v.instructions.body === "string" &&
    new RegExp(
      `^vulntrack-domain-control-https-v1:${v.challenge.id}:[A-Za-z0-9_-]{43}$`,
    ).test(v.instructions.body)
  );
}

export function verificationScope(
  v: VerificationChallenge,
  workspace: string,
  application: string,
  target: string,
) {
  return (
    v.workspace_id === workspace &&
    v.application_id === application &&
    v.target_id === target
  );
}
