import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient, ApiError } from "../../src/services/api";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const response = (body: unknown, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
describe("API transport boundary", () => {
  it("sends Bearer only to configured FastAPI and encodes query without parameter injection", async () => {
    const fetch = vi.fn().mockResolvedValue(response({ items: [] }));
    vi.stubGlobal("fetch", fetch);
    const client = new ApiClient(
      "http://127.0.0.1:8000",
      () => "synthetic-token",
      vi.fn(),
    );
    await client.candidates("vendor&apiKey=evil");
    const [url, options] = fetch.mock.calls[0];
    expect(new URL(url).searchParams.get("query")).toBe("vendor&apiKey=evil");
    expect(new URL(url).searchParams.has("apiKey")).toBe(false);
    expect(options.headers.Authorization).toBe("Bearer synthetic-token");
    expect(options.credentials).toBe("omit");
    expect(url).not.toContain("synthetic-token");
  });
  it("never puts auth on login and preserves idempotency header and JSON names", async () => {
    const fetch = vi.fn().mockImplementation(async () => response({}));
    vi.stubGlobal("fetch", fetch);
    const client = new ApiClient(
      "https://api.example.test",
      () => "synthetic-token",
      vi.fn(),
    );
    await client.login("username", "synthetic-password");
    expect(fetch.mock.calls[0][1].headers.Authorization).toBeUndefined();
    const body = {
      device_type: "router",
      manufacturer: "Cisco",
      model: "RV340",
      version: null,
      site_label: "LAB",
      inventory_label: null,
      notes: null,
    };
    await client.register(body, "same-key");
    expect(fetch.mock.calls[1][1].headers["Idempotency-Key"]).toBe("same-key");
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual(body);
  });
  it("invalidates authenticated 401 while treating 403 as denied without logout", async () => {
    const expired = vi.fn();
    const client = new ApiClient(
      "http://localhost:8000",
      () => "token",
      expired,
    );
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          response({ error: { code: "INVALID_CREDENTIALS" } }, 401),
        )
        .mockResolvedValueOnce(response({ error: { code: "FORBIDDEN" } }, 403)),
    );
    await expect(client.me()).rejects.toMatchObject({ status: 401 });
    expect(expired).toHaveBeenCalledOnce();
    await expect(client.me()).rejects.toThrow("No tienes permiso");
    expect(expired).toHaveBeenCalledOnce();
  });
  it("does not let a stale 401 expire a newer session", async () => {
    let token = "old";
    const expire = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => {
        token = "new";
        return response({ error: { code: "INVALID_CREDENTIALS" } }, 401);
      }),
    );
    await expect(
      new ApiClient("http://localhost:8000", () => token, expire).me(),
    ).rejects.toBeInstanceOf(ApiError);
    expect(expire).not.toHaveBeenCalled();
  });
  it("normalizes errors, request IDs and cooldown without exposing external text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response(
          {
            error: {
              code: "NVD_UNAVAILABLE",
              message: "sensitive external text",
              request_id: "request-reference",
            },
          },
          503,
          { "Retry-After": "3" },
        ),
      ),
    );
    const client = new ApiClient(
      "http://localhost:8000",
      () => "token",
      vi.fn(),
    );
    await expect(client.candidates("Cisco")).rejects.toMatchObject({
      code: "NVD_UNAVAILABLE",
      requestId: "request-reference",
      retryAfter: 3,
    });
    await expect(client.candidates("Cisco")).rejects.not.toThrow("sensitive");
  });
  it("handles network failure and invalid JSON", async () => {
    const client = new ApiClient("http://localhost:8000", () => null, vi.fn());
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("connection internals")),
    );
    await expect(client.me()).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<html>bad</html>")),
    );
    await expect(client.me()).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });
  it("times out and cancels requests", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(
          (_url, options) =>
            new Promise((_resolve, reject) =>
              options.signal.addEventListener("abort", () =>
                reject(new DOMException("aborted", "AbortError")),
              ),
            ),
        ),
    );
    const client = new ApiClient(
      "http://localhost:8000",
      () => null,
      vi.fn(),
      50,
    );
    const pending = expect(client.me()).rejects.toMatchObject({
      code: "CLIENT_TIMEOUT",
    });
    await vi.advanceTimersByTimeAsync(51);
    await pending;
    const cancelled = expect(client.me()).rejects.toMatchObject({
      name: "AbortError",
    });
    client.abortAll();
    await cancelled;
  });
  it.each([
    "https://user:secret@api.example.test",
    "https://api.example.test/path",
    "http://remote.example.test",
    "https://api.example.test?token=secret",
  ])("rejects unsafe API configuration %s", (base) => {
    expect(() => new ApiClient(base, () => null, vi.fn())).toThrow();
  });
});
