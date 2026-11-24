import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { AuthContext } from "../../src/features/auth/context";
import { ApplicationTargets } from "../../src/features/v2/ApplicationTargets";
import { AnalysisFindings } from "../../src/features/v2/AnalysisFindings";
import { FindingRecommendations } from "../../src/features/v2/FindingRecommendations";
import { ApiClient } from "../../src/services/api";

const ws = "10000000-0000-4000-8000-000000000001";
const app = "20000000-0000-4000-8000-000000000001";
const run = "30000000-0000-4000-8000-000000000001";
const findingId = "40000000-0000-4000-8000-000000000001";
const time = "2026-01-01T00:00:00Z";
const api = {
  v2Targets: vi.fn(),
  v2Findings: vi.fn(),
  v2Recommendations: vi.fn(),
  createV2Recommendation: vi.fn(),
  v2Verifications: vi.fn(),
  authorizeV2Target: vi.fn(),
};
function page<T>(items: T[], total: number, offset: number, limit = 20) {
  return { items, page: { limit, offset, total } };
}
const finding = {
  id: findingId,
  external_id: "CVE-2026-99999",
  title: "Resultado sintético guardado",
  severity: "high",
  cvss: null,
  applicability: "undetermined",
  status: "open",
  evidence: { descriptions: [{ lang: "en", value: "Evidencia histórica" }] },
  published_at: time,
  last_modified_at: time,
  observed_at: time,
  updated_at: time,
};
const analysis = {
  id: run,
  application_id: app,
  technology_id: null,
  selected_cpe: "cpe:2.3:a:vendor:producto:1.0:*:*:*:*:*:*:*",
  created_at: time,
  nvd_mode: "fixture",
  evaluated_technology: {
    vendor: "vendor",
    product: "producto",
    version: "1.0",
    basis: "historical_cpe",
  },
};
const recommendation = {
  id: "50000000-0000-4000-8000-000000000001",
  finding_id: findingId,
  recommendation: "Medida manual documentada",
  source_url: null,
  status: "pending",
  assigned_to: null,
  created_by: ws,
  due_at: null,
  completed_at: null,
  created_at: time,
  updated_at: time,
};
function mount(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider
        value={{
          api: api as unknown as ApiClient,
          user: { id: ws, username: "Lector" },
          login: vi.fn(),
          logout: vi.fn(),
          notice: null,
        }}
      >
        <MemoryRouter>{ui}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}
beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.unstubAllGlobals());

it("paginates targets, resets filters to page one and never requests challenges eagerly", async () => {
  api.v2Targets.mockImplementation((_w, _a, _s, params) =>
    Promise.resolve(page([], params.q ? 0 : 45, params.offset)),
  );
  mount(
    <ApplicationTargets
      workspaceId={ws}
      applicationId={app}
      applicationStatus="active"
      canWrite={false}
    />,
  );
  await userEvent.click(
    await screen.findByRole("button", { name: "Siguiente" }),
  );
  await screen.findByText("Página 2 de 3");
  await userEvent.type(screen.getByLabelText("Buscar destinos"), "%_");
  await waitFor(() =>
    expect(api.v2Targets).toHaveBeenLastCalledWith(
      ws,
      app,
      expect.any(AbortSignal),
      { offset: 0, q: "%_", authorization_status: "" },
    ),
  );
  expect(api.v2Verifications).not.toHaveBeenCalled();
  expect(api.authorizeV2Target).not.toHaveBeenCalled();
  expect(
    screen.queryByRole("button", { name: "Agregar destino" }),
  ).not.toBeInTheDocument();
});

it("retries target failures and renders an empty filtered page", async () => {
  api.v2Targets
    .mockRejectedValueOnce(new Error("Sin conexión"))
    .mockResolvedValue(page([], 0, 0));
  mount(
    <ApplicationTargets
      workspaceId={ws}
      applicationId={app}
      applicationStatus="active"
      canWrite={false}
    />,
  );
  await screen.findByRole("alert");
  await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  await waitFor(() =>
    expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
  );
  expect(api.v2Targets).toHaveBeenCalledTimes(2);
});

