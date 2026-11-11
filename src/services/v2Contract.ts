import type {
  Application,
  ApplicationList,
  CpeCandidate,
  CpeCandidateList,
  TechnologyList,
  WorkspaceCreated,
  WorkspaceList,
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
