import { AnalysisHistoryPage } from "../../src/pages/AnalysisHistoryPage";
import { act, render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
} from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { AuthContext } from "../../src/features/auth/context";
import { ApiClient } from "../../src/services/api";
import { AnalysisSection } from "../../src/features/analyses/AnalysisSection";
import { FindingsTable } from "../../src/features/analyses/FindingsTable";
import { CoverageNotice } from "../../src/features/analyses/RunStatus";
import { ReviewForm } from "../../src/features/analyses/ReviewForm";
import { analysisIntents } from "../../src/features/analyses/intents";
import { useAnalysis } from "../../src/hooks/analyses";
import {
  assetId,
  finding,
  identification,
  run,
  runId,
  timestamp,
  userId,
} from "./analysisFixtures";
import type { Finding } from "../../src/types/api";
const clients: QueryClient[] = [];
afterEach(() => {
  cleanup();
  clients.forEach((c) => c.clear());
  clients.length = 0;
  analysisIntents.clear();
  focusManager.setFocused(true);
  vi.useRealTimers();
});
function wrap(ui: React.ReactNode, fetch: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("fetch", fetch);
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 30000 },
      mutations: { retry: false },
    },
  });
  clients.push(client);
  const api = new ApiClient(
    "https://api.example.test",
    () => "test-token",
    vi.fn(),
  );
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <AuthContext
          value={{
            api,
            user: { id: userId, username: "operator" },
            login: vi.fn(),
            logout: vi.fn(),
            notice: null,
          }}
        >
          <MemoryRouter initialEntries={[`/activos/${assetId}`]}>
            <Routes>
              <Route path="/activos/:assetId" element={ui} />
              <Route
                path="/activos/:assetId/analisis/:runId"
                element={<h1>Consulta aceptada</h1>}
              />
            </Routes>
          </MemoryRouter>
        </AuthContext>
      </QueryClientProvider>,
    ),
  };
}
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
function sectionFetch(
  options: {
    version?: string | null;
    state?: "confirmed" | "needs_review";
    post?: () => Promise<Response>;
  } = {},
) {
  return vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
    if (init.method === "POST")
      return options.post
        ? options.post()
        : response({ id: runId, accepted_at: timestamp }, 202);
    if (url.includes("cpe-identifications"))
      return response({
        current_state: options.state ?? "confirmed",
        items: [
          {
            ...identification,
            state: options.state ?? "confirmed",
            observed_version:
              options.version === undefined ? "1.0.0.33" : options.version,
          },
        ],
        page: { limit: 20, offset: 0, total: 1 },
      });
    return response({ items: [], page: { limit: 1, offset: 0, total: 0 } });
  });
}
it("disables consultation for unknown version and links to identification", async () => {
  wrap(<AnalysisSection assetId={assetId} />, sectionFetch({ version: null }));
  expect(
    await screen.findByRole("button", { name: "Consultar CVE" }),
  ).toBeDisabled();
  expect(screen.getByText(/La versión observada es desconocida/)).toBeVisible();
  expect(
    screen.getByRole("link", { name: "Ir a identificación CPE" }),
  ).toHaveAttribute("href", `/activos/${assetId}/identificacion`);
});
it("requires an explicitly confirmed identity", async () => {
  wrap(
    <AnalysisSection assetId={assetId} />,
    sectionFetch({ state: "needs_review" }),
  );
  expect(
    await screen.findByRole("button", { name: "Consultar CVE" }),
  ).toBeDisabled();
});
it("prevents double submission and navigates only after real acceptance", async () => {
  let resolve!: (r: Response) => void;
  const fetch = sectionFetch({
    post: () =>
      new Promise((r) => {
        resolve = r;
      }),
  });
  wrap(<AnalysisSection assetId={assetId} />, fetch);
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole("button", { name: "Consultar CVE" }),
  );
  await user.click(
    screen.getByLabelText("Confirmo consultar CVE para esta identificación."),
  );
  const button = screen.getByRole("button", {
    name: "Iniciar consulta NVD",
  });
  await user.dblClick(button);
  expect(fetch.mock.calls.filter((c) => c[1].method === "POST")).toHaveLength(
    1,
  );
  resolve(response({ id: runId, accepted_at: timestamp }, 202));
  expect(
    await screen.findByRole("heading", { name: "Consulta aceptada" }),
  ).toBeVisible();
});
it("retries a lost acceptance with the same key/body", async () => {
  let attempts = 0;
  const fetch = sectionFetch({
    post: async () => {
      if (attempts++ === 0) throw new TypeError("lost response");
      return response({ id: runId, accepted_at: timestamp }, 202);
    },
  });
  wrap(<AnalysisSection assetId={assetId} />, fetch);
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole("button", { name: "Consultar CVE" }),
  );
  await user.click(
    screen.getByLabelText("Confirmo consultar CVE para esta identificación."),
  );
  await user.click(
    screen.getByRole("button", { name: "Iniciar consulta NVD" }),
  );
  await user.click(
    await screen.findByRole("button", { name: "Reintentar el mismo intento" }),
  );
  expect(
    await screen.findByRole("heading", { name: "Consulta aceptada" }),
  ).toBeVisible();
  const posts = fetch.mock.calls.filter((c) => c[1].method === "POST");
  expect(posts[0][1].headers["Idempotency-Key"]).toBe(
    posts[1][1].headers["Idempotency-Key"],
  );
  expect(posts[0][1].body).toBe(posts[1][1].body);
});
it.each(["complete", "partial", null] as const)(
  "coverage %s never asserts device safety",
  (coverage) => {
    const current =
      coverage === null
        ? { ...run, status: "failed" as const, coverage: null, page_count: 0 }
        : { ...run, coverage };
    render(<CoverageNotice run={current} />);
    expect(
      screen.queryByText(
        /Tu dispositivo está seguro|No existen vulnerabilidades/,
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Cobertura de consulta")).toBeVisible();
  },
);
it("renders missing CVSS and escaped titles with independent review state", () => {
  render(
    <MemoryRouter>
      <FindingsTable
        assetId={assetId}
        runId={runId}
        items={[
          { ...finding, cvss: null, title: "<img src=x onerror=alert(1)>" },
        ]}
      />
    </MemoryRouter>,
  );
  expect(screen.getByText(/Sin métricas CVSS disponibles/)).toBeVisible();
  expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeVisible();
  expect(document.querySelector("img")).toBeNull();
  expect(screen.getByText("Pendiente de revisión")).toBeVisible();
  expect(screen.getByText("Aplicabilidad no determinada")).toBeVisible();
});
it("validates review reason and evidence before sending PATCH", async () => {
  const fetch = vi.fn();
  wrap(<ReviewForm finding={finding} run={run} />, fetch);
  const user = userEvent.setup();
  await user.click(
    screen.getByLabelText(
      "Confirmo guardar esta revisión única con su evidencia.",
    ),
  );
  await user.click(
    screen.getByRole("button", { name: "Guardar revisión del hallazgo" }),
  );
  expect(screen.getAllByText("Este campo es obligatorio.")).toHaveLength(2);
  expect(fetch).not.toHaveBeenCalled();
});
it("reconciles a lost PATCH with GET once, preserving original evidence", async () => {
  const reviewed: Finding = {
    ...finding,
    status: "reviewed",
    reviewed_by: userId,
    reviewed_at: timestamp,
    review_reason: "Documento",
    review_evidence: "Entorno verificado",
  };
  const fetch = vi
    .fn()
    .mockImplementation(async (_url: string, opts: RequestInit) => {
      if (opts.method === "PATCH") throw new TypeError("lost");
      return response(reviewed);
    });
  wrap(<ReviewForm finding={finding} run={run} />, fetch);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/Motivo de la revisión/), "Documento");
  await user.type(
    screen.getByLabelText(/Evidencia de la revisión/),
    "Entorno verificado",
  );
  await user.click(
    screen.getByLabelText(
      "Confirmo guardar esta revisión única con su evidencia.",
    ),
  );
  await user.click(
    screen.getByRole("button", { name: "Guardar revisión del hallazgo" }),
  );
  await waitFor(() =>
    expect(fetch.mock.calls.map((c) => c[1].method)).toEqual(["PATCH", "GET"]),
  );
  expect(finding.evidence?.initial_applicability).toBe("undetermined");
  expect(
    screen.getByRole("button", { name: "Guardar revisión del hallazgo" }),
  ).toBeDisabled();
});
it("does not offer review on active executions or legacy evidence", () => {
  const fetch = vi.fn();
  wrap(
    <ReviewForm finding={{ ...finding, evidence: null }} run={run} />,
    fetch,
  );
  expect(
    screen.queryByRole("button", { name: "Guardar revisión del hallazgo" }),
  ).not.toBeInTheDocument();
  expect(screen.getByText(/registro legado/)).toBeVisible();
});
function PollProbe() {
  const query = useAnalysis(assetId, runId);
  return (
    <div data-testid="poll">
      {query.data?.status}
      {query.isError ? " error" : ""}
    </div>
  );
}
it("polls active status, pauses hidden, stops on completion and unmount", async () => {
  vi.useFakeTimers();
  const fetch = vi.fn().mockImplementation(async () =>
    response({
      ...run,
      status: "running",
      coverage: null,
      completed_at: null,
    }),
  );
  const ui = wrap(<PollProbe />, fetch);
  await act(() => vi.advanceTimersByTimeAsync(5));
  expect(screen.getByTestId("poll")).toHaveTextContent("running");
  focusManager.setFocused(false);
  await act(() => vi.advanceTimersByTimeAsync(4100));
  expect(fetch).toHaveBeenCalledOnce();
  focusManager.setFocused(true);
  fetch.mockImplementation(async () => response(run));
  await act(() => vi.advanceTimersByTimeAsync(4100));
  expect(screen.getByTestId("poll")).toHaveTextContent("completed");
  const count = fetch.mock.calls.length;
  await act(() => vi.advanceTimersByTimeAsync(12000));
  expect(fetch).toHaveBeenCalledTimes(count);
  ui.unmount();
  await act(() => vi.advanceTimersByTimeAsync(5000));
  expect(fetch).toHaveBeenCalledTimes(count);
});
it("stops polling on an invalid state while preserving last known run", async () => {
  vi.useFakeTimers();
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      response({
        ...run,
        status: "running",
        coverage: null,
        completed_at: null,
      }),
    )
    .mockImplementation(async () => response({ ...run, status: "UNEXPECTED" }));
  wrap(<PollProbe />, fetch);
  await act(() => vi.advanceTimersByTimeAsync(5));
  expect(screen.getByTestId("poll")).toHaveTextContent("running");
  await act(() => vi.advanceTimersByTimeAsync(4100));
  expect(screen.getByTestId("poll")).toHaveTextContent("running error");
  const count = fetch.mock.calls.length;
  await act(() => vi.advanceTimersByTimeAsync(12000));
  expect(fetch).toHaveBeenCalledTimes(count);
});

