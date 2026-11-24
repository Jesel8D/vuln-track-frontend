export type InventoryKind = "devices" | "technologies";
export type InventoryDimension = "vendor" | "product";
export interface InventoryCategory {
  vendor_key: string;
  product_key: string | null;
  label: string;
  count: number;
}
export interface InventoryDistribution {
  workspace_id: string;
  inventory_kind: InventoryKind;
  dimension: InventoryDimension;
  scope: "active";
  normalization: "case_whitespace_v1";
  limit: number;
  total: number;
  excluded_inactive: number;
  unknown: number;
  other: number;
  categories: InventoryCategory[];
  observed_at: string;
}
export const inventoryEventKeys = [
  "first_confirmations",
  "subsequent_confirmations",
  "technology_confirmations",
  "version_changes",
  "identity_changes_without_version",
] as const;
export type InventoryEventKey = (typeof inventoryEventKeys)[number];
export type InventoryEventCounts = Record<InventoryEventKey, number>;
export interface InventoryEvents {
  workspace_id: string;
  inventory_kind: InventoryKind;
  scope: "recorded_history";
  window: {
    days: 30 | 90;
    start: string;
    end_exclusive: string;
    timezone: "UTC";
    observed_at: string;
  };
  totals: InventoryEventCounts;
  confirmation_modes: { live: number; fixture: number; unknown: number };
  daily: { date: string; counts: InventoryEventCounts }[];
  selections_without_confirmation_events: number;
  version_history_available: boolean;
}
