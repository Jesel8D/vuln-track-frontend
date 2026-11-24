import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import {
  CpeProvenance,
  ConfirmationDetails,
} from "../../src/features/v2/CpeProvenance";
import {
  isCpeConfirmation,
  isCpeConfirmationList,
  isApplicationList,
  isTechnologyList,
} from "../../src/services/v2Contract";
import type { CpeConfirmation, Technology } from "../../src/types/v2";
const id = "10000000-0000-4000-8000-000000000001";
const row: CpeConfirmation = {
  id,
  cpe_name_id: id,
  cpe_name: "cpe:2.3:a:apache:http_server:2.4.49:*:*:*:*:*:*:*",
  mode: "live",
  source: "nvd-feed",
  observed_vendor: "Apache",
  observed_product: "HTTP Server",
  observed_version: "2.4.49",
  confirmed_at: "2026-01-01T00:00:00Z",
  reason: "Versión comprobada",
  evidence: "Manifiesto local",
};
const technology: Technology = {
  id,
  product: row.observed_product,
  vendor: row.observed_vendor,
  version: row.observed_version,
  selected_cpe: row.cpe_name,
  detection_method: "manual",
  confidence: "user_confirmed",
  observed_at: row.confirmed_at,
};
it("does not infer legacy provenance from the string or a non-current confirmation", () => {
  const { rerender } = render(
    <CpeProvenance
      workspaceId={id}
      applicationId={id}
      technology={technology}
    />,
  );
  expect(screen.getByText(/no se infiere/i)).toBeVisible();
  rerender(
    <CpeProvenance
      workspaceId={id}
      applicationId={id}
      technology={{
        ...technology,
        cpe_confirmation: { ...row, observed_version: "2.4.51" },
      }}
    />,
  );
  expect(screen.queryByText(/Catálogo oficial NVD/)).not.toBeInTheDocument();
});
it.each(["live", "fixture"] as const)(
  "presents captured fields explicitly for %s",
  (mode) => {
    render(
      <ConfirmationDetails
        row={{
          ...row,
          mode,
          source: mode === "live" ? "nvd-feed" : "nvd-captured-fixture",
        }}
      />,
    );
    expect(
      screen.getByText(
        mode === "live" ? /Catálogo oficial NVD/ : /Fixture de demostración/,
      ),
    ).toBeVisible();
    expect(screen.getByText(id)).toBeVisible();
    expect(screen.getByText(row.reason!)).toBeVisible();
    expect(screen.getByText(row.evidence!)).toBeVisible();
  },
);
it("rejects mixed sources, invalid history and inconsistent page totals", () => {
  expect(isCpeConfirmation(row)).toBe(true);
  expect(isCpeConfirmation({ ...row, mode: "fixture" })).toBe(false);
  const history = {
    items: [{ ...row, is_current: true }],
    page: { limit: 20, offset: 0, total: 1 },
    current_confirmation_id: id,
    legacy_provenance: null,
  };
  expect(isCpeConfirmationList(history)).toBe(true);
  expect(isCpeConfirmationList({ ...history, items: [row] })).toBe(false);
  expect(
    isTechnologyList({
      items: [technology],
      page: { limit: 20, offset: 0, total: 1 },
      summary: { confirmed_cpe: 2 },
    }),
  ).toBe(false);
  expect(
    isApplicationList({ items: [], page: { limit: 0, offset: 0, total: 0 } }),
  ).toBe(false);
});
