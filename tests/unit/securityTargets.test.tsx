import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { V2SecurityAnalysisPage } from "../../src/pages/V2SecurityAnalysisPage";
import { ApplicationTargets } from "../../src/features/v2/ApplicationTargets";
import {
  isApplicationTargetList,
  isTargetReadiness,
  isWorkspaceTargetList,
} from "../../src/services/v2Contract";
import type { TargetReadiness, WorkspaceTarget } from "../../src/types/v2";

const mock = vi.hoisted(() => ({
  api: {
    v2WorkspaceTargets: vi.fn(),
    v2Targets: vi.fn(),
    authorizeV2Target: vi.fn(),
    v2Verifications: vi
      .fn()
      .mockResolvedValue({
        items: [],
        remote_verification_available: false,
        execution_enabled: false,
        blocking_reasons: [
          "PUBLIC_EGRESS_UNPROVEN",
          "OPERATIONAL_DNS_UNAVAILABLE",
          "WEB_EXECUTOR_DISABLED",
        ],
      }),
  },
}));
vi.mock("../../src/features/auth/context", () => ({
  useAuth: () => ({ api: mock.api, user: { id: "owner" } }),
}));
vi.mock("../../src/features/v2/WorkspaceContext", () => ({
  useWorkspace: () => ({
    selectedId: "workspace",
    current: { name: "Laboratorio" },
  }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function readiness(
  state: TargetReadiness["authorization_state"],
): TargetReadiness {
  return {
    policy_version: "web-public-v1",
    authorization_state: state,
    control_verified: false,
    url_policy_allowed: true,
    execution_enabled: false,
    blocking_reasons: [
      "CONTROL_VERIFICATION_REQUIRED",
      "PINNED_TRANSPORT_UNAVAILABLE",
      "NETWORK_ISOLATION_UNAVAILABLE",
      "WEB_EXECUTOR_DISABLED",
    ],
  };
}

function target(
  status: WorkspaceTarget["authorization_status"],
  index = 1,
): WorkspaceTarget {
  return {
    id: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    application_id: "20000000-0000-4000-8000-000000000001",
    application_name: "Aplicación de prueba",
    application_status: "active",
    url: `https://example.com/${status}`,
    label: null,
    authorization_status: status,
    authorization_expires_at:
      status === "approved" ? "2099-01-01T00:00:00Z" : null,
    authorization_reference:
      status === "approved" ? "Declaración de laboratorio" : null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    analysis_readiness: readiness(
      status === "approved"
        ? "verification_pending"
        : status === "pending"
          ? "registered"
          : status,
    ),
  };
}

function mount(node: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{node}</QueryClientProvider>,
  );
}

it("shows registered, declared, rejected and expired targets without enabling execution", async () => {
  const items = [
    target("pending", 1),
    target("approved", 2),
    target("rejected", 3),
    target("expired", 4),
  ];
  mock.api.v2WorkspaceTargets.mockResolvedValue({
    items,
    page: { limit: 100, offset: 0, total: 4 },
  });
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  mount(<V2SecurityAnalysisPage />);
  const select = await screen.findByRole("combobox", {
    name: "Destino registrado",
  });
  expect(
    screen.getByRole("option", { name: /Pendiente de declaración/ }),
  ).toBeVisible();
  expect(
    screen.getByRole("option", {
      name: /Declaración vigente; control sin verificar/,
    }),
  ).toBeVisible();
  expect(
    screen.getByRole("option", { name: /rechazada o retirada/ }),
  ).toBeVisible();
  expect(
    screen.getByRole("option", { name: /Declaración vencida/ }),
  ).toBeVisible();
  await userEvent.setup().selectOptions(select, items[1].id);
  expect(screen.getByText("Pendiente de verificación técnica")).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent(
    "Declarar la propiedad no prueba el control del dominio",
  );
  const button = screen.getByRole("button", {
    name: "Iniciar análisis Baseline",
  });
  expect(button).toBeDisabled();
  await userEvent.setup().click(button);
  expect(fetch).not.toHaveBeenCalled();
  expect(mock.api.authorizeV2Target).not.toHaveBeenCalled();
  expect(
    screen.getByText(/Genera tráfico y puede afectar al destino/),
  ).toBeVisible();
});

it("keeps execution disabled even if a future response describes verified control", async () => {
  const item = target("approved");
  item.analysis_readiness = {
    ...item.analysis_readiness,
    authorization_state: "verified",
    control_verified: true,
  };
  mock.api.v2WorkspaceTargets.mockResolvedValue({
    items: [item],
    page: { limit: 100, offset: 0, total: 1 },
  });
  mount(<V2SecurityAnalysisPage />);
  const select = await screen.findByRole("combobox", {
    name: "Destino registrado",
  });
  await userEvent.setup().selectOptions(select, item.id);
  expect(
    screen.getByText("Control verificado; ejecución bloqueada"),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Iniciar análisis Baseline" }),
  ).toBeDisabled();
});

it("fails contract validation on missing, inconsistent or enabled readiness", () => {
  const item = target("approved");
  expect(isApplicationTargetList({ items: [item] })).toBe(true);
  expect(
    isWorkspaceTargetList({
      items: [item],
      page: { limit: 100, offset: 0, total: 1 },
    }),
  ).toBe(true);
  expect(isTargetReadiness(undefined)).toBe(false);
  expect(
    isTargetReadiness({ ...item.analysis_readiness, execution_enabled: true }),
  ).toBe(false);
  expect(
    isTargetReadiness({ ...item.analysis_readiness, control_verified: true }),
  ).toBe(false);
  expect(
    isTargetReadiness({ ...item.analysis_readiness, blocking_reasons: [] }),
  ).toBe(false);
  const incomplete = { ...item, analysis_readiness: undefined };
  expect(isApplicationTargetList({ items: [incomplete] })).toBe(false);
});

it.each([
  ["revoked", "Verificación técnica revocada"],
  ["expired", "Autorización expirada; análisis no elegible"],
  ["rejected", "Declaración rechazada o retirada; control sin verificar"],
  ["incomplete", "Datos de autorización incompletos"],
] as const)(
  "shows API verification state %s and keeps execution disabled",
  async (state, label) => {
    const item = target("approved");
    item.analysis_readiness = readiness(state);
    mock.api.v2WorkspaceTargets.mockResolvedValue({
      items: [item],
      page: { limit: 100, offset: 0, total: 1 },
    });
    mount(<V2SecurityAnalysisPage />);
    const select = await screen.findByRole("combobox", {
      name: "Destino registrado",
    });
    await userEvent.setup().selectOptions(select, item.id);
    expect(screen.getByText(label)).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Iniciar análisis Baseline" }),
    ).toBeDisabled();
    expect(mock.api.authorizeV2Target).not.toHaveBeenCalled();
  },
);

it("withdraws a declaration through the existing API with its version and a reason", async () => {
  const item = target("approved");
  mock.api.v2Targets.mockResolvedValue({ items: [item] });
  mock.api.authorizeV2Target.mockResolvedValue(target("rejected"));
  mount(
    <ApplicationTargets
      workspaceId="workspace"
      applicationId="application"
      canWrite
    />,
  );
  const summary = await screen.findByText("Retirar declaración");
  const user = userEvent.setup();
  await user.click(summary);
  await user.type(
    screen.getByRole("textbox", { name: "Motivo de retirada" }),
    "Permiso retirado por el responsable",
  );
  await user.click(screen.getByRole("button", { name: "Confirmar retirada" }));
  await screen.findByRole("status");
  expect(mock.api.authorizeV2Target).toHaveBeenCalledWith(
    "workspace",
    "application",
    item.id,
    {
      authorization_status: "rejected",
      authorization_expires_at: null,
      authorization_reference: "Permiso retirado por el responsable",
      expected_updated_at: item.updated_at,
    },
  );
});

it("does not offer declaration writes to a viewer", async () => {
  mock.api.v2Targets.mockResolvedValue({ items: [target("approved")] });
  mount(
    <ApplicationTargets
      workspaceId="workspace"
      applicationId="application"
      canWrite={false}
    />,
  );
  await screen.findByText("Pendiente de verificación técnica");
  expect(screen.queryByText("Retirar declaración")).not.toBeInTheDocument();
});
