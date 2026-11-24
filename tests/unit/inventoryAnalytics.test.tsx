import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { AuthContext } from "../../src/features/auth/context";
import { InventoryAnalyticsPanel } from "../../src/features/v2/InventoryAnalytics";
import { V2DevicesPage } from "../../src/pages/V2DevicesPage";
import { ApiClient } from "../../src/services/api";
import {
  isInventoryDistribution,
  isInventoryEvents,
} from "../../src/services/inventoryAnalyticsContract";
import type {
  InventoryDistribution,
  InventoryEvents,
  InventoryKind,
  InventoryDimension,
} from "../../src/types/inventoryAnalytics";
import { inventoryEventKeys } from "../../src/types/inventoryAnalytics";

const first = "10000000-0000-4000-8000-000000000001";
const second = "10000000-0000-4000-8000-000000000002";
const api = {
  inventoryDistribution: vi.fn(),
  inventoryEvents: vi.fn(),
  request: vi.fn(),
};
vi.mock("../../src/features/v2/WorkspaceContext", () => ({
  useWorkspace: () => ({
    current: { workspace_id: first, name: "Inventario A", role: "viewer" },
  }),
}));

function distribution(
  workspace = first,
  kind: InventoryKind = "devices",
  dimension: InventoryDimension = "vendor",
): InventoryDistribution {
  return {
    workspace_id: workspace,
    inventory_kind: kind,
    dimension,
    scope: "active",
    normalization: "case_whitespace_v1",
    limit: 10,
    total: 10,
    excluded_inactive: 1,
    unknown: 2,
    other: 3,
    categories: [
      {
        vendor_key: "acme",
        product_key: dimension === "product" ? "modelo uno" : null,
        label: "Acme",
        count: 5,
      },
    ],
    observed_at: "2026-11-24T12:00:00Z",
  };
}
function events(
  kind: InventoryKind = "devices",
  days: 30 | 90 = 30,
): InventoryEvents {
  const zero = Object.fromEntries(
    inventoryEventKeys.map((k) => [k, 0]),
  ) as InventoryEvents["totals"];
  const end = Date.parse("2026-11-25T00:00:00Z");
  const start = end - days * 86400000;
  const daily = Array.from({ length: days }, (_, i) => ({
    date: new Date(start + i * 86400000).toISOString().slice(0, 10),
    counts: { ...zero },
  }));
  const totals = { ...zero };
  if (kind === "devices") {
    daily[0].counts.first_confirmations = 1;
    daily.at(-1)!.counts.subsequent_confirmations = 1;
    daily.at(-1)!.counts.version_changes = 1;
    Object.assign(totals, {
      first_confirmations: 1,
      subsequent_confirmations: 1,
      version_changes: 1,
    });
  }
  return {
    workspace_id: first,
    inventory_kind: kind,
    scope: "recorded_history",
    window: {
      days,
      start: new Date(start).toISOString().slice(0, 10),
      end_exclusive: "2026-11-25",
      timezone: "UTC",
      observed_at: "2026-11-24T12:00:00Z",
    },
    totals,
    daily,
    confirmation_modes: {
      live: 0,
      fixture: kind === "devices" ? 2 : 0,
      unknown: 0,
    },
    selections_without_confirmation_events: kind === "technologies" ? 1 : 0,
    version_history_available: kind === "devices",
  };
}
function mount(
  ui = (
    <InventoryAnalyticsPanel workspaceId={first} workspaceName="Inventario A" />
  ),
  path = "/",
) {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={cache}>
      <AuthContext.Provider
        value={{
          user: { id: first, username: "Lector" },
          api: api as unknown as ApiClient,
          login: vi.fn(),
          logout: vi.fn(),
          notice: null,
        }}
      >
        <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  api.inventoryDistribution.mockImplementation((ws, kind, dim) =>
    Promise.resolve(distribution(ws, kind, dim)),
  );
  api.inventoryEvents.mockImplementation((_ws, kind, days) =>
    Promise.resolve(events(kind, days)),
  );
  api.request.mockResolvedValue({
    items: [],
    page: { limit: 20, offset: 0, total: 0 },
  });
});
afterEach(() => vi.unstubAllGlobals());

it("uses a complete denominator, explicit other/unknown and an accessible table", async () => {
  mount();
  const table = await screen.findByRole("table");
  expect(within(table).getByText("5 / 10")).toBeVisible();
  expect(within(table).getByText("3 / 10")).toBeVisible();
  expect(within(table).getByText("2 / 10")).toBeVisible();
  expect(within(table).getByText("50.0%")).toBeVisible();
  expect(screen.getByText(/1 excluidos por estado inactivo/)).toBeVisible();
  expect(within(table).getByRole("link", { name: "Acme" })).toHaveAttribute(
    "href",
    "/dispositivos?status=active&manufacturer_key=acme",
  );
  expect(api.inventoryEvents).not.toHaveBeenCalled();
});

