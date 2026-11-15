import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { TargetVerification } from "../../src/features/v2/TargetVerification";
import { ApiClient, ApiError } from "../../src/services/api";
import {
  isVerificationChallenge,
  isVerificationIssue,
  isVerificationList,
} from "../../src/services/verificationContract";
import type {
  VerificationChallenge,
  VerificationList,
} from "../../src/types/verification";
import type { WorkspaceTarget } from "../../src/types/v2";

const mock = vi.hoisted(() => ({
  api: {
    v2Verifications: vi.fn(),
    issueV2Verification: vi.fn(),
    revokeV2Verification: vi.fn(),
  },
}));
vi.mock("../../src/features/auth/context", () => ({
  useAuth: () => ({ api: mock.api, user: { id: "owner" } }),
}));
const workspace = "30000000-0000-4000-8000-000000000001";
const target: WorkspaceTarget = {
  id: "10000000-0000-4000-8000-000000000001",
  application_id: "20000000-0000-4000-8000-000000000001",
  application_name: "DEMO owned target",
  application_status: "active",
  url: "https://example.com/",
  label: null,
  authorization_status: "approved",
  authorization_expires_at: "2099-01-01T01:00:00Z",
  authorization_reference: "Synthetic declaration",
  created_at: "2099-01-01T00:00:00Z",
  updated_at: "2099-01-01T00:00:00Z",
  analysis_readiness: {
    policy_version: "web-public-v1",
    authorization_state: "verification_pending",
    control_verified: false,
    url_policy_allowed: true,
    execution_enabled: false,
    blocking_reasons: [
      "PINNED_TRANSPORT_UNAVAILABLE",
      "NETWORK_ISOLATION_UNAVAILABLE",
      "WEB_EXECUTOR_DISABLED",
    ],
  },
};
const blockers = [
  "PUBLIC_EGRESS_UNPROVEN",
  "OPERATIONAL_DNS_UNAVAILABLE",
  "WEB_EXECUTOR_DISABLED",
];
function challenge(): VerificationChallenge {
  return {
    id: "50000000-0000-4000-8000-000000000001",
    workspace_id: workspace,
    application_id: target.application_id,
    target_id: target.id,
    method: "https_file",
    origin: "https://example.com",
    state: "pending",
    effective_state: "pending",
    scope_invalidated: false,
    version: 1,
    attempts: 0,
    created_at: "2099-01-01T00:00:00Z",
    expires_at: "2099-01-01T00:10:00Z",
    consumed_at: null,
    verified_at: null,
    revoked_at: null,
    result_code: "NOT_CHECKED",
    control_verified: false,
    remote_verification_available: false,
    execution_enabled: false,
    blocking_reasons: blockers,
    evidence: [],
  };
}
function listing(items: VerificationChallenge[] = []): VerificationList {
  return {
    items,
    remote_verification_available: false,
    execution_enabled: false,
    blocking_reasons: blockers,
  };
}
function mount(canWrite = true) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      <TargetVerification
        workspaceId={workspace}
        target={target}
        canWrite={canWrite}
      />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  mock.api.v2Verifications.mockResolvedValue(listing());
});
afterEach(() => vi.unstubAllGlobals());

