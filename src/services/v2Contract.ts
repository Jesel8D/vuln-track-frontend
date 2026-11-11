import type {
  Application,
  ApplicationTargetList,
  ApplicationList,
  AnalysisAccepted,
  AnalysisHistory,
  AnalysisRun,
  CpeCandidate,
  CpeCandidateList,
  NvdFinding,
  NvdFindingList,
  RecommendationList,
  TechnologyList,
  WorkspaceCreated,
  WorkspaceList,
  WorkspaceTargetList,
  V2Dashboard,
  V2AnalysisStatus,
  V2Coverage,
} from "../types/v2";

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));
const bounded = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= max;
const timestamp = (value: unknown): value is string =>
  bounded(value, 64) && Number.isFinite(Date.parse(value));

function isApplication(value: unknown): value is Application {
  return (
    record(value) &&
    typeof value.id === "string" &&
    uuid.test(value.id) &&
    bounded(value.name, 160) &&
    (value.description === null || typeof value.description === "string") &&
    (value.status === "active" || value.status === "archived") &&
    timestamp(value.created_at) &&
    timestamp(value.updated_at)
  );
}

export function isWorkspaceList(value: unknown): value is WorkspaceList {
  return (
    record(value) &&
    Array.isArray(value.items) &&
    value.items.length <= 1000 &&
    value.items.every(
      (workspace) =>
        record(workspace) &&
        typeof workspace.workspace_id === "string" &&
        uuid.test(workspace.workspace_id) &&
        bounded(workspace.name, 120) &&
        (workspace.role === "owner" ||
          workspace.role === "editor" ||
          workspace.role === "viewer") &&
        timestamp(workspace.created_at),
    )
  );
}

export function isWorkspaceCreated(value: unknown): value is WorkspaceCreated {
  return (
    record(value) &&
    typeof value.id === "string" &&
    uuid.test(value.id) &&
    bounded(value.name, 120)
  );
}

export function isApplicationList(value: unknown): value is ApplicationList {
  return (
    record(value) &&
    Array.isArray(value.items) &&
    value.items.length <= 100 &&
    value.items.every(isApplication)
  );
}

export function isApplicationTargetList(
  value: unknown,
): value is ApplicationTargetList {
  return (
    record(value) &&
    Array.isArray(value.items) &&
    value.items.length <= 100 &&
    value.items.every(
      (item) =>
        record(item) &&
        typeof item.id === "string" &&
        uuid.test(item.id) &&
        bounded(item.url, 2048) &&
        (item.label === null || bounded(item.label, 120)) &&
        ["pending", "approved", "rejected", "expired"].includes(
          String(item.authorization_status),
        ) &&
        (item.authorization_expires_at === null ||
          timestamp(item.authorization_expires_at)) &&
        (item.authorization_reference === null ||
          bounded(item.authorization_reference, 500)) &&
        timestamp(item.created_at) &&
        timestamp(item.updated_at),
    )
  );
}

export function isWorkspaceTargetList(
  value: unknown,
): value is WorkspaceTargetList {
  return (
    record(value) &&
    Array.isArray(value.items) &&
    value.items.length <= 1000 &&
    value.items.every(
      (item) =>
        record(item) &&
        typeof item.id === "string" &&
        uuid.test(item.id) &&
        typeof item.application_id === "string" &&
        uuid.test(item.application_id) &&
        bounded(item.application_name, 160) &&
        ["active", "archived"].includes(String(item.application_status)) &&
        bounded(item.url, 2048) &&
        (item.label === null || bounded(item.label, 120)) &&
        ["pending", "approved", "rejected", "expired"].includes(
          String(item.authorization_status),
        ) &&
        (item.authorization_expires_at === null ||
          timestamp(item.authorization_expires_at)) &&
        (item.authorization_reference === null ||
          bounded(item.authorization_reference, 500)) &&
        timestamp(item.created_at) &&
        timestamp(item.updated_at),
    ) &&
    record(value.page) &&
    nonnegativeInteger(value.page.limit) &&
    nonnegativeInteger(value.page.offset) &&
    nonnegativeInteger(value.page.total)
  );
}