it("separates application technologies and changes the grouping on the server", async () => {
  mount();
  await screen.findByRole("table");
  await userEvent.selectOptions(
    screen.getByLabelText("Tipo de inventario"),
    "technologies",
  );
  await userEvent.selectOptions(
    screen.getByLabelText("Agrupar inventario por"),
    "product",
  );
  await waitFor(() =>
    expect(api.inventoryDistribution).toHaveBeenLastCalledWith(
      first,
      "technologies",
      "product",
      expect.any(AbortSignal),
    ),
  );
  expect(
    await screen.findByRole("link", {
      name: "Abrir aplicaciones (sin filtro de proveedor)",
    }),
  ).toBeVisible();
  expect(
    within(screen.getByRole("table")).queryByRole("link", { name: "Acme" }),
  ).not.toBeInTheDocument();
});

it("keeps a single entity at 100 percent without counting catalog entries", async () => {
  const one = distribution();
  one.total = 1;
  one.unknown = one.other = 0;
  one.categories[0].count = 1;
  api.inventoryDistribution.mockResolvedValue(one);
  mount();
  expect(await screen.findByText("1 / 1")).toBeVisible();
  expect(screen.getByText("100.0%")).toBeVisible();
});

it("renders no percentage for an empty inventory", async () => {
  api.inventoryDistribution.mockResolvedValue({
    ...distribution(),
    total: 0,
    unknown: 0,
    other: 0,
    categories: [],
  });
  mount();
  await screen.findByText(/No hay registros activos para esta distribución/);
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(screen.queryByText("0.0%")).not.toBeInTheDocument();
});

it("reports a failure without inventing zeros and retries the same read", async () => {
  api.inventoryDistribution
    .mockRejectedValueOnce(new Error("Sin conexión"))
    .mockResolvedValue(distribution());
  mount();
  await screen.findByRole("alert");
  expect(screen.queryByText("0 registros activos")).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: "Reintentar analítica" }),
  );
  await screen.findByRole("table");
  expect(api.inventoryDistribution).toHaveBeenCalledTimes(2);
});

it("lazily displays persisted events, provenance and a daily UTC alternative", async () => {
  mount();
  await screen.findByRole("table");
  await userEvent.selectOptions(
    screen.getByLabelText("Vista de analítica"),
    "events",
  );
  await screen.findByText("3 eventos registrados");
  expect(
    screen.getByRole("img", { name: /3 eventos CPE registrados por día UTC/ }),
  ).toBeVisible();
  expect(screen.getByText(/El día actual es parcial/)).toBeVisible();
  expect(screen.getByText(/fixture 2, sin registrar 0/)).toBeVisible();
  await userEvent.click(screen.getByText("Ver tabla diaria de eventos (UTC)"));
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(
    31,
  );
  expect(screen.getByText(/Una revisión que cambia versión/)).toBeVisible();
});

it("does not invent technology version history or date legacy selections", async () => {
  mount();
  await screen.findByRole("table");
  await userEvent.selectOptions(
    screen.getByLabelText("Tipo de inventario"),
    "technologies",
  );
  await userEvent.selectOptions(
    screen.getByLabelText("Vista de analítica"),
    "events",
  );
  await screen.findByText(/No hay eventos registrados en esta ventana/);
  expect(
    screen.getByText(
      /Selecciones CPE sin evento de confirmación registrado: 1/,
    ),
  ).toBeVisible();
  expect(
    screen.getByText(/No existe historial de cambios de versión/),
  ).toBeVisible();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});

it("requests a bounded 90 day window without changing entity scope", async () => {
  mount();
  await screen.findByRole("table");
  await userEvent.selectOptions(
    screen.getByLabelText("Vista de analítica"),
    "events",
  );
  await screen.findByText("3 eventos registrados");
  await userEvent.selectOptions(
    screen.getByLabelText("Ventana de actividad"),
    "90",
  );
  await waitFor(() =>
    expect(api.inventoryEvents).toHaveBeenLastCalledWith(
      first,
      "devices",
      90,
      expect.any(AbortSignal),
    ),
  );
  await userEvent.click(screen.getByText("Ver tabla diaria de eventos (UTC)"));
  await waitFor(() =>
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(
      91,
    ),
  );
});

