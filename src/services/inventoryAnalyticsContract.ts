import { inventoryEventKeys } from "../types/inventoryAnalytics";
import type {
  InventoryDistribution,
  InventoryEvents,
} from "../types/inventoryAnalytics";

const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const count = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const bounded = (v: unknown, max: number): v is string =>
  typeof v === "string" && v.length > 0 && Array.from(v).length <= max;
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const stamp = (v: unknown) =>
  typeof v === "string" && Number.isFinite(Date.parse(v));
const day = (v: unknown): v is string =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  stamp(v) &&
  new Date(v).toISOString().slice(0, 10) === v;
const identity = (v: Record<string, unknown>) =>
  typeof v.workspace_id === "string" &&
  uuid.test(v.workspace_id) &&
  ["devices", "technologies"].includes(String(v.inventory_kind));

export function isInventoryDistribution(
  v: unknown,
): v is InventoryDistribution {
  if (
    !record(v) ||
    !identity(v) ||
    v.scope !== "active" ||
    v.normalization !== "case_whitespace_v1" ||
    !["vendor", "product"].includes(String(v.dimension)) ||
    !count(v.limit) ||
    v.limit < 1 ||
    v.limit > 10 ||
    !count(v.total) ||
    !count(v.excluded_inactive) ||
    !count(v.other) ||
    !count(v.unknown) ||
    !stamp(v.observed_at) ||
    !Array.isArray(v.categories) ||
    v.categories.length > v.limit
  )
    return false;
  let sum = v.other + v.unknown;
  const keys = new Set<string>();
  for (const row of v.categories) {
    if (
      !record(row) ||
      !bounded(row.vendor_key, 200) ||
      !bounded(row.label, 512) ||
      !count(row.count) ||
      row.count === 0 ||
      (v.dimension === "vendor"
        ? row.product_key !== null
        : !bounded(row.product_key, 200))
    )
      return false;
    const key = JSON.stringify([row.vendor_key, row.product_key]);
    if (keys.has(key)) return false;
    keys.add(key);
    sum += row.count;
  }
  return sum === v.total;
}

export function isInventoryEvents(v: unknown): v is InventoryEvents {
  if (
    !record(v) ||
    !identity(v) ||
    v.scope !== "recorded_history" ||
    !record(v.window) ||
    ![30, 90].includes(Number(v.window.days)) ||
    typeof v.window.days !== "number" ||
    v.window.timezone !== "UTC" ||
    !day(v.window.start) ||
    !day(v.window.end_exclusive) ||
    !stamp(v.window.observed_at) ||
    !record(v.totals) ||
    !record(v.confirmation_modes) ||
    !count(v.selections_without_confirmation_events) ||
    v.version_history_available !== (v.inventory_kind === "devices") ||
    !Array.isArray(v.daily) ||
    v.daily.length !== v.window.days
  )
    return false;
  const sums = Object.fromEntries(inventoryEventKeys.map((k) => [k, 0]));
  for (let index = 0; index < v.daily.length; index++) {
    const row = v.daily[index];
    if (
      !record(row) ||
      !day(row.date) ||
      !record(row.counts) ||
      Date.parse(row.date) !== Date.parse(v.window.start) + index * 86400000
    )
      return false;
    for (const key of inventoryEventKeys) {
      if (!count(row.counts[key])) return false;
      sums[key] += row.counts[key];
    }
  }
  if (
    Date.parse(v.window.end_exclusive) !==
    Date.parse(v.window.start) + v.daily.length * 86400000
  )
    return false;
  for (const key of inventoryEventKeys)
    if (!count(v.totals[key]) || v.totals[key] !== sums[key]) return false;
  const modes = v.confirmation_modes;
  if (!count(modes.live) || !count(modes.fixture) || !count(modes.unknown))
    return false;
  if (
    modes.live + modes.fixture + modes.unknown !==
    sums.first_confirmations +
      sums.subsequent_confirmations +
      sums.technology_confirmations
  )
    return false;
  return v.inventory_kind === "devices"
    ? sums.technology_confirmations === 0
    : sums.first_confirmations +
        sums.subsequent_confirmations +
        sums.version_changes +
        sums.identity_changes_without_version ===
        0;
}
