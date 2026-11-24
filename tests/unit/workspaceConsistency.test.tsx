import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";
import { App } from "../../src/app/App";
import { AuthContext } from "../../src/features/auth/context";
import type { ApiClient } from "../../src/services/api";

const a = "10000000-0000-4000-8000-000000000001";
const b = "10000000-0000-4000-8000-000000000002";
const appA = "20000000-0000-4000-8000-000000000001";
const appB = "20000000-0000-4000-8000-000000000002";
const tech = "30000000-0000-4000-8000-000000000001";
const api = {
  workspaces: vi.fn(),
  applications: vi.fn(),
  createApplication: vi.fn(),
  v2WorkspaceTargets: vi.fn(),
  technologies: vi.fn(),
  v2Targets: vi.fn(),
  searchV2Cpe: vi.fn(),
  v2AnalysisHistory: vi.fn(),
  v2Findings: vi.fn(),
  confirmV2Cpe: vi.fn(),
};
function application(id: string, name: string) {
  return {
    id,
    name,
    description: null,
    status: "active",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}
function page<T>(items: T[]) {
  return { items, page: { limit: 20, offset: 0, total: items.length } };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
function Location() {
  const location = useLocation();
  return (
    <output aria-label="Ruta actual">
      {location.pathname}
      {location.search}
    </output>
  );
}
function mount(path = "/aplicaciones", role = "owner") {
  api.workspaces.mockResolvedValue({
    items: [
      {
        workspace_id: a,
        name: "Ámbito A",
        role,
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        workspace_id: b,
        name: "Ámbito B",
        role: "viewer",
        created_at: "2026-01-01T00:00:00Z",
      },
    ],
  });
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={cache}>
      <AuthContext.Provider
        value={{
          user: { id: "owner", username: "Sesión conservada" },
          api: api as unknown as ApiClient,
          login: vi.fn(),
          logout: vi.fn(),
          notice: null,
        }}
      >
        <MemoryRouter initialEntries={[path]}>
          <App />
          <Location />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
  return cache;
}
async function switchTo(id: string) {
  await userEvent.selectOptions(
    (await screen.findAllByLabelText("Workspace activo"))[0],
    id,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  api.applications.mockImplementation((id) =>
    Promise.resolve(
      page([
        application(
          id === a ? appA : appB,
          id === a ? "Aplicación A" : "Aplicación B",
        ),
      ]),
    ),
  );
  api.v2WorkspaceTargets.mockResolvedValue(page([]));
  api.v2Targets.mockResolvedValue({ items: [] });
  api.technologies.mockResolvedValue({
    ...page([
      {
        id: tech,
        product: "HTTP Server",
        vendor: "Apache",
        version: "2.4.49",
        selected_cpe: null,
        confidence: "unconfirmed",
        detection_method: "manual",
        observed_at: "2026-01-01T00:00:00Z",
      },
    ]),
    summary: { confirmed_cpe: 0 },
  });
  api.v2AnalysisHistory.mockResolvedValue(page([]));
});

it("discards open forms and a late write response without moving its identifiers to B", async () => {
  const write = deferred<unknown>();
  api.createApplication.mockReturnValue(write.promise);
  mount();
  await screen.findByText("Aplicación A");
  await userEvent.click(
    screen.getByRole("button", { name: "Registrar aplicación" }),
  );
  await userEvent.type(screen.getByLabelText("Nombre"), "Solo ámbito A");
  await userEvent.click(
    screen.getByRole("button", { name: "Guardar aplicación" }),
  );
  await waitFor(() =>
    expect(api.createApplication).toHaveBeenCalledWith(
      a,
      expect.objectContaining({ name: "Solo ámbito A" }),
    ),
  );
  await switchTo(b);
  await screen.findByText("Aplicación B");
  expect(screen.queryByDisplayValue("Solo ámbito A")).not.toBeInTheDocument();
  await act(async () => write.resolve(application(appA, "Respuesta tardía A")));
  expect(screen.queryByText(/Respuesta tardía A/)).not.toBeInTheDocument();
  expect(api.createApplication).toHaveBeenCalledTimes(1);
  await switchTo(a);
  await screen.findByText("Aplicación A");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getAllByText("Sesión conservada").length).toBeGreaterThan(0);
});

it("aborts an obsolete read and ignores its response after rapid A/B/A/B switches", async () => {
  const read = deferred<unknown>();
  let oldSignal: AbortSignal | undefined;
  api.applications.mockImplementation((id, signal) => {
    if (id === a) {
      oldSignal = signal;
      return read.promise;
    }
    return Promise.resolve(page([application(appB, "Aplicación B")]));
  });
  mount();
  await waitFor(() => expect(api.applications).toHaveBeenCalled());
  await switchTo(b);
  await screen.findByText("Aplicación B");
  expect(oldSignal?.aborted).toBe(true);
  await switchTo(a);
  await switchTo(b);
  await screen.findByText("Aplicación B");
  await act(async () =>
    read.resolve(page([application(appA, "Respuesta A obsoleta")])),
  );
  expect(screen.queryByText("Respuesta A obsoleta")).not.toBeInTheDocument();
});

it("removes detail URL/query state and pending CPE candidates before mounting B", async () => {
  const candidates = deferred<unknown>();
  api.searchV2Cpe.mockReturnValue(candidates.promise);
  mount(`/aplicaciones/${appA}?technology=${tech}`);
  await screen.findByText("HTTP Server");
  await userEvent.click(screen.getByRole("button", { name: "Buscar" }));
  await waitFor(() => expect(api.searchV2Cpe).toHaveBeenCalled());
  await switchTo(b);
  await screen.findByText("Aplicación B");
  expect(screen.getByLabelText("Ruta actual")).toHaveTextContent(
    /^\/aplicaciones$/,
  );
  await act(async () =>
    candidates.resolve(
      page([
        {
          cpe_name_id: tech,
          cpe_name: "CPE antiguo",
          title: "Candidato A",
          deprecated: false,
        },
      ]),
    ),
  );
  expect(screen.queryByText("Candidato A")).not.toBeInTheDocument();
  expect(
    api.technologies.mock.calls.every(
      ([workspace, id]) => workspace !== b || id !== appA,
    ),
  ).toBe(true);
});

it("resets the history application selection on a workspace change", async () => {
  const secondA = "20000000-0000-4000-8000-000000000003";
  api.applications.mockImplementation((id) =>
    Promise.resolve(
      page(
        id === a
          ? [
              application(appA, "Aplicación A"),
              application(secondA, "Otra aplicación A"),
            ]
          : [application(appB, "Aplicación B")],
      ),
    ),
  );
  mount("/historial");
  await screen.findByLabelText("Aplicación");
  await userEvent.selectOptions(screen.getByLabelText("Aplicación"), secondA);
  await switchTo(b);
  await waitFor(() =>
    expect(screen.getByLabelText("Aplicación")).toHaveValue(appB),
  );
  expect(
    api.v2AnalysisHistory.mock.calls.some(
      ([workspace, id]) => workspace === b && id !== appB,
    ),
  ).toBe(false);
});

it("guards an implicit directory fallback without querying a foreign detail", async () => {
  const cache = mount(`/aplicaciones/${appA}`);
  await screen.findByText("HTTP Server");
  api.workspaces.mockResolvedValue({
    items: [{ workspace_id: b, name: "Ámbito B", role: "viewer" }],
  });
  await act(async () => {
    await cache.invalidateQueries({ queryKey: ["v2", "owner", "workspaces"] });
  });
  await screen.findByText("Aplicación B");
  expect(
    api.technologies.mock.calls.some(
      ([workspace, id]) => workspace === b && id === appA,
    ),
  ).toBe(false);
});

it("closes a writer form when directory refresh downgrades the current role", async () => {
  const cache = mount();
  await screen.findByText("Aplicación A");
  await userEvent.click(
    screen.getByRole("button", { name: "Registrar aplicación" }),
  );
  await userEvent.type(screen.getByLabelText("Nombre"), "Formulario anterior");
  api.workspaces.mockResolvedValue({
    items: [{ workspace_id: a, name: "Ámbito A", role: "viewer" }],
  });
  await act(async () => {
    await cache.invalidateQueries({ queryKey: ["v2", "owner", "workspaces"] });
  });
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(api.createApplication).not.toHaveBeenCalled();
});

it.each(["owner", "editor", "viewer"])(
  "keeps permissions scoped after switching as %s",
  async (role) => {
    mount("/aplicaciones", role);
    await screen.findByText("Aplicación A");
    expect(
      Boolean(screen.queryByRole("button", { name: "Registrar aplicación" })),
    ).toBe(role !== "viewer");
    await switchTo(b);
    await screen.findByText("Aplicación B");
    expect(
      screen.queryByRole("button", { name: "Registrar aplicación" }),
    ).not.toBeInTheDocument();
  },
);

it("paginates applications on the server and resets the page when filtering", async () => {
  api.applications.mockImplementation((_ws, _signal, options) =>
    Promise.resolve({
      items: [
        application(
          options?.offset ? appB : appA,
          options?.q
            ? "Coincidencia fuera de la primera página"
            : options?.offset
              ? "Página dos"
              : "Página uno",
        ),
      ],
      page: {
        limit: 20,
        offset: options?.offset ?? 0,
        total: options?.q ? 1 : 105,
      },
    }),
  );
  mount();
  await screen.findByText("Página uno");
  await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
  await screen.findByText("Página dos");
  await userEvent.type(
    screen.getByLabelText("Buscar aplicaciones"),
    "coincidencia",
  );
  await screen.findByText("Coincidencia fuera de la primera página");
  expect(api.applications).toHaveBeenLastCalledWith(
    a,
    expect.any(AbortSignal),
    { limit: 20, offset: 0, q: "coincidencia" },
  );
  expect(
    screen.queryByRole("button", { name: "Siguiente" }),
  ).not.toBeInTheDocument();
});

it("keeps technology aggregates independent of the visible page", async () => {
  api.technologies.mockImplementation((_ws, _app, _signal, options) =>
    Promise.resolve({
      items: [
        {
          id: tech,
          product: options.offset
            ? "Tecnología página dos"
            : "Tecnología página uno",
          vendor: "Apache",
          version: "2.4.49",
          selected_cpe: null,
          confidence: "unconfirmed",
          detection_method: "manual",
          observed_at: "2026-01-01T00:00:00Z",
        },
      ],
      page: { limit: 20, offset: options.offset, total: 105 },
      summary: { confirmed_cpe: 104 },
    }),
  );
  mount(`/aplicaciones/${appA}`);
  await screen.findByText("Tecnología página uno");
  expect(screen.getByText("105")).toBeVisible();
  expect(screen.getByText("104")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
  await screen.findByText("Tecnología página dos");
  expect(screen.getByText("105")).toBeVisible();
  expect(screen.getByText("104")).toBeVisible();
  expect(api.technologies).toHaveBeenLastCalledWith(
    a,
    appA,
    expect.any(AbortSignal),
    { limit: 20, offset: 20 },
  );
});

it("requires a reason and sends the candidate and confirmation scope together", async () => {
  const candidate = {
    cpe_name_id: tech,
    cpe_name: "cpe:2.3:a:apache:http_server:2.4.49:*:*:*:*:*:*:*",
    title: "Apache",
    deprecated: false,
  };
  api.searchV2Cpe.mockResolvedValue(page([candidate]));
  api.confirmV2Cpe.mockResolvedValue(candidate);
  mount(`/aplicaciones/${appA}`);
  await screen.findByText("HTTP Server");
  await userEvent.click(screen.getByRole("button", { name: "Buscar" }));
  await screen.findByRole("radio");
  await userEvent.click(screen.getByRole("radio"));
  expect(screen.getByRole("button", { name: "Confirmar CPE" })).toBeDisabled();
  await userEvent.type(
    screen.getByLabelText("Motivo de confirmación"),
    "Versión comprobada",
  );
  await userEvent.click(screen.getByRole("button", { name: "Confirmar CPE" }));
  await waitFor(() =>
    expect(api.confirmV2Cpe).toHaveBeenCalledWith(
      a,
      appA,
      tech,
      tech,
      candidate.cpe_name,
      null,
      { part: "a", mode: "live" },
      {
        expected_confirmation_id: null,
        reason: "Versión comprobada",
        evidence: null,
      },
    ),
  );
});
