import type { CveReliability } from "../types/cveReliability";

const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const timestamp = (v: unknown) =>
  v === null ||
  (typeof v === "string" && v.length <= 40 && Number.isFinite(Date.parse(v)));
const text = (v: unknown, max: number) =>
  v === null || (typeof v === "string" && v.length > 0 && v.length <= max);
export function isCveReliability(v: unknown): v is CveReliability {
  if (!object(v)) return false;
  if (v.assessment === undefined && v.provenance === undefined)
    return v.storage === undefined;
  const a = v.assessment;
  const p = v.provenance;
  if (!object(a) || !object(p)) return false;
  const s = v.storage;
  if (s !== undefined) {
    if (
      !object(s) ||
      Object.keys(s).sort().join(",") !==
        "expires_at,obtained_at,refresh_attempted,resolution,used_at" ||
      typeof s.refresh_attempted !== "boolean" ||
      !["provider", "reused", "failed"].includes(String(s.resolution)) ||
      !timestamp(s.used_at) ||
      !timestamp(s.obtained_at) ||
      !timestamp(s.expires_at)
    )
      return false;
    if (s.resolution === "failed") {
      if (
        a.execution !== "failed" ||
        s.used_at !== null ||
        s.obtained_at !== null ||
        s.expires_at !== null
      )
        return false;
    } else {
      if (
        a.execution !== "completed" ||
        typeof s.used_at !== "string" ||
        typeof s.obtained_at !== "string" ||
        typeof s.expires_at !== "string" ||
        typeof p.response_received_at !== "string" ||
        Date.parse(s.obtained_at) !== Date.parse(p.response_received_at) ||
        Date.parse(s.used_at) < Date.parse(s.obtained_at) ||
        Date.parse(s.expires_at) <= Date.parse(s.obtained_at) ||
        (s.resolution === "reused" &&
          (s.refresh_attempted ||
            a.coverage !== "complete" ||
            Date.parse(s.used_at) >= Date.parse(s.expires_at)))
      )
        return false;
    }
  }
  return (
    ["queued", "running", "completed", "failed"].includes(
      String(a.execution),
    ) &&
    (v.status === undefined || a.execution === v.status) &&
    ["complete", "partial", "unknown"].includes(String(a.coverage)) &&
    (v.coverage === undefined || a.coverage === (v.coverage ?? "unknown")) &&
    ["fresh", "stale", "unknown"].includes(String(a.freshness)) &&
    ["current", "historical", "unknown"].includes(String(a.correspondence)) &&
    typeof a.requires_new_query === "boolean" &&
    timestamp(a.expires_at) &&
    Number.isSafeInteger(a.freshness_policy_seconds) &&
    Number(a.freshness_policy_seconds) >= (v.storage === undefined ? 60 : 1) &&
    Number(a.freshness_policy_seconds) <= 604800 &&
    ["fixture", "simulated", "live", "unknown"].includes(
      String(p.cve_source),
    ) &&
    text(p.contract, 80) &&
    (p.identification_id === null ||
      (typeof p.identification_id === "string" &&
        /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(
          p.identification_id,
        ))) &&
    [null, "fixture", "live", "unknown"].includes(
      p.cpe_mode as null | string,
    ) &&
    text(p.cpe_source, 80) &&
    text(p.observed_version, 120) &&
    timestamp(p.requested_at) &&
    timestamp(p.response_received_at) &&
    timestamp(p.source_timestamp) &&
    (a.freshness === "unknown" ||
      (p.response_received_at !== null && a.expires_at !== null)) &&
    a.requires_new_query ===
      !(
        a.execution === "completed" &&
        a.coverage === "complete" &&
        a.freshness === "fresh" &&
        a.correspondence === "current"
      )
  );
}
