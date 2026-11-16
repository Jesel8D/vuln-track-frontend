import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { loginUi } from "./login";

test("E: loading, controlled network error and real dashboard retry", async ({
  page,
}) => {
  const api = process.env.E2E_API_URL!;
  const user = {
    username: "rc1_error_" + randomBytes(6).toString("hex"),
    password: randomBytes(30).toString("base64url"),
  };
  expect(
    (
      await page.request.post(api + "/api/v1/auth/register", { data: user })
    ).status(),
  ).toBe(201);
  let release = () => {};
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  const matcher = /\/api\/v2\/workspaces\/[^/]+\/dashboard$/;
  await page.route(matcher, async (route) => {
    await delayed;
    await route.abort("connectionfailed");
  });
  try {
    await loginUi(page, user);
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Cargando resumen del workspace" }),
    ).toBeVisible();
    release();
    await expect(
      page.getByRole("heading", { name: "No se pudo cargar el dashboard" }),
    ).toBeVisible();
    expect(await page.locator(".v2-stat-card").count()).toBe(0);
    mkdirSync("test-results-rc1/evidence/create", { recursive: true });
    await page.screenshot({
      path: "test-results-rc1/evidence/create/dashboard-error.png",
      fullPage: true,
    });
    await page.unroute(matcher);
    const response = page.waitForResponse((r) => matcher.test(r.url()));
    await page.getByRole("button", { name: "Reintentar", exact: true }).click();
    const actual = await response;
    expect(actual.status()).toBe(200);
    expect((await actual.json()).summary.applications_total).toBe(0);
    await expect(page.locator(".v2-stat-card")).toHaveCount(4);
  } finally {
    release();
    await page.unroute(matcher);
  }
});
