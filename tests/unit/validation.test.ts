import { describe, expect, it } from "vitest";
import {
  safeReturnPath,
  cpeParts,
  emptyAsset,
  textError,
  validateAsset,
} from "../../src/services/validation";
import { SessionMemory } from "../../src/features/auth/session";
describe("real asset input contract", () => {
  const valid = {
    ...emptyAsset,
    manufacturer: " Cisco ",
    model: "RV340",
    site_label: "LAB",
  };
  it("supports unknown or omitted version without fictitious placeholders", () => {
    expect(validateAsset(valid, false).body.version).toBeNull();
    expect(
      validateAsset({ ...valid, version: "stored draft" }, true).body.version,
    ).toBeNull();
    expect(validateAsset(valid, true).errors).toEqual({});
  });
  it("normalizes NFC and distinguishes required and optional fields", () => {
    expect(
      validateAsset({ ...valid, manufacturer: "Cafe\u0301" }, false).body
        .manufacturer,
    ).toBe("Café");
    expect(validateAsset(emptyAsset, false).errors).toHaveProperty(
      "manufacturer",
    );
    expect(validateAsset(valid, false).body).toEqual({
      device_type: "router",
      manufacturer: "Cisco",
      model: "RV340",
      version: null,
      site_label: "LAB",
      inventory_label: null,
      notes: null,
    });
  });
  it.each(["unknown", "*", "-", "\u0000bad"])(
    "rejects invalid new version %s",
    (version) => {
      expect(validateAsset({ ...valid, version }, false).errors).toHaveProperty(
        "version",
      );
    },
  );
  it("counts Unicode codepoints and rejects control characters", () => {
    expect(textError("🖥".repeat(120), 120)).toBeNull();
    expect(textError("🖥".repeat(121), 120)).not.toBeNull();
    expect(textError("a\nb", 120)).not.toBeNull();
  });
  it("presents escaped CPE components without claiming verification", () => {
    expect(
      cpeParts("cpe:2.3:o:vendor:product\\:name:1.0:*:*:*:*:linux:x86:*"),
    ).toMatchObject({
      part: "o",
      product: "product:name",
      version: "1.0",
      targetSw: "linux",
      targetHw: "x86",
    });
  });
  it("invalidates stale identity requests and clears token memory", () => {
    const session = new SessionMemory();
    const attempt = session.begin();
    session.setToken("synthetic");
    expect(session.isCurrent(attempt)).toBe(true);
    session.invalidate();
    expect(session.isCurrent(attempt)).toBe(false);
    expect(session.getToken()).toBeNull();
  });
});

it.each([
  ["/activos/asset?scope=history", "/activos/asset?scope=history"],
  ["https://evil.invalid", "/"],
  ["//evil.invalid", "/"],
  ["/login?x=1", "/"],
  ["/\\evil.invalid", "/"],
])("constrains post-login navigation %s", (from, expected) => {
  expect(safeReturnPath(from)).toBe(expected);
});
