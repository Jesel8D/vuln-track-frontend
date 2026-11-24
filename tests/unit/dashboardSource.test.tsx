import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, it, vi } from "vitest";
import { V2DashboardPage } from "../../src/pages/V2DashboardPage";
const mock = vi.hoisted(() => ({ dashboard: vi.fn() }));
vi.mock("../../src/features/auth/context", () => ({
  useAuth: () => ({
    user: { id: "user" },
    api: { v2Dashboard: mock.dashboard },
  }),
}));
vi.mock("../../src/features/v2/WorkspaceContext", () => ({
  useWorkspace: () => ({
    current: { workspace_id: "workspace", name: "Lab", role: "viewer" },
  }),
}));
vi.mock("../../src/features/v2/InventoryCoverage", () => ({
  InventoryCoveragePanel: () => <p>Cobertura independiente</p>,
}));
vi.mock("../../src/features/v2/InventoryAnalytics", () => ({
  InventoryAnalyticsPanel: () => <p>Analítica independiente</p>,
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});
it.each([
  ["", "unknown"],
  ["fixture", "fixture"],
  ["live", "live"],
])(
  "always filters CVE history when configured mode is %s",
  async (configured, expected) => {
    vi.stubEnv("VITE_NVD_MODE", configured);
    mock.dashboard.mockReturnValue(new Promise(() => {}));
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <MemoryRouter>
          <V2DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() =>
      expect(mock.dashboard).toHaveBeenCalledWith(
        "workspace",
        expect.any(AbortSignal),
        expected,
      ),
    );
    expect(
      screen.getByRole("combobox", {
        name: "Procedencia de las consultas del dashboard",
      }),
    ).toHaveValue(expected);
  },
);