it("issues once, shows one-time instructions and never claims domain control", async () => {
  const record = challenge();
  const body = `vulntrack-domain-control-https-v1:${record.id}:${"A".repeat(43)}`;
  mock.api.issueV2Verification.mockImplementation(async () => {
    mock.api.v2Verifications.mockResolvedValue(listing([record]));
    return {
      challenge: record,
      created: true,
      instructions: {
        url: `${record.origin}/.well-known/vulntrack-verification/${record.id}`,
        body,
      },
    };
  });
  mount();
  await screen.findByText("Sin desafíos registrados.");
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Emitir desafío" }));
  expect(
    await screen.findByLabelText("Contenido del archivo de desafío"),
  ).toHaveValue(body);
  expect(await screen.findByText("Desafío pendiente")).toBeVisible();
  expect(screen.getByRole("button", { name: "Emitir desafío" })).toBeDisabled();
  expect(screen.queryByText("Control verificado")).not.toBeInTheDocument();
  expect(mock.api.issueV2Verification).toHaveBeenCalledWith(
    workspace,
    target.application_id,
    target.id,
    target.updated_at,
    expect.any(String),
  );
});
it("retries the same idempotency key and handles an unrecoverable token without inventing it", async () => {
  mock.api.issueV2Verification
    .mockRejectedValueOnce(new ApiError(0, "TIMEOUT", "Tiempo agotado"))
    .mockResolvedValueOnce({
      challenge: challenge(),
      created: false,
      instructions: null,
    });
  mount();
  await screen.findByText("Sin desafíos registrados.");
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Emitir desafío" }));
  await screen.findByText("Tiempo agotado");
  await user.click(screen.getByRole("button", { name: "Emitir desafío" }));
  expect(
    await screen.findByText(/su token no puede recuperarse/),
  ).toBeVisible();
  expect(mock.api.issueV2Verification.mock.calls[0][4]).toBe(
    mock.api.issueV2Verification.mock.calls[1][4],
  );
  expect(
    screen.queryByLabelText("Contenido del archivo de desafío"),
  ).not.toBeInTheDocument();
});
it("revokes with the current version and refreshes actual metadata", async () => {
  const record = challenge();
  mock.api.v2Verifications.mockResolvedValue(listing([record]));
  mock.api.revokeV2Verification.mockImplementation(async () => {
    mock.api.v2Verifications.mockResolvedValue(
      listing([
        {
          ...record,
          state: "revoked",
          effective_state: "revoked",
          version: 2,
          revoked_at: "2099-01-01T00:01:00Z",
        },
      ]),
    );
  });
  mount();
  await screen.findByText("Desafío pendiente");
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Revocar desafío" }));
  expect(await screen.findByText("Desafío revocado")).toBeVisible();
  expect(mock.api.revokeV2Verification).toHaveBeenCalledWith(
    workspace,
    target.application_id,
    target.id,
    record.id,
    1,
  );
});
it.each([
  ["expired", "Desafío expirado"],
  ["failed", "Verificación fallida"],
  ["unavailable", "Verificación temporalmente no disponible"],
] as const)("shows real API effective state %s", async (state, label) => {
  const record = challenge();
  record.effective_state = state;
  mock.api.v2Verifications.mockResolvedValue(listing([record]));
  mount();
  expect(await screen.findByText(label)).toBeVisible();
});
it("labels laboratory evidence explicitly and offers no writes to viewers", async () => {
  const record = challenge();
  record.state = "failed";
  record.effective_state = "failed";
  record.attempts = 1;
  record.consumed_at = record.created_at;
  record.evidence = [
    {
      id: "60000000-0000-4000-8000-000000000001",
      provenance: "laboratory",
      started_at: record.created_at,
      completed_at: record.created_at,
      outcome: "laboratory_match",
    },
  ];
  mock.api.v2Verifications.mockResolvedValue(listing([record]));
  mount(false);
  expect(
    await screen.findByText("Evidencia de laboratorio; sin verificación real"),
  ).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Emitir desafío" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Revocar desafío" }),
  ).not.toBeInTheDocument();
});
it("shows temporary storage errors without enabling issuance", async () => {
  mock.api.v2Verifications.mockRejectedValue(
    new ApiError(503, "DATABASE_SCHEMA_NOT_READY", "Esquema no disponible"),
  );
  mount();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Verificación temporalmente no disponible",
  );
  expect(screen.getByRole("button", { name: "Emitir desafío" })).toBeDisabled();
});
it("rejects enabled, forged, plaintext or malformed verification responses", () => {
  const row = challenge();
  expect(isVerificationChallenge(row)).toBe(true);
  expect(isVerificationChallenge({ ...row, execution_enabled: true })).toBe(
    false,
  );
  expect(isVerificationChallenge({ ...row, control_verified: true })).toBe(
    false,
  );
  expect(
    isVerificationChallenge({ ...row, verified_at: "2099-01-01T00:01:00Z" }),
  ).toBe(false);
  expect(
    isVerificationChallenge({ ...row, proof_sha256: "a".repeat(64) }),
  ).toBe(false);
  expect(
    isVerificationList({ ...listing(), remote_verification_available: true }),
  ).toBe(false);
  expect(
    isVerificationIssue({
      challenge: row,
      created: true,
      instructions: { url: "https://other.example.com/", body: "wrong" },
    }),
  ).toBe(false);
});
it("rejects a response from another workspace even when its schema is valid", async () => {
  const row = {
    ...challenge(),
    workspace_id: "30000000-0000-4000-8000-000000000002",
  };
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(listing([row])), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
  );
  const client = new ApiClient(
    "http://127.0.0.1:8000",
    () => "synthetic-token",
    vi.fn(),
  );
  await expect(
    client.v2Verifications(workspace, target.application_id, target.id),
  ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
});