export function isV2Dashboard(value: unknown): value is V2Dashboard {
  const countFields = [
    "applications_total",
    "targets_total",
    "authorized_targets_total",
    "technologies_total",
    "confirmed_cpe_total",
    "analyses_total",
    "analyses_in_progress",
    "analyses_failed",
    "findings_total",
    "findings_open",
    "critical_open",
    "high_open",
    "medium_open",
    "low_open",
    "severity_unknown",
    "technologies_with_completed_analysis",
  ];
  const validSummary = (summary: unknown) =>
    record(summary) &&
    countFields.every((field) => nonnegativeInteger(summary[field]));
  return (
    record(value) &&
    validSummary(value.summary) &&
    Array.isArray(value.recent_analyses) &&
    value.recent_analyses.length <= 5 &&
    value.recent_analyses.every(
      (item) =>
        record(item) &&
        typeof item.id === "string" &&
        uuid.test(item.id) &&
        typeof item.application_id === "string" &&
        uuid.test(item.application_id) &&
        bounded(item.application_name, 160) &&
        typeof item.technology_id === "string" &&
        uuid.test(item.technology_id) &&
        bounded(item.product, 160) &&
        bounded(item.version, 120) &&
        isAnalysisStatus(item.status) &&
        isCoverage(item.coverage) &&
        nonnegativeInteger(item.stored_count) &&
        nonnegativeInteger(item.finding_count) &&
        Array.isArray(item.warning_codes) &&
        item.warning_codes.length <= 20 &&
        item.warning_codes.every(
          (warning) =>
            typeof warning === "string" && /^[A-Z0-9_]{1,80}$/.test(warning),
        ) &&
        timestamp(item.created_at) &&
        (item.completed_at === null || timestamp(item.completed_at)),
    ) &&
    Array.isArray(value.priority_findings) &&
    value.priority_findings.length <= 5 &&
    value.priority_findings.every(
      (item) =>
        record(item) &&
        typeof item.id === "string" &&
        uuid.test(item.id) &&
        typeof item.external_id === "string" &&
        /^CVE-[0-9]{4}-[0-9]{4,}$/.test(item.external_id) &&
        (item.title === null ||
          (typeof item.title === "string" && item.title.length <= 500)) &&
        (
          [
            "critical",
            "high",
            "medium",
            "low",
            "none",
            "unknown",
            null,
          ] as unknown[]
        ).includes(item.severity) &&
        ["potential", "undetermined", "not_applicable"].includes(
          String(item.applicability),
        ) &&
        item.status === "open" &&
        timestamp(item.observed_at) &&
        typeof item.application_id === "string" &&
        uuid.test(item.application_id) &&
        bounded(item.application_name, 160) &&
        bounded(item.product, 160) &&
        bounded(item.version, 120),
    ) &&
    Array.isArray(value.analysis_trend) &&
    value.analysis_trend.length === 6 &&
    value.analysis_trend.every(
      (item) =>
        record(item) &&
        timestamp(item.month) &&
        nonnegativeInteger(item.analyses),
    )
  );
}

export function isTechnologyList(value: unknown): value is TechnologyList {
  return (
    record(value) &&
    Array.isArray(value.items) &&
    value.items.length <= 100 &&
    value.items.every(
      (technology) =>
        record(technology) &&
        typeof technology.id === "string" &&
        uuid.test(technology.id) &&
        bounded(technology.product, 160) &&
        (technology.vendor === null || bounded(technology.vendor, 160)) &&
        bounded(technology.version, 120) &&
        (technology.selected_cpe === null ||
          bounded(technology.selected_cpe, 1024)) &&
        ["manual", "http_fingerprint", "manifest_import"].includes(
          String(technology.detection_method),
        ) &&
        ["unconfirmed", "user_confirmed", "high", "medium", "low"].includes(
          String(technology.confidence),
        ) &&
        timestamp(technology.observed_at),
    )
  );
}

export function isCpeCandidate(value: unknown): value is CpeCandidate {
  return (
    record(value) &&
    typeof value.cpe_name_id === "string" &&
    uuid.test(value.cpe_name_id) &&
    bounded(value.cpe_name, 1024) &&
    (value.title === null || typeof value.title === "string") &&
    typeof value.deprecated === "boolean"
  );
}

export function isCpeCandidateList(value: unknown): value is CpeCandidateList {
  return (
    record(value) &&
    Array.isArray(value.items) &&
    value.items.length <= 20 &&
    value.items.every(isCpeCandidate) &&
    record(value.page) &&
    typeof value.page.limit === "number" &&
    Number.isInteger(value.page.limit) &&
    typeof value.page.offset === "number" &&
    Number.isInteger(value.page.offset) &&
    typeof value.page.total === "number" &&
    Number.isInteger(value.page.total) &&
    timestamp(value.source_timestamp)
  );
}

function isAnalysisStatus(value: unknown): value is V2AnalysisStatus {
  return ["queued", "running", "completed", "failed"].includes(String(value));
}

function isCoverage(value: unknown): value is V2Coverage {
  return value === null || value === "complete" || value === "partial";
}

const nonnegativeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

