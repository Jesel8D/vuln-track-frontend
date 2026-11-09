import type { AssetInput } from "../types/api";
export function normalize(value: string) {
  return value.normalize("NFC").trim();
}
export function textError(
  value: string,
  limit: number,
  required = true,
): string | null {
  const normalized = normalize(value);
  if (!normalized) return required ? "Este campo es obligatorio." : null;
  if (/[\p{Cc}\p{Cs}]/u.test(normalized))
    return "No se permiten caracteres de control.";
  if ([...normalized].length > limit)
    return `Usa como máximo ${limit} caracteres.`;
  return null;
}
export type AssetDraft = Record<keyof AssetInput, string>;
export const emptyAsset: AssetDraft = {
  device_type: "router",
  manufacturer: "",
  model: "",
  version: "",
  site_label: "",
  inventory_label: "",
  notes: "",
};
export function validateAsset(draft: AssetDraft, unknown: boolean) {
  const errors: Partial<Record<keyof AssetInput, string>> = {};
  const limits = {
    device_type: 80,
    manufacturer: 120,
    model: 120,
    site_label: 120,
    inventory_label: 120,
    notes: 1000,
    version: 120,
  };
  for (const field of Object.keys(limits) as (keyof AssetInput)[]) {
    if (field === "version" && unknown) continue;
    const error = textError(
      draft[field],
      limits[field],
      !["version", "inventory_label", "notes"].includes(field),
    );
    if (error) errors[field] = error;
  }
  if (
    !unknown &&
    ["unknown", "*", "-"].includes(normalize(draft.version).toLowerCase())
  )
    errors.version = "Deja la versión vacía o elige «No la conozco».";
  const body: AssetInput = {
    ...draft,
    device_type: normalize(draft.device_type),
    manufacturer: normalize(draft.manufacturer),
    model: normalize(draft.model),
    site_label: normalize(draft.site_label),
    version: unknown ? null : normalize(draft.version) || null,
    inventory_label: normalize(draft.inventory_label) || null,
    notes: normalize(draft.notes) || null,
  };
  return { errors, body };
}
export function cpeParts(name: string) {
  // Presentation only. Backend owns syntax/provenance validation.
  const parts: string[] = [];
  let part = "";
  let escaped = false;
  for (const char of name) {
    if (escaped) {
      part += char;
      escaped = false;
    } else if (char === "\\") escaped = true;
    else if (char === ":") {
      parts.push(part);
      part = "";
    } else part += char;
  }
  parts.push(part);
  return {
    part: parts[2] ?? "—",
    vendor: parts[3] ?? "—",
    product: parts[4] ?? "—",
    version: parts[5] ?? "—",
    update: parts[6] ?? "—",
    targetSw: parts[10] ?? "—",
    targetHw: parts[11] ?? "—",
  };
}

export function safeReturnPath(from: unknown): string {
  return typeof from === "string" &&
    from.startsWith("/") &&
    !from.startsWith("//") &&
    !from.includes("\\") &&
    !/[\p{Cc}\p{Cs}]/u.test(from) &&
    from.split(/[?#]/)[0] !== "/login"
    ? from
    : "/";
}
