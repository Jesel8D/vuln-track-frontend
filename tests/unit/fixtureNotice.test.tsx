import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FixtureNotice } from "../../src/features/v2/FixtureNotice";

afterEach(() => vi.unstubAllEnvs());

describe("Aviso de procedencia NVD", () => {
  it("identifica capturas como fixture", () => {
    vi.stubEnv("VITE_NVD_MODE", "fixture");
    render(<FixtureNotice />);
    expect(
      screen.getByRole("note", { name: "Datos de demostración" }),
    ).toHaveTextContent("NVD de fixture");
  });

  it.each(["live", "", "disabled"])(
    "no anuncia integración activa con configuración %s",
    (mode) => {
      vi.stubEnv("VITE_NVD_MODE", mode);
      render(<FixtureNotice />);
      const notice = screen.getByRole("note", { name: "Fuente NVD" });
      expect(notice).toHaveTextContent("Consultas CVE externas aplazadas");
      expect(notice).toHaveTextContent(
        "Los resultados previos conservan su procedencia",
      );
    },
  );
});