export function isAnalysisAccepted(value: unknown): value is AnalysisAccepted {
  return (
    record(value) &&
    typeof value.id === "string" &&
    uuid.test(value.id) &&
    (value.status === undefined || isAnalysisStatus(value.status)) &&
    (value.coverage === undefined || isCoverage(value.coverage)) &&
    (value.total_results === undefined ||
      value.total_results === null ||
      nonnegativeInteger(value.total_results)) &&
    (value.stored_count === undefined || nonnegativeInteger(value.stored_count))
  );
}

export function isAnalysisRun(value: unknown): value is AnalysisRun {
  return (
    record(value) &&
    typeof value.id === "string" &&
    uuid.test(value.id) &&
    isAnalysisStatus(value.status) &&
    isCoverage(value.coverage) &&
    (value.total_results === null || nonnegativeInteger(value.total_results)) &&
    nonnegativeInteger(value.retrieved_count) &&
    nonnegativeInteger(value.stored_count) &&
    nonnegativeInteger(value.page_count) &&
    Array.isArray(value.warning_codes) &&
    value.warning_codes.length <= 100 &&
    value.warning_codes.every(
      (warning) =>
        typeof warning === "string" && /^[A-Z0-9_]{1,80}$/.test(warning),
    ) &&
    (value.failure_code === null || bounded(value.failure_code, 80)) &&
    (value.source_timestamp === null || timestamp(value.source_timestamp)) &&
    timestamp(value.created_at) &&
    (value.started_at === null || timestamp(value.started_at)) &&
    (value.completed_at === null || timestamp(value.completed_at))
  );
}

export function isAnalysisHistory(value: unknown): value is AnalysisHistory {
  return (
    record(value) &&
    Array.isArray(value.items) &&
    value.items.length <= 100 &&
    value.items.every(
      (item) =>
        record(item) &&
        typeof item.technology_id === "string" &&
        uuid.test(item.technology_id) &&
        bounded(item.product, 160) &&
        bounded(item.version, 120) &&
        isAnalysisRun(item),
    ) &&
    record(value.page) &&
    nonnegativeInteger(value.page.limit) &&
    nonnegativeInteger(value.page.offset) &&
    nonnegativeInteger(value.page.total)
  );
}

export function isNvdFinding(value: unknown): value is NvdFinding {
  return (
    record(value) &&
    typeof value.id === "string" &&
    uuid.test(value.id) &&
    typeof value.external_id === "string" &&
    /^CVE-[0-9]{4}-[0-9]{4,}$/.test(value.external_id) &&
    (value.title === null ||
      (typeof value.title === "string" && value.title.length <= 500)) &&
    (
      [
        "critical",
        "high",
        "medium",
        "low",
        "none",
        "unknown",
        null,
      ] as unknown[]
    ).includes(value.severity) &&
    (value.cvss === null || record(value.cvss)) &&
    ["potential", "undetermined", "not_applicable"].includes(
      String(value.applicability),
    ) &&
    ["open", "reviewed", "resolved", "accepted_risk"].includes(
      String(value.status),
    ) &&
    record(value.evidence) &&
    timestamp(value.published_at) &&
    timestamp(value.last_modified_at) &&
    timestamp(value.observed_at) &&
    timestamp(value.updated_at)
  );
}

export function isNvdFindingList(value: unknown): value is NvdFindingList {
  return (
    record(value) &&
    Array.isArray(value.items) &&
    value.items.length <= 100 &&
    value.items.every(isNvdFinding) &&
    record(value.page) &&
    nonnegativeInteger(value.page.limit) &&
    nonnegativeInteger(value.page.offset) &&
    nonnegativeInteger(value.page.total) &&
    isAnalysisStatus(value.run_status) &&
    isCoverage(value.coverage)
  );
}

const recommendationStatuses = [
  "pending",
  "in_progress",
  "fixed",
  "accepted_risk",
];

export function isRecommendationList(
  value: unknown,
): value is RecommendationList {
  return (
    record(value) &&
    Array.isArray(value.items) &&
    value.items.length <= 100 &&
    value.items.every(
      (item) =>
        record(item) &&
        typeof item.id === "string" &&
        uuid.test(item.id) &&
        typeof item.finding_id === "string" &&
        uuid.test(item.finding_id) &&
        bounded(item.recommendation, 4000) &&
        (item.source_url === null || bounded(item.source_url, 2048)) &&
        recommendationStatuses.includes(String(item.status)) &&
        (item.assigned_to === null ||
          (typeof item.assigned_to === "string" &&
            uuid.test(item.assigned_to))) &&
        typeof item.created_by === "string" &&
        uuid.test(item.created_by) &&
        (item.due_at === null || timestamp(item.due_at)) &&
        (item.completed_at === null || timestamp(item.completed_at)) &&
        timestamp(item.created_at) &&
        timestamp(item.updated_at),
    )
  );
}
