import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CveQueryStatus } from "../../src/features/v2/CveQueryStatus";
import { isCveReliability } from "../../src/services/cveReliabilityContract";
import type { CveReliability } from "../../src/types/cveReliability";

const saved: CveReliability = {
  assessment: {
    execution: "completed",
    coverage: "partial",
    freshness: "stale",
    correspondence: "historical",
    requires_new_query: true,
    expires_at: "2026-11-21T00:00:00Z",
    freshness_policy_seconds: 86400,
  },
  provenance: {
    cve_source: "fixture",
    contract: "v2-cve-5a-1",
    identification_id: "11111111-1111-4111-8111-111111111111",
    cpe_mode: "live",
    cpe_source: "nvd-feed",
    observed_version: "1.0",
    requested_at: "2026-11-20T00:00:00Z",
    response_received_at: "2026-11-20T00:00:00Z",
    source_timestamp: "2026-11-20T00:00:00Z",
  },
};
describe("procedencia y vigencia CVE independientes", () => {
  it("mantiene CPE oficial separado de respuesta fixture y muestra cuatro dimensiones", () => {
    render(<CveQueryStatus value={saved} />);
    expect(screen.getByText(/fixture de demostración/)).toBeInTheDocument();
    expect(screen.getByText(/nvd-feed/)).toBeInTheDocument();
    expect(screen.getByText(/Desactualizada/)).toHaveTextContent("histórica");
    expect(screen.getByText(/Ejecución:/)).toHaveTextContent("Completada");
    expect(screen.getByText(/Ejecución:/)).toHaveTextContent("Parcial");
    expect(
      screen.getByText(/Revise la identificación actual/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/NVD live/)).not.toBeInTheDocument();
  });
  it("presenta historia sin metadatos como no registrada", () => {
    render(<CveQueryStatus value={{}} />);
    expect(screen.getByText("Fuente CVE: No registrada.")).toBeInTheDocument();
    expect(screen.getByText(/no demuestra ausencia/)).toBeInTheDocument();
  });
  it.each(["simulated", "live", "unknown"] as const)(
    "distingue fuente %s",
    (source) => {
      render(
        <CveQueryStatus
          value={{
            ...saved,
            provenance: { ...saved.provenance!, cve_source: source },
          }}
        />,
      );
      expect(
        screen.getByText(
          `Fuente CVE: ${source === "simulated" ? "Transporte simulado" : source === "live" ? "NVD live" : "No registrada"}.`,
        ),
      ).toBeInTheDocument();
    },
  );
  it("admite fallo con vigencia desconocida sin convertirlo en cero", () => {
    const v = structuredClone(saved);
    v.assessment = {
      ...v.assessment!,
      execution: "failed",
      coverage: "unknown",
      freshness: "unknown",
      expires_at: null,
    };
    v.provenance!.response_received_at = null;
    expect(isCveReliability(v)).toBe(true);
    render(<CveQueryStatus value={v} />);
    expect(screen.getByText(/Ejecución:/)).toHaveTextContent("Fallida");
  });
  it("valida el contrato nuevo y mantiene lectura de respuestas anteriores", () => {
    expect(isCveReliability(saved)).toBe(true);
    expect(isCveReliability({})).toBe(true);
  });
  it.each([
    { assessment: { ...saved.assessment, execution: "safe" } },
    { assessment: { ...saved.assessment, requires_new_query: false } },
    { assessment: { ...saved.assessment, freshness_policy_seconds: -1 } },
    {
      assessment: { ...saved.assessment, freshness: "fresh", expires_at: null },
    },
    { provenance: { ...saved.provenance, cve_source: "nvd" } },
    { provenance: { ...saved.provenance, identification_id: "foreign-text" } },
    { provenance: { ...saved.provenance, response_received_at: "ayer" } },
  ])("rechaza metadatos incompatibles %#", (patch) => {
    expect(isCveReliability({ ...saved, ...patch })).toBe(false);
  });
  it("distingue resultado reciente de identidad histórica", () => {
    const v = {
      ...saved,
      assessment: { ...saved.assessment!, freshness: "fresh" as const },
    };
    expect(isCveReliability(v)).toBe(true);
    render(<CveQueryStatus value={v} />);
    expect(screen.getByText(/Vigencia:/)).toHaveTextContent(
      "Vigente según la política local",
    );
    expect(screen.getByText(/Vigencia:/)).toHaveTextContent("histórica");
  });
});
