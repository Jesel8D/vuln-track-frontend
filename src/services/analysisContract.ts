// Narrow unknown JSON, especially states: a successful HTTP response is not completion.
import type {
  AcceptedAnalysis,
  AnalysisRun,
  AnalysisList,
  Finding,
  FindingList,
  Page,
} from "../types/api";
export function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
const uuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(v);
const str = (v: unknown): v is string => typeof v === "string";
const nullable = (v: unknown, check: (x: unknown) => boolean) =>
  v === null || check(v);
const time = (v: unknown): v is string =>
  str(v) && /T/.test(v) && Number.isFinite(Date.parse(v));
const count = (v: unknown): v is number =>
  Number.isSafeInteger(v) && Number(v) >= 0;
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(str);
export const analysisStatus = (v: unknown) =>
  typeof v === "string" &&
  ["queued", "running", "completed", "failed"].includes(v);
export const coverage = (v: unknown) =>
  v === null || v === "complete" || v === "partial";
const applicability = (v: unknown) =>
  v === "potential" || v === "undetermined" || v === "not_applicable";
export function isRun(v: unknown): v is AnalysisRun {
  if (!object(v)) return false;
  return (
    uuid(v.id) &&
    uuid(v.asset_id) &&
    nullable(v.identification_id, uuid) &&
    uuid(v.initiated_by) &&
    str(v.selected_cpe) &&
    nullable(v.observed_version, str) &&
    analysisStatus(v.status) &&
    coverage(v.coverage) &&
    time(v.created_at) &&
    [
      v.started_at,
      v.completed_at,
      v.source_timestamp,
      v.nvd_cooldown_until,
    ].every((t) => nullable(t, time)) &&
    nullable(v.total_results, count) &&
    [
      v.retrieved_count,
      v.stored_count,
      v.page_count,
      v.next_index,
      v.retry_count,
    ].every(count) &&
    object(v.query_parameters) &&
    strings(v.warning_codes) &&
    strings(v.source_timestamps) &&
    Array.isArray(v.page_manifest) &&
    v.page_manifest.every(object) &&
    nullable(v.failure_code, str) &&
    (v.status === "completed"
      ? v.coverage !== null && v.completed_at !== null
      : v.coverage === null)
  );
}
export function isFinding(v: unknown): v is Finding {
  return (
    object(v) &&
    uuid(v.id) &&
    uuid(v.analysis_id) &&
    str(v.external_id) &&
    /^CVE-[0-9]{4}-[0-9]{4,}$/.test(v.external_id) &&
    v.source === "NVD" &&
    nullable(v.title, str) &&
    applicability(v.applicability) &&
    (v.status === "open" || v.status === "reviewed") &&
    nullable(v.cvss, object) &&
    nullable(v.evidence, object) &&
    [v.observed_at, v.created_at, v.updated_at].every(time) &&
    nullable(v.reviewed_by, uuid) &&
    nullable(v.reviewed_at, time) &&
    nullable(v.review_reason, str) &&
    nullable(v.review_evidence, str)
  );
}
function isPage(v: unknown): v is Page {
  return (
    object(v) &&
    count(v.total) &&
    count(v.offset) &&
    count(v.limit) &&
    v.limit > 0 &&
    v.limit <= 100
  );
}
export function isAccepted(v: unknown): v is AcceptedAnalysis {
  return object(v) && uuid(v.id) && time(v.accepted_at);
}
export function isAnalysisList(v: unknown): v is AnalysisList {
  return (
    object(v) &&
    isPage(v.page) &&
    Array.isArray(v.items) &&
    v.items.every(isRun) &&
    v.items.length <= v.page.limit
  );
}
export function isFindingList(v: unknown): v is FindingList {
  return (
    object(v) &&
    isPage(v.page) &&
    Array.isArray(v.items) &&
    v.items.every(isFinding) &&
    v.items.length <= v.page.limit &&
    analysisStatus(v.run_status) &&
    coverage(v.coverage)
  );
}
