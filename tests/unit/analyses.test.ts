import { sourceTimestamp } from "../../src/features/analyses/presentation";
import { describe, expect, it, vi } from "vitest";
import { ApiClient, ApiError } from "../../src/services/api";
import {
  isRun,
  isFinding,
  isAnalysisList,
  isFindingList,
} from "../../src/services/analysisContract";
import {
  metrics,
  nvdLink,
  httpsReference,
  runLabel,
} from "../../src/features/analyses/presentation";
import { analysisIntents } from "../../src/features/analyses/intents";
import {
  run,
  finding,
  assetId,
  runId,
  findingId,
  timestamp,
  identId,
  userId,
} from "./analysisFixtures";
const page = { limit: 20, offset: 0, total: 1 };
describe("MVP-B contract boundary", () => {
  it("validates the actual run and finding shape", () => {
    expect(isRun(run)).toBe(true);
    expect(isFinding(finding)).toBe(true);
    expect(isAnalysisList({ items: [run], page })).toBe(true);
    expect(
      isFindingList({
        items: [finding],
        page,
        run_status: "completed",
        coverage: "complete",
      }),
    ).toBe(true);
  });
  it.each(["PENDING", "done", ["queued"], null, {}, "confirmed"])(
    "rejects arbitrary analysis state %j",
    (value) => {
      expect(isRun({ ...run, status: value })).toBe(false);
    },
  );
  it("rejects invalid progress and does not equate HTTP success with completion", () => {
    expect(isRun({ ...run, total_results: -1 })).toBe(false);
    expect(isRun({ ...run, coverage: null })).toBe(false);
    expect(isRun({ ...run, status: "running", coverage: "complete" })).toBe(
      false,
    );
    expect(isRun({ ...run, page_count: "1" })).toBe(false);
  });
  it("rejects unsupported applicability and false CVE identifiers", () => {
    expect(isFinding({ ...finding, applicability: "confirmed" })).toBe(false);
    expect(isFinding({ ...finding, external_id: "<script>" })).toBe(false);
  });
  it("uses server total and bounded page metadata", () => {
    expect(isAnalysisList({ items: [run], page: { ...page, total: 41 } })).toBe(
      true,
    );
    expect(
      isFindingList({
        items: [],
        page: { ...page, limit: 101 },
        run_status: "completed",
        coverage: "complete",
      }),
    ).toBe(false);
  });
});
describe("six typed API operations", () => {
  it("uses exact methods, paths, intent header and review timestamp", async () => {
    const responses = [
      { id: runId, accepted_at: timestamp },
      { items: [run], page },
      run,
      { items: [finding], page, run_status: "completed", coverage: "complete" },
      finding,
      finding,
    ];
    const fetch = vi
      .fn()
      .mockImplementation(
        async () => new Response(JSON.stringify(responses.shift())),
      );
    vi.stubGlobal("fetch", fetch);
    const api = new ApiClient(
      "https://api.example.test",
      () => "private-test-token",
      vi.fn(),
    );
    const body = { identification_id: identId };
    const review = {
      status: "reviewed" as const,
      applicability: "undetermined" as const,
      expected_updated_at: timestamp,
      reason: "Motivo",
      evidence: "Evidencia",
    };
    await api.startAnalysis(assetId, body, "same-intent-key");
    await api.analyses(assetId, 20, 20);
    await api.analysis(assetId, runId);
    await api.findings(assetId, runId, 20);
    await api.finding(findingId);
    await api.reviewFinding(findingId, review);
    expect(fetch.mock.calls.map((c) => c[1].method)).toEqual([
      "POST",
      "GET",
      "GET",
      "GET",
      "GET",
      "PATCH",
    ]);
    expect(fetch.mock.calls[0][1].headers["Idempotency-Key"]).toBe(
      "same-intent-key",
    );
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(body);
    expect(JSON.parse(fetch.mock.calls[5][1].body)).toEqual(review);
    expect(fetch.mock.calls[5][1].headers["Idempotency-Key"]).toBeUndefined();
    expect(new URL(fetch.mock.calls[1][0]).searchParams.get("offset")).toBe(
      "20",
    );
    expect(new URL(fetch.mock.calls[3][0]).searchParams.get("limit")).toBe(
      "20",
    );
    expect(
      fetch.mock.calls.every(
        (c) =>
          c[0].startsWith("https://api.example.test/api/v1/") &&
          !c[0].includes("private-test-token"),
      ),
    ).toBe(true);
  });
  it("rejects an invalid successful JSON response without starting another run", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ ...run, status: "COMPLETE" })),
      );
    vi.stubGlobal("fetch", fetch);
    await expect(
      new ApiClient("http://localhost:8000", () => null, vi.fn()).analysis(
        assetId,
        runId,
      ),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("keeps API errors sanitized for review conflicts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { code: "REVIEW_CONFLICT", message: "private SQL" },
          }),
          { status: 409 },
        ),
      ),
    );
    await expect(
      new ApiClient("http://localhost:8000", () => null, vi.fn()).finding(
        findingId,
      ),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
describe("source presentation and safety", () => {
  it("does not merge metrics or treat absence as low severity", () => {
    expect(metrics(null)).toEqual([]);
    const values = metrics({
      ...finding.cvss,
      other: [
        { cvssData: { version: "2.0", baseScore: 5 }, baseSeverity: "MEDIUM" },
      ],
    });
    expect(values.map((m) => m.version)).toEqual(["3.1", "2.0"]);
    expect(
      metrics({ x: [{ cvssData: { version: "3.1", baseScore: 100 } }] }),
    ).toEqual([]);
  });
  it.each([
    "javascript:alert(1)",
    "http://example.org",
    "https://name:secret@example.org",
    "https://example.org/\nnext",
    "invalid",
  ])("does not enable unsafe reference %s", (url) => {
    expect(httpsReference(url)).toBeNull();
  });
  it("constructs official NVD links only from valid IDs", () => {
    expect(nvdLink(finding.external_id)).toBe(
      "https://nvd.nist.gov/vuln/detail/CVE-2017-6784",
    );
    expect(nvdLink("../../evil")).toBeNull();
    expect(httpsReference("https://www.cisco.com/advisory")).toBe(
      "https://www.cisco.com/advisory",
    );
  });
  it.each([
    ["queued", null, "Pendiente"],
    ["running", null, "Procesando"],
    ["completed", "complete", "Completada"],
    ["completed", "partial", "Parcial"],
    ["failed", null, "Fallida"],
  ] as const)("represents %s / %s as %s", (status, coverage, label) =>
    expect(runLabel({ status, coverage })).toBe(label),
  );
  it("retains one logical intent in session memory, scoped by user and asset", () => {
    analysisIntents.clear();
    const intent = {
      key: "stable-key",
      body: { identification_id: identId },
      uncertain: true,
    };
    analysisIntents.set(userId, assetId, intent);
    expect(analysisIntents.get(userId, assetId)).toEqual(intent);
    expect(analysisIntents.get("other", assetId)).toBeNull();
    analysisIntents.clear();
    expect(analysisIntents.get(userId, assetId)).toBeNull();
  });
});

it("interprets raw NVD timestamps without an offset as UTC", () => {
  expect(sourceTimestamp("2017-08-17T20:29:00.823")).toBe(
    "2017-08-17T20:29:00.823Z",
  );
  expect(sourceTimestamp("2017-08-17T20:29:00Z")).toBe("2017-08-17T20:29:00Z");
  expect(sourceTimestamp("invalid")).toBeNull();
});