it("aborts a delayed workspace query and never renders its old categories in the new scope", async () => {
  let resolve!: (d: InventoryDistribution) => void;
  let oldSignal!: AbortSignal;
  api.inventoryDistribution.mockImplementation((ws, _k, _d, signal) => {
    if (ws === first) {
      oldSignal = signal;
      return new Promise((r) => {
        resolve = r;
      });
    }
    const next = distribution(second);
    next.categories[0].label = "Exclusivo B";
    return Promise.resolve(next);
  });
  function Harness() {
    const [ws, setWs] = useState(first);
    return (
      <>
        <button onClick={() => setWs(second)}>Cambiar workspace</button>
        <InventoryAnalyticsPanel
          key={ws}
          workspaceId={ws}
          workspaceName={ws === first ? "Ámbito A" : "Ámbito B"}
        />
      </>
    );
  }
  mount(<Harness />);
  await waitFor(() => expect(api.inventoryDistribution).toHaveBeenCalled());
  await userEvent.click(
    screen.getByRole("button", { name: "Cambiar workspace" }),
  );
  await screen.findByRole("link", { name: "Exclusivo B" });
  await act(async () => resolve(distribution()));
  expect(oldSignal.aborted).toBe(true);
  expect(screen.queryByRole("link", { name: "Acme" })).not.toBeInTheDocument();
});

it("propagates exact chart filters to the paged device list and removes them explicitly", async () => {
  mount(
    <V2DevicesPage />,
    "/dispositivos?status=active&manufacturer_key=cisco+systems&model_key=rv+340",
  );
  await screen.findByText(/Filtro exacto de la gráfica/);
  await waitFor(() =>
    expect(api.request).toHaveBeenCalledWith(
      expect.stringContaining(
        "manufacturer_key=cisco+systems&model_key=rv+340",
      ),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ),
  );
  expect(screen.getByLabelText("Estado")).toHaveValue("active");
  expect(
    screen.queryByRole("button", { name: "Registrar dispositivo" }),
  ).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: "Quitar filtro exacto" }),
  );
  await waitFor(() =>
    expect(api.request).toHaveBeenLastCalledWith(
      `/api/v2/workspaces/${first}/devices?q=&offset=0`,
      expect.anything(),
    ),
  );
});

it("validates distribution partitions and rejects duplicate categories or mixed dimensions", () => {
  expect(isInventoryDistribution(distribution())).toBe(true);
  expect(isInventoryDistribution({ ...distribution(), total: 999 })).toBe(
    false,
  );
  const duplicate = distribution();
  duplicate.categories.push({ ...duplicate.categories[0] });
  duplicate.total += 5;
  expect(isInventoryDistribution(duplicate)).toBe(false);
  expect(
    isInventoryDistribution({ ...distribution(), dimension: "product" }),
  ).toBe(false);
  expect(isInventoryDistribution({ ...distribution(), limit: 1000 })).toBe(
    false,
  );
});

it("validates contiguous dates, event sums and recorded confirmation modes", () => {
  expect(isInventoryEvents(events())).toBe(true);
  const changed = events();
  changed.daily[1].date = changed.daily[0].date;
  expect(isInventoryEvents(changed)).toBe(false);
  const totals = events();
  totals.totals.version_changes++;
  expect(isInventoryEvents(totals)).toBe(false);
  const modes = events();
  modes.confirmation_modes.live++;
  expect(isInventoryEvents(modes)).toBe(false);
  const fakeHistory = events("technologies");
  fakeHistory.version_history_available = true;
  expect(isInventoryEvents(fakeHistory)).toBe(false);
});

it("accepts Unicode names within server character limits, without counting surrogate pairs twice", () => {
  const unicode = distribution();
  unicode.categories[0].vendor_key = "😀".repeat(120);
  unicode.categories[0].label = "😀".repeat(120);
  expect(isInventoryDistribution(unicode)).toBe(true);
  unicode.categories[0].vendor_key = "😀".repeat(201);
  expect(isInventoryDistribution(unicode)).toBe(false);
});

it("rejects a distribution response from a different workspace", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(distribution(second)), { status: 200 }),
      ),
  );
  const client = new ApiClient(
    "http://127.0.0.1:8018",
    () => "synthetic",
    vi.fn(),
  );
  await expect(
    client.inventoryDistribution(first, "devices", "vendor"),
  ).rejects.toThrow();
});

it("rejects an events response whose requested entity or window does not match", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(events("technologies")), { status: 200 }),
      ),
  );
  const client = new ApiClient(
    "http://127.0.0.1:8018",
    () => "synthetic",
    vi.fn(),
  );
  await expect(client.inventoryEvents(first, "devices", 90)).rejects.toThrow();
});