it("paginates findings preserving fixture provenance, historical CPE, evidence and identifiers", async () => {
  api.v2Findings.mockImplementation((_w, _a, _r, offset) =>
    Promise.resolve({ ...page(offset ? [] : [finding], 21, offset), analysis }),
  );
  mount(
    <AnalysisFindings
      workspaceId={ws}
      applicationId={app}
      runId={run}
      canWrite={false}
    />,
  );
  await screen.findByText(findingId);
  expect(screen.getByText(/fixture de demostración/)).toBeVisible();
  expect(screen.getByText(/vendor · producto · 1.0/)).toBeVisible();
  await userEvent.click(screen.getByText("Evidencia guardada del hallazgo"));
  expect(screen.getByText(/"Evidencia histórica"/)).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Guardar revisión" }),
  ).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
  await waitFor(() =>
    expect(api.v2Findings).toHaveBeenLastCalledWith(
      ws,
      app,
      run,
      20,
      expect.any(AbortSignal),
    ),
  );
  await screen.findByText("Esta página no contiene hallazgos guardados.");
  expect(screen.getByText("Total: 21 hallazgos")).toBeVisible();
});

it("keeps a delayed old findings page out of a newly mounted workspace", async () => {
  let resolve!: (data: unknown) => void;
  let signal!: AbortSignal;
  api.v2Findings.mockImplementation((workspace, _a, _r, _o, s) => {
    if (workspace === ws) {
      signal = s;
      return new Promise((r) => {
        resolve = r;
      });
    }
    return Promise.resolve(page([], 0, 0));
  });
  const view = mount(
    <AnalysisFindings
      key="A"
      workspaceId={ws}
      applicationId={app}
      runId={run}
      canWrite={false}
    />,
  );
  await waitFor(() => expect(api.v2Findings).toHaveBeenCalled());
  view.unmount();
  mount(
    <AnalysisFindings
      key="B"
      workspaceId={app}
      applicationId={ws}
      runId={run}
      canWrite={false}
    />,
  );
  await screen.findByText("Total: 0 hallazgos");
  await act(async () => resolve({ ...page([finding], 1, 0), analysis }));
  expect(signal.aborted).toBe(true);
  expect(screen.queryByText(findingId)).not.toBeInTheDocument();
});

it("loads recommendations on demand, pages totals and resets offset when filtering", async () => {
  api.v2Recommendations.mockImplementation((_w, _a, _f, _s, params) =>
    Promise.resolve(
      page(
        params.status ? [] : [recommendation],
        params.status ? 0 : 24,
        params.offset,
        10,
      ),
    ),
  );
  mount(
    <FindingRecommendations
      workspaceId={ws}
      applicationId={app}
      findingId={findingId}
      canWrite={false}
    />,
  );
  expect(api.v2Recommendations).not.toHaveBeenCalled();
  await userEvent.click(screen.getByText("Medidas de seguimiento"));
  await screen.findByText("Medida manual documentada");
  await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
  await screen.findByText("Página 2 de 3");
  await userEvent.selectOptions(
    screen.getByLabelText("Filtrar medidas por estado"),
    "fixed",
  );
  await screen.findByText("No hay medidas con este estado.");
  expect(api.v2Recommendations).toHaveBeenLastCalledWith(
    ws,
    app,
    findingId,
    expect.any(AbortSignal),
    { offset: 0, status: "fixed" },
  );
  expect(api.createV2Recommendation).not.toHaveBeenCalled();
  expect(screen.queryByLabelText("Medida recomendada")).not.toBeInTheDocument();
});

it("retries a findings failure without creating a new analysis", async () => {
  api.v2Findings
    .mockRejectedValueOnce(new Error("Sin conexión"))
    .mockResolvedValue(page([], 0, 0));
  mount(
    <AnalysisFindings
      workspaceId={ws}
      applicationId={app}
      runId={run}
      canWrite={false}
    />,
  );
  await screen.findByRole("alert");
  await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  await screen.findByText("Total: 0 hallazgos");
  expect(api.v2Findings).toHaveBeenCalledTimes(2);
});

it("rejects a recommendation associated with a different finding", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify(
            page([{ ...recommendation, finding_id: app }], 1, 0, 10),
          ),
          { status: 200 },
        ),
      ),
  );
  const client = new ApiClient(
    "http://127.0.0.1:8018",
    () => "synthetic",
    vi.fn(),
  );
  await expect(client.v2Recommendations(ws, app, findingId)).rejects.toThrow();
});

it("rejects findings whose context belongs to a different application", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            ...page([finding], 1, 0),
            run_status: "completed",
            coverage: "complete",
            analysis: { ...analysis, application_id: ws },
          }),
          { status: 200 },
        ),
      ),
  );
  const client = new ApiClient(
    "http://127.0.0.1:8018",
    () => "synthetic",
    vi.fn(),
  );
  await expect(client.v2Findings(ws, app, run)).rejects.toThrow();
});
