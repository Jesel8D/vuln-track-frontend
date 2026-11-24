import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { InventoryCoveragePanel } from "../../src/features/v2/InventoryCoverage";
import { isInventoryCoverage } from "../../src/services/v2Contract";
import type { InventoryCoverage } from "../../src/types/v2";
import { App } from "../../src/app/App";

const mock = vi.hoisted(() => ({
  api: { inventoryCoverage: vi.fn() },
  user: { id: "user", username: "Laboratorio" },
  role: "owner",
}));
vi.mock("../../src/features/auth/context", () => ({
  useAuth: () => ({ api: mock.api, user: mock.user, logout: vi.fn() }),
}));
vi.mock("../../src/features/v2/WorkspaceContext", () => ({
  WorkspaceProvider: ({ children }: { children: React.ReactNode }) => children,
  useWorkspace: () => ({
    current: {
      workspace_id: "10000000-0000-4000-8000-000000000001",
      name: "Laboratorio",
      role: mock.role,
    },
    workspaces: [],
    selectedId: "10000000-0000-4000-8000-000000000001",
  }),
}));
vi.mock("../../src/pages/V2DashboardPage", () => ({
  V2DashboardPage: () => <h1>Dashboard operativo</h1>,
}));
const first = "10000000-0000-4000-8000-000000000001";
const second = "10000000-0000-4000-8000-000000000002";
function data(id = first): InventoryCoverage {
  return {
    workspace_id: id,
    scope: "active",
    devices: {
      total: 4,
      confirmed: 2,
      pending: 1,
      needs_review: 1,
      excluded_inactive: 1,
      without_version: 1,
      confirmed_by_mode: { live: 1, fixture: 1, unknown: 0 },
    },
    technologies: {
      total: 3,
      confirmed: 1,
      pending: 2,
      needs_review: 0,
      excluded_inactive: 2,
      confirmation_provenance: "not_recorded",
    },
  };
}
function mount(children: React.ReactNode, path = "/") {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={cache}>
      <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
    </QueryClientProvider>,
  );
}
afterEach(() => {
  vi.resetAllMocks();
  mock.role = "owner";
});

it("shows separate units, exact fractions, exclusions and recorded provenance", async () => {
  mock.api.inventoryCoverage.mockResolvedValue(data());
  mount(<InventoryCoveragePanel workspaceId={first} />);
  const devices = await screen.findByRole("article", {
    name: "Cobertura de dispositivos",
  });
  const technologies = screen.getByRole("article", {
    name: "Cobertura de tecnologías de aplicaciones",
  });
  expect(within(devices).getByText("2 / 4")).toBeVisible();
  expect(within(devices).getByText("50.0%")).toBeVisible();
  expect(
    within(devices).getByText(/oficial 1, fixture 1, sin registrar 0/),
  ).toBeVisible();
  expect(within(technologies).getByText("1 / 3")).toBeVisible();
  expect(within(technologies).getByText("33.3%")).toBeVisible();
  expect(
    within(technologies).getByText(/procedencia se consulta por tecnología/),
  ).toBeVisible();
  expect(screen.getByText(/no demuestra una vulnerabilidad/)).toBeVisible();
  expect(within(devices).getByRole("link")).toHaveAttribute(
    "href",
    "/dispositivos",
  );
  expect(within(technologies).getByRole("link")).toHaveAttribute(
    "href",
    "/aplicaciones",
  );
});

it("empty denominators do not advertise zero risk or divide by zero", async () => {
  const empty = data();
  Object.assign(empty.devices, {
    total: 0,
    confirmed: 0,
    pending: 0,
    needs_review: 0,
    without_version: 0,
    confirmed_by_mode: { live: 0, fixture: 0, unknown: 0 },
  });
  Object.assign(empty.technologies, {
    total: 0,
    confirmed: 0,
    pending: 0,
    needs_review: 0,
  });
  mock.api.inventoryCoverage.mockResolvedValue(empty);
  mount(<InventoryCoveragePanel workspaceId={first} />);
  expect(await screen.findAllByText(/Porcentaje no aplicable/)).toHaveLength(2);
  expect(screen.queryByText("NaN%")).not.toBeInTheDocument();
});

it("errors remain errors and can be retried rather than becoming zero counts", async () => {
  mock.api.inventoryCoverage
    .mockRejectedValueOnce(new Error("unavailable"))
    .mockResolvedValueOnce(data());
  mount(<InventoryCoveragePanel workspaceId={first} />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "No se pudo cargar",
  );
  expect(screen.queryByText("2 / 4")).not.toBeInTheDocument();
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Reintentar cobertura" }));
  expect(await screen.findByText("2 / 4")).toBeVisible();
});

it("workspace change clears the previous display even when the new response is delayed", async () => {
  let resolve!: (value: InventoryCoverage) => void;
  const pending = new Promise<InventoryCoverage>((done) => {
    resolve = done;
  });
  mock.api.inventoryCoverage.mockImplementation((id) =>
    id === first ? Promise.resolve(data()) : pending,
  );
  function Switcher() {
    const [id, select] = useState(first);
    return (
      <>
        <button onClick={() => select(second)}>Cambiar workspace</button>
        <InventoryCoveragePanel workspaceId={id} />
      </>
    );
  }
  mount(<Switcher />);
  await screen.findByText("2 / 4");
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Cambiar workspace" }));
  expect(screen.queryByText("2 / 4")).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Cargando cobertura");
  const next = data(second);
  next.devices.total = 5;
  next.devices.pending = 2;
  resolve(next);
  expect(await screen.findAllByText("2 / 5")).toHaveLength(2);
  await waitFor(() =>
    expect(mock.api.inventoryCoverage).toHaveBeenLastCalledWith(
      second,
      expect.any(AbortSignal),
    ),
  );
});

it.each(["owner", "editor", "viewer"])(
  "keeps the panel read-only for %s",
  async (role) => {
    mock.role = role;
    mock.api.inventoryCoverage.mockResolvedValue(data());
    mount(<InventoryCoveragePanel workspaceId={first} />);
    await screen.findByText("2 / 4");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  },
);

it("validates nonnegative integers, partitions, provenance and denominators", () => {
  expect(isInventoryCoverage(data())).toBe(true);
  for (const change of [
    { total: 100 },
    { confirmed: -1 },
    { pending: 1.2 },
    { without_version: 5 },
    { confirmed_by_mode: { live: 9, fixture: 0, unknown: 0 } },
  ]) {
    const value = data();
    Object.assign(value.devices, change);
    expect(isInventoryCoverage(value)).toBe(false);
  }
  expect(isInventoryCoverage({ ...data(), scope: "all" })).toBe(false);
  expect(isInventoryCoverage({ ...data(), workspace_id: "invalid" })).toBe(
    false,
  );
});

it("preserves /analisis as a controlled redirect and removes future-only navigation", async () => {
  mount(<App />, "/analisis");
  expect(
    await screen.findByRole("heading", { name: "Dashboard operativo" }),
  ).toBeVisible();
  expect(
    screen.queryByRole("link", { name: "Análisis de seguridad" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText("Seguimiento")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Mi cuenta" })).toHaveAttribute(
    "href",
    "/cuenta",
  );
});
