import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CveQueryStatus } from "../../src/features/v2/CveQueryStatus";
import { isCveReliability } from "../../src/services/cveReliabilityContract";
import type { CveReliability } from "../../src/types/cveReliability";
const saved: CveReliability = {
  assessment: {
    execution: "completed",
    coverage: "complete",
    freshness: "stale",
    correspondence: "current",
    requires_new_query: true,
    expires_at: "2026-11-22T00:00:00Z",
    freshness_policy_seconds: 86400,
  },
  provenance: {
    cve_source: "fixture",
    contract: "v2-cve-5a-1",
    identification_id: null,
    cpe_mode: "fixture",
    cpe_source: "nvd-captured-fixture",
    observed_version: "1",
    requested_at: "2026-11-21T12:00:00Z",
    response_received_at: "2026-11-21T00:00:00Z",
    source_timestamp: "2026-10-10T00:00:00Z",
  },
  storage: {
    resolution: "reused",
    refresh_attempted: false,
    used_at: "2026-11-21T12:00:00Z",
    obtained_at: "2026-11-21T00:00:00Z",
    expires_at: "2026-11-22T00:00:00Z",
  },
};
describe("almacenamiento CVE", () => {
  it("explica reutilización y conserva fechas distintas sin afirmar una nueva llamada", () => {
    expect(isCveReliability(saved)).toBe(true);
    render(<CveQueryStatus value={saved} />);
    expect(screen.getByText(/Datos reutilizados/)).toHaveTextContent(
      "no hubo una nueva llamada",
    );
    expect(screen.getByText(/Obtención original:/)).toHaveTextContent(
      "Uso de los datos",
    );
    expect(screen.getByText(/Vigencia:/)).toHaveTextContent("Desactualizada");
  });
  it("identifica el proveedor de demostración", () => {
    const v = structuredClone(saved);
    v.storage!.resolution = "provider";
    render(<CveQueryStatus value={v} />);
    expect(
      screen.getByText(/Datos obtenidos del proveedor de demostración/),
    ).toBeInTheDocument();
  });
  it("explica el fallo de actualización sin inventar fechas ni cero resultados", () => {
    const v = structuredClone(saved);
    v.assessment = {
      ...v.assessment!,
      execution: "failed",
      coverage: "unknown",
      freshness: "unknown",
      expires_at: null,
    };
    v.provenance!.response_received_at = null;
    v.storage = {
      resolution: "failed",
      refresh_attempted: true,
      obtained_at: null,
      used_at: null,
      expires_at: null,
    };
    expect(isCveReliability(v)).toBe(true);
    render(<CveQueryStatus value={v} />);
    expect(
      screen.getByText(/No se pudo completar la actualización/),
    ).toHaveTextContent("historial");
    expect(screen.queryByText(/Obtención original:/)).not.toBeInTheDocument();
  });
  it.each([
    { resolution: "live" },
    { cache_key: "hidden" },
    { obtained_at: "2026-11-21T01:00:00Z" },
    { used_at: "2026-11-22T00:00:00Z" },
    { expires_at: null },
    { refresh_attempted: true },
    { resolution: "failed" },
    { used_at: "2026-11-20T00:00:00Z" },
  ])("rechaza metadatos incoherentes %#", (patch) => {
    expect(
      isCveReliability({ ...saved, storage: { ...saved.storage, ...patch } }),
    ).toBe(false);
  });
  it("rechaza almacenamiento sin el contrato de procedencia", () => {
    expect(isCveReliability({ storage: saved.storage })).toBe(false);
  });
  it("admite TTL corto controlado exclusivamente con evidencia almacenada", () => {
    expect(
      isCveReliability({
        ...saved,
        assessment: { ...saved.assessment, freshness_policy_seconds: 1 },
      }),
    ).toBe(true);
    expect(
      isCveReliability({
        ...saved,
        storage: undefined,
        assessment: { ...saved.assessment, freshness_policy_seconds: 1 },
      }),
    ).toBe(false);
  });
});