it("aborts an in-flight poll when an active view unmounts", async () => {
  vi.useFakeTimers();
  let aborted = false;
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      response({
        ...run,
        status: "running",
        coverage: null,
        completed_at: null,
      }),
    )
    .mockImplementation(
      (_url: string, opts: RequestInit) =>
        new Promise((_resolve, reject) => {
          opts.signal?.addEventListener("abort", () => {
            aborted = true;
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    );
  const ui = wrap(<PollProbe />, fetch);
  await act(() => vi.advanceTimersByTimeAsync(5));
  await act(() => vi.advanceTimersByTimeAsync(4100));
  expect(fetch).toHaveBeenCalledTimes(2);
  ui.unmount();
  expect(aborted).toBe(true);
  await act(() => vi.advanceTimersByTimeAsync(12000));
  expect(fetch).toHaveBeenCalledTimes(2);
});

it("paginates analysis history using the server total and retains historical CPE", async () => {
  const offsets: number[] = [];
  const fetch = vi.fn().mockImplementation(async (url: string) => {
    if (url.includes("cpe-identifications"))
      return response({
        current_state: "confirmed",
        items: [identification],
        page: { limit: 20, offset: 0, total: 1 },
      });
    if (url.includes("/analyses?")) {
      const params = new URL(url).searchParams;
      const limit = Number(params.get("limit"));
      const offset = Number(params.get("offset"));
      offsets.push(offset);
      return response({
        items: Array.from({ length: limit }, (_, i) => ({
          ...run,
          id: `22222222-2222-4222-8222-${String(offset + i).padStart(12, "0")}`,
          selected_cpe: run.selected_cpe.replace("1.0.0.33", "1.0.0.30"),
          identification_id: null,
        })),
        page: { limit, offset, total: 41 },
      });
    }
    return response({
      id: assetId,
      manufacturer: "Cisco",
      model: "RV340",
      device_type: "router",
      version: "1.0.0.33",
      site_label: "LAB",
      inventory_label: null,
      notes: null,
      created_at: timestamp,
    });
  });
  wrap(<AnalysisHistoryPage />, fetch);
  expect(await screen.findByText("1–20 de 41")).toBeVisible();
  expect(screen.getAllByRole("article")).toHaveLength(20);
  expect(screen.getAllByText(/1.0.0.30/).length).toBeGreaterThan(0);
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Página siguiente" }));
  expect(await screen.findByText("21–40 de 41")).toBeVisible();
  expect(offsets).toContain(20);
});

it("shows one original description at a time and escapes external text", async () => {
  const { SourceDescription } =
    await import("../../src/features/analyses/SourceDescription");
  render(
    <SourceDescription
      descriptions={[
        { lang: "en", value: "<script>unsafe</script>" },
        { lang: "es", value: "Descripción original en español" },
      ]}
      fallback={null}
    />,
  );
  expect(screen.getByText("Descripción original en español")).toBeVisible();
  expect(screen.queryByText("<script>unsafe</script>")).not.toBeInTheDocument();
  await userEvent
    .setup()
    .selectOptions(screen.getByLabelText("Idioma de la descripción"), "0");
  expect(screen.getByText("<script>unsafe</script>")).toBeVisible();
  expect(document.querySelector("script")).toBeNull();
});
