import { test, expect } from "@playwright/test";
import type { Page, APIRequestContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
const api = process.env.E2E_API_URL!;
const username = process.env.TEST_USER!;
const password = process.env.TEST_PASSWORD!;
const nameId = "c817e5ba-62c1-41e7-a15c-fb851fea761e";
async function auth(request: APIRequestContext, other = false) {
  const res = await request.post(api + "/api/v1/auth/login", {
    data: {
      username: other ? process.env.TEST_OTHER_USER! : username,
      password,
    },
  });
  expect(res.status()).toBe(200);
  return { Authorization: "Bearer " + (await res.json()).access_token };
}
async function asset(
  request: APIRequestContext,
  scenario: string,
  version: string | null = "1.0.0.33",
) {
  const headers = await auth(request);
  const res = await request.post(api + "/api/v1/assets", {
    headers: { ...headers, "Idempotency-Key": crypto.randomUUID() },
    data: {
      device_type: "router",
      manufacturer: "Cisco",
      model: scenario,
      version,
      site_label: "LAB-CVE-TEST",
    },
  });
  expect(res.status()).toBe(201);
  const id = (await res.json()).id as string;
  const confirmation = await request.post(
    `${api}/api/v1/assets/${id}/cpe-identifications`,
    {
      headers: { ...headers, "Idempotency-Key": crypto.randomUUID() },
      data: {
        state: "confirmed",
        cpe_name_id: nameId,
        component_kind: "firmware",
        expected_current_id: null,
        reason: "Fixture controlada: identificación explícita del firmware",
      },
    },
  );
  expect(confirmation.status()).toBe(201);
  return { id, ident: (await confirmation.json()).id as string, headers };
}
async function loginTo(page: Page, path: string, other = false) {
  await page.goto(path);
  await expect(page).toHaveURL(/\/login$/);
  await page
    .getByLabel("Usuario", { exact: true })
    .fill(other ? process.env.TEST_OTHER_USER! : username);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await expect(page).not.toHaveURL(/\/login$/);
}
async function start(page: Page) {
  await page
    .getByRole("button", { name: "Consultar CVE", exact: true })
    .click();
  await page
    .getByLabel("Confirmo consultar CVE para esta identificación.")
    .check();
  await page
    .getByRole("button", { name: "Iniciar consulta NVD", exact: true })
    .click();
  await expect(page).toHaveURL(/\/analisis\/[\da-f-]+$/);
}
async function completed(page: Page) {
  await expect(
    page.getByText(
      "Ejecución finalizada. La actualización automática está detenida.",
      { exact: true },
    ),
  ).toBeVisible({ timeout: 20000 });
}

test("real asset -> confirmed CPE -> worker progress -> CVE evidence -> single human review -> history", async ({
  page,
  request,
}) => {
  const a = await asset(request, "CVE-progress");
  await loginTo(page, `/activos/${a.id}`);
  await expect(
    page.getByRole("heading", { name: "Análisis de vulnerabilidades" }),
  ).toBeVisible();
  await start(page);
  await expect(
    page.getByRole("status").filter({ hasText: /Pendiente|Procesando/ }),
  ).toBeVisible();
  await completed(page);
  await expect(
    page.getByText("Cobertura completa de esta consulta", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "CVE-2017-6784", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "CVE-2017-6784", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Aplicabilidad no determinada", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("CVSS 3.0", { exact: false }).first(),
  ).toBeVisible();
  await page
    .getByText("Configuraciones y condiciones NVD", { exact: true })
    .click();
  await expect(page.locator("pre").first()).toContainText('"operator": "AND"');
  await expect(
    page.getByRole("link", { name: "Ficha oficial NVD" }),
  ).toHaveAttribute("href", "https://nvd.nist.gov/vuln/detail/CVE-2017-6784");
  await page
    .getByLabel("Aplicabilidad tras revisión")
    .selectOption("undetermined");
  await page
    .getByLabel(/Motivo de la revisión/)
    .fill("Falta documentación del hardware requerido");
  await page
    .getByLabel(/Evidencia de la revisión/)
    .fill("El inventario observado solo acredita la versión de firmware");
  await page
    .getByLabel("Confirmo guardar esta revisión única con su evidencia.")
    .check();
  await page
    .getByRole("button", { name: "Guardar revisión del hallazgo" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Hallazgo revisado" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Guardar revisión del hallazgo" }),
  ).toHaveCount(0);
  await expect(page.locator("pre").first()).toContainText('"operator": "AND"');
  await page
    .getByRole("link", { name: "Resultados de la consulta", exact: true })
    .click();
  await expect(page.getByText("Revisado", { exact: true })).toBeVisible();
  await page
    .getByRole("link", { name: "Historial de análisis", exact: true })
    .click();
  await expect(page.locator(".analysis-history-row")).toHaveCount(1);
  await page
    .getByRole("button", { name: /Cerrar sesión/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/login$/);
});

test("partial pages stay partial with real stored CVE and server pagination", async ({
  page,
  request,
}) => {
  const a = await asset(request, "CVE-partial");
  await loginTo(page, `/activos/${a.id}`);
  await start(page);
  await completed(page);
  await expect(
    page.getByText("Cobertura parcial", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "100 entradas recuperadas / 101 informadas · 100 CVE distintos guardados",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.locator(".findings-table tbody tr")).toHaveCount(20);
  await expect(page.getByText("1–20 de 100", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Página siguiente" }).click();
  await expect(page.getByText("21–40 de 100", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "CVE-2026-91020", exact: true }),
  ).toBeVisible();
});

test("valid zero results and failed execution have distinct messages", async ({
  page,
  request,
}) => {
  const empty = await asset(request, "CVE-empty"),
    failed = await asset(request, "CVE-failed");
  await loginTo(page, `/activos/${empty.id}`);
  await start(page);
  await completed(page);
  await expect(
    page.getByRole("heading", {
      name: "Sin CVE recuperados para esta consulta",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Cobertura completa de esta consulta", { exact: true }),
  ).toBeVisible();
  expect(failed.id).toBeTruthy();
  await page.getByRole("link", { name: "Mis activos", exact: true }).click();
  await page
    .getByRole("link", { name: "Cisco CVE-failed", exact: true })
    .click();
  await start(page);
  await completed(page);
  await expect(
    page.getByText("Sin cobertura verificable", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Sin resultados verificables" }),
  ).toBeVisible();
  await expect(page.getByText("Fallida", { exact: true })).toBeVisible();
});

test("CVE without CVSS is never shown as low severity", async ({
  page,
  request,
}) => {
  const a = await asset(request, "CVE-no-cvss");
  await loginTo(page, `/activos/${a.id}`);
  await start(page);
  await completed(page);
  await expect(page.getByText(/Sin métricas CVSS disponibles/)).toBeVisible();
  await page.getByRole("link", { name: "CVE-2017-6784", exact: true }).click();
  await expect(page.getByText(/Sin métricas CVSS disponibles/)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Referencias de origen" }),
  ).toBeVisible();
  await expect(page.getByText("Sin referencias conservadas.")).toBeVisible();
});

test("lost POST acceptance survives route changes and reuses one intent and one run", async ({
  page,
  request,
}) => {
  const a = await asset(request, "CVE-idempotency");
  await loginTo(page, `/activos/${a.id}`);
  let lose = true;
  const keys: string[] = [];
  await page.route(`**/api/v1/assets/${a.id}/analyses`, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    keys.push(route.request().headers()["idempotency-key"]);
    const response = await route.fetch();
    if (lose) {
      lose = false;
      await route.abort("failed");
    } else await route.fulfill({ response });
  });
  await page
    .getByRole("button", { name: "Consultar CVE", exact: true })
    .click();
  await page
    .getByLabel("Confirmo consultar CVE para esta identificación.")
    .check();
  await page
    .getByRole("button", { name: "Iniciar consulta NVD", exact: true })
    .click();
  await expect(
    page.getByText(/No pudimos verificar la aceptación/),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Historial de análisis", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Reintentar el mismo intento" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reintentar el mismo intento" })
    .click();
  await expect(page).toHaveURL(/\/analisis\/[\da-f-]+$/);
  await completed(page);
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  const list = await request.get(`${api}/api/v1/assets/${a.id}/analyses`, {
    headers: a.headers,
  });
  expect((await list.json()).page.total).toBe(1);
});

test("lost PATCH response is reconciled by GET without replay and keeps original evidence", async ({
  page,
  request,
}) => {
  const a = await asset(request, "CVE-review-loss");
  await loginTo(page, `/activos/${a.id}`);
  await start(page);
  await completed(page);
  await page.getByRole("link", { name: "CVE-2017-6784", exact: true }).click();
  let patches = 0;
  await page.route("**/api/v1/findings/*", async (route) => {
    if (route.request().method() !== "PATCH") return route.continue();
    patches++;
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    await route.abort("failed");
  });
  await page
    .getByLabel(/Motivo de la revisión/)
    .fill("Documento técnico revisado");
  await page
    .getByLabel(/Evidencia de la revisión/)
    .fill("Se requiere más información del hardware");
  await page
    .getByLabel("Confirmo guardar esta revisión única con su evidencia.")
    .check();
  await page
    .getByRole("button", { name: "Guardar revisión del hallazgo" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Hallazgo revisado" }),
  ).toBeVisible();
  expect(patches).toBe(1);
  await page
    .getByText("Evidencia almacenada completa", { exact: true })
    .click();
  await expect(page.locator("pre").nth(1)).toContainText(
    '"initial_applicability": "undetermined"',
  );
});

test("review conflict fetches the review already stored by another client", async ({
  page,
  request,
}) => {
  const a = await asset(request, "CVE-review-conflict");
  await loginTo(page, `/activos/${a.id}`);
  await start(page);
  await completed(page);
  await page.getByRole("link", { name: "CVE-2017-6784", exact: true }).click();
  const id = page.url().split("/").at(-1)!;
  const before = await (
    await request.get(`${api}/api/v1/findings/${id}`, { headers: a.headers })
  ).json();
  await page
    .getByLabel(/Motivo de la revisión/)
    .fill("Revisión local obsoleta");
  await page
    .getByLabel(/Evidencia de la revisión/)
    .fill("Sin actualizar todavía");
  await page
    .getByLabel("Confirmo guardar esta revisión única con su evidencia.")
    .check();
  const changed = await request.patch(`${api}/api/v1/findings/${id}`, {
    headers: a.headers,
    data: {
      status: "reviewed",
      applicability: "not_applicable",
      expected_updated_at: before.updated_at,
      reason: "Otra sesión verificó el entorno",
      evidence: "Documento de configuración controlado",
    },
  });
  expect(changed.status()).toBe(200);
  await page
    .getByRole("button", { name: "Guardar revisión del hallazgo" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Hallazgo revisado" }),
  ).toBeVisible();
  await expect(
    page.getByText("Otra sesión verificó el entorno", { exact: true }),
  ).toBeVisible();
});

test("owner checks protect analysis, finding and review from another real user", async ({
  page,
  request,
}) => {
  const a = await asset(request, "CVE-owner");
  const accepted = await request.post(`${api}/api/v1/assets/${a.id}/analyses`, {
    headers: { ...a.headers, "Idempotency-Key": crypto.randomUUID() },
    data: { identification_id: a.ident },
  });
  expect(accepted.status()).toBe(202);
  const run = (await accepted.json()).id;
  const other = await auth(request, true);
  for (const path of [
    `/api/v1/assets/${a.id}/analyses`,
    `/api/v1/assets/${a.id}/analyses/${run}`,
    `/api/v1/assets/${a.id}/analyses/${run}/findings`,
  ])
    expect((await request.get(api + path, { headers: other })).status()).toBe(
      404,
    );
  await loginTo(page, `/activos/${a.id}/analisis/${run}`, true);
  await expect(page.getByRole("alert")).toContainText(
    "No encontramos este recurso",
  );
  const foundUrl = `${api}/api/v1/assets/${a.id}/analyses/${run}/findings`;
  await expect
    .poll(async () => {
      const res = await request.get(foundUrl, { headers: a.headers });
      return (await res.json()).items.length;
    })
    .toBe(1);
  const f = (await (await request.get(foundUrl, { headers: a.headers })).json())
    .items[0];
  expect(
    (
      await request.get(`${api}/api/v1/findings/${f.id}`, { headers: other })
    ).status(),
  ).toBe(404);
  expect(
    (
      await request.patch(`${api}/api/v1/findings/${f.id}`, {
        headers: other,
        data: {
          status: "reviewed",
          applicability: "undetermined",
          expected_updated_at: f.updated_at,
          reason: "Ajeno",
          evidence: "Ajeno",
        },
      })
    ).status(),
  ).toBe(404);
});

test("unknown version blocks a new analysis with an explanatory link", async ({
  page,
  request,
}) => {
  const a = await asset(request, "CVE-unknown", null);
  await loginTo(page, `/activos/${a.id}`);
  await expect(
    page.getByRole("button", { name: "Consultar CVE", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText(/La versión observada es desconocida/),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Ir a identificación CPE" }),
  ).toBeVisible();
});

test("a polling error preserves the last run and recovers with manual refresh", async ({
  page,
  request,
}) => {
  const a = await asset(request, "CVE-progress");
  await loginTo(page, `/activos/${a.id}`);
  let gets = 0;
  let failNext = false;
  await page.route(`**/api/v1/assets/${a.id}/analyses/*`, (route) => {
    if (route.request().url().includes("/findings")) return route.continue();
    gets++;
    if (failNext) {
      failNext = false;
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "DATABASE_UNAVAILABLE" } }),
      });
    }
    return route.continue();
  });
  await start(page);
  await expect(
    page.getByRole("heading", { name: "Identificación utilizada" }),
  ).toBeVisible();
  failNext = true;
  await expect(page.getByRole("alert")).toBeVisible({ timeout: 12000 });
  await expect(
    page.getByRole("heading", { name: "Identificación utilizada" }),
  ).toBeVisible();
  const atError = gets;
  await page.waitForTimeout(4200);
  expect(gets).toBe(atError);
  await page
    .getByRole("button", { name: "Actualizar estado", exact: true })
    .click();
  await completed(page);
  const stopped = gets;
  await page.waitForTimeout(4200);
  expect(gets).toBe(stopped);
});

test("responsive CVE views, accessible table/review and safe escaped evidence", async ({
  page,
  request,
}) => {
  const a = await asset(request, "CVE-many");
  await loginTo(page, `/activos/${a.id}`);
  await start(page);
  await completed(page);
  await mkdir("test-results/cve-visual", { recursive: true });
  const sizes = [];
  const runUrl = page.url();
  for (const width of [375, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(page.locator(".findings-table tbody tr")).toHaveCount(20);
    await page.screenshot({
      path: `test-results/cve-visual/run-${width}.png`,
      fullPage: true,
    });
    await page.screenshot({
      path: `test-results/cve-visual/run-viewport-${width}.png`,
    });
    const geometry = await page.evaluate(() => ({
      viewport: innerWidth,
      body: document.documentElement.scrollWidth,
    }));
    expect(geometry.body).toBeLessThanOrEqual(width);
    sizes.push({ ...geometry, view: "run" });
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  }
  await page.getByRole("link", { name: "CVE-2026-91000", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Revisar el hallazgo" }),
  ).toBeVisible();
  for (const width of [375, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.screenshot({
      path: `test-results/cve-visual/finding-${width}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  }
  await page.setViewportSize({ width: 375, height: 1000 });
  await page
    .getByText("Configuraciones y condiciones NVD", { exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("pre").first()).toBeVisible();
  await page
    .getByRole("link", { name: "Resultados de la consulta", exact: true })
    .click();
  await expect(page).toHaveURL(runUrl);
  await page
    .getByRole("link", { name: "Historial de análisis", exact: true })
    .click();
  await expect(page.locator(".analysis-history-row")).toHaveCount(1);
  await page.screenshot({
    path: "test-results/cve-visual/history-375.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(375);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await writeFile(
    "test-results/cve-visual/responsive.json",
    JSON.stringify(sizes, null, 2),
  );
});
