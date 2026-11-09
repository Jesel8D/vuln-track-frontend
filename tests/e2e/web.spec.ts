import { test, expect } from "@playwright/test";
import type { Page, APIRequestContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
const username = process.env.TEST_USER!;
const password = process.env.TEST_PASSWORD!;
const api = process.env.E2E_API_URL!;
async function login(page: Page, account = username) {
  await page.goto("/login");
  await page.getByLabel("Usuario", { exact: true }).fill(account);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Inventario con contexto." }),
  ).toBeVisible();
}
async function auth(request: APIRequestContext, account = username) {
  const response = await request.post(api + "/api/v1/auth/login", {
    data: { username: account, password },
  });
  expect(response.status()).toBe(200);
  return { Authorization: "Bearer " + (await response.json()).access_token };
}
async function register(
  request: APIRequestContext,
  headers: Record<string, string>,
  model = "RV340",
) {
  const response = await request.post(api + "/api/v1/assets", {
    headers: { ...headers, "Idempotency-Key": crypto.randomUUID() },
    data: {
      device_type: "router",
      manufacturer: "Cisco",
      model,
      version: null,
      site_label: "LAB-WEB",
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as { id: string };
}
async function search(page: Page, query = "Cisco RV340 firmware") {
  await page.getByLabel("Producto, firmware o sistema operativo").fill(query);
  await page
    .getByRole("button", { name: "Buscar candidatos", exact: true })
    .click();
}
async function select(page: Page, index: number, reason: string) {
  await page.getByRole("radio").nth(index).check();
  await page.getByLabel("Componente principal").selectOption("firmware");
  await page.getByLabel(/Motivo de la decisión/).fill(reason);
  await page
    .getByLabel(
      "Comparé el componente y la versión observada con este candidato.",
    )
    .check();
  await page
    .getByRole("button", { name: "Confirmar identificación", exact: true })
    .click();
  await expect(
    page.getByText(
      "Identificación confirmada. El evento quedó guardado en el historial.",
      { exact: true },
    ),
  ).toBeVisible();
}

test("real login, incorrect credentials, empty dashboard, account, logout and protected routes", async ({
  page,
}) => {
  await page.goto("/activos");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Usuario", { exact: true }).fill(username);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("incorrect-password");
  await page.getByRole("button", { name: "Mostrar contraseña" }).click();
  await expect(page.getByLabel("Contraseña", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page.getByRole("button", { name: "Ocultar contraseña" }).click();
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Usuario o contraseña incorrectos",
  );
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Mis activos", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Tu inventario empieza aquí" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Resumen", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Todo listo para tu primer activo" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Mi cuenta", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Mi cuenta", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: username, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/cuenta");
  await expect(page).toHaveURL(/\/login$/);
});

test("registration, explicit CPE selection, confirmation, review, replacement and immutable history", async ({
  page,
}) => {
  await login(page);
  await page
    .getByRole("link", { name: "Registrar activo", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Guardar activo", exact: true })
    .click();
  await expect(page.getByLabel(/Fabricante/)).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page.getByLabel(/Fabricante/).fill("Cisco");
  await page.getByLabel(/^Modelo/).fill("RV340");
  await page.getByLabel("No la conozco").check();
  await page.getByLabel(/Ubicación o sitio/).fill("LAB-WEB");
  await page.getByLabel(/Etiqueta de inventario/).fill("WEB-01");
  await page
    .getByRole("button", { name: "Guardar activo", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Cisco RV340", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Activo guardado. Puedes continuar con la identificación CPE.",
    ),
  ).toBeVisible();
  await page.getByRole("link", { name: "Buscar candidatos CPE" }).click();
  await search(page);
  await expect(page.getByRole("radio")).toHaveCount(2);
  for (const radio of await page.getByRole("radio").all())
    await expect(radio).not.toBeChecked();
  await select(page, 0, "Comparado con el firmware observado en laboratorio");
  await page.getByRole("link", { name: "Ver historial", exact: true }).click();
  await expect(page.locator(".timeline > li")).toHaveCount(1);
  await page
    .getByRole("link", { name: "Detalle del activo", exact: true })
    .click();
  await page.getByRole("link", { name: "Revisar identificación" }).click();
  await page
    .getByRole("button", { name: "Marcar para revisión", exact: true })
    .click();
  await page
    .getByLabel(/Motivo de la decisión/)
    .fill("Revisar la selección de firmware");
  await page
    .getByRole("button", { name: "Guardar revisión", exact: true })
    .click();
  await expect(
    page.getByText(
      "Identificación marcada para revisión. Se conservó la confirmación anterior en el historial.",
    ),
  ).toBeVisible();
  await search(page);
  await select(page, 1, "Selección corregida después de revisar el componente");
  await page.getByRole("link", { name: "Ver historial", exact: true }).click();
  await expect(page.locator(".timeline > li")).toHaveCount(3);
  await expect(
    page.getByRole("heading", {
      name: "Identificación marcada para revisión",
      exact: true,
    }),
  ).toHaveCount(1);
});
async function loginIfNeeded(page: Page) {
  // Full reload deliberately loses the memory-only session. Preserve the requested route.
  await expect(page).toHaveURL(/\/login$/);
  if (new URL(page.url()).pathname === "/login") {
    await page.getByLabel("Usuario", { exact: true }).fill(username);
    await page.getByLabel("Contraseña", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: "Iniciar sesión", exact: true })
      .click();
    await expect(page).not.toHaveURL(/\/login$/);
  }
}

test("no results, NVD failure, timeout, safe 403 and temporary quota states", async ({
  page,
  request,
}) => {
  const asset = await register(request, await auth(request), "Errores-CPE");
  await login(page);
  await page.getByRole("link", { name: "Mis activos", exact: true }).click();
  await page
    .getByRole("link", { name: "Cisco Errores-CPE", exact: true })
    .click();
  await page.getByRole("link", { name: "Buscar candidatos CPE" }).click();
  await search(page, "sin-coincidencias");
  await expect(
    page.getByRole("heading", { name: "Sin candidatos para esta búsqueda" }),
  ).toBeVisible();
  await search(page, "fallo-nvd");
  await expect(page.getByRole("alert")).toContainText(
    "NVD no está disponible temporalmente",
  );
  await expect(page.getByRole("button", { name: /Esperar/ })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Buscar candidatos", exact: true }),
  ).toBeEnabled({ timeout: 6000 });
  await search(page, "timeout-nvd");
  await expect(page.getByRole("alert")).toContainText("NVD tardó demasiado");
  await page.route("**/api/v1/cpe-candidates?**", (route) =>
    route.fulfill({
      status: 429,
      contentType: "application/json",
      headers: { "Retry-After": "1" },
      body: JSON.stringify({
        error: {
          code: "CPE_RATE_LIMIT",
          request_id: "controlled-test-reference",
        },
      }),
    }),
  );
  await search(page);
  await expect(page.getByRole("alert")).toContainText("límite temporal");
  await page.unroute("**/api/v1/cpe-candidates?**");
  await page.route("**/api/v1/assets?**", (route) =>
    route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "FORBIDDEN" } }),
    }),
  );
  await page.getByRole("link", { name: "Mis activos", exact: true }).click();
  // Re-enter with a fresh cache key to force the explicit denied-state fixture.
  await page.reload();
  await loginIfNeeded(page);
  await expect(page.getByRole("alert")).toContainText("No tienes permiso");
  expect(asset.id).toBeTruthy();
});

test("owner authorization is enforced by FastAPI; forged local role never grants admin", async ({
  page,
  request,
}) => {
  const first = await auth(request);
  const other = await auth(request, process.env.TEST_OTHER_USER!);
  const asset = await register(request, first, "Aislamiento");
  const foreignRead = await request.get(`${api}/api/v1/assets/${asset.id}`, {
    headers: other,
  });
  expect(foreignRead.status()).toBe(404);
  expect(
    (
      await request.get(
        `${api}/api/v1/assets/${asset.id}/cpe-identifications`,
        { headers: other },
      )
    ).status(),
  ).toBe(404);
  expect(
    (
      await request.post(
        `${api}/api/v1/assets/${asset.id}/cpe-identifications`,
        {
          headers: { ...other, "Idempotency-Key": crypto.randomUUID() },
          data: {
            state: "confirmed",
            cpe_name_id: "c817e5ba-62c1-41e7-a15c-fb851fea761e",
            component_kind: "firmware",
            expected_current_id: null,
            reason: "Forbidden test",
          },
        },
      )
    ).status(),
  ).toBe(404);
  await login(page, process.env.TEST_OTHER_USER!);
  await page.getByRole("link", { name: "Mis activos", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Tu inventario empieza aquí" }),
  ).toBeVisible();
  await page.evaluate(() => localStorage.setItem("role", "admin"));
  await page.goto("/admin");
  await loginIfNeededOther(page);
  await expect(
    page.getByRole("heading", { name: "Esta página no está disponible" }),
  ).toBeVisible();
  expect(
    (await request.get(api + "/api/v1/admin", { headers: other })).status(),
  ).toBe(404);
  await page.goto(`/activos/${asset.id}`);
  await loginIfNeededOther(page);
  await expect(page.getByRole("alert")).toContainText(
    "No encontramos este recurso",
  );
});
async function loginIfNeededOther(page: Page) {
  await expect(page).toHaveURL(/\/login$/);
  if (new URL(page.url()).pathname === "/login") {
    await page
      .getByLabel("Usuario", { exact: true })
      .fill(process.env.TEST_OTHER_USER!);
    await page.getByLabel("Contraseña", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: "Iniciar sesión", exact: true })
      .click();
    await expect(page).not.toHaveURL(/\/login$/);
  }
}

test("registration response loss retries the same key and creates exactly one asset", async ({
  page,
  request,
}) => {
  await login(page);
  const keys: string[] = [];
  let loseResponse = true;
  await page.route("**/api/v1/assets", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    keys.push(route.request().headers()["idempotency-key"]);
    const response = await route.fetch();
    if (loseResponse) {
      loseResponse = false;
      await route.abort("failed");
    } else await route.fulfill({ response });
  });
  await page
    .getByRole("link", { name: "Registrar activo", exact: true })
    .first()
    .click();
  await page.getByLabel(/Fabricante/).fill("Cisco");
  await page.getByLabel(/^Modelo/).fill("Idempotencia-Web");
  await page.getByLabel(/Ubicación o sitio/).fill("LAB");
  await page
    .getByRole("button", { name: "Guardar activo", exact: true })
    .click();
  await expect(
    page.getByText(/Conservamos los datos y la clave/),
  ).toBeVisible();
  await expect(page.getByLabel(/^Modelo/)).toBeDisabled();
  await page
    .getByRole("button", { name: "Reintentar el mismo registro" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Cisco Idempotencia-Web", exact: true }),
  ).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  const list = await request.get(api + "/api/v1/assets?limit=100", {
    headers: await auth(request),
  });
  expect(
    (await list.json()).items.filter(
      (item: { model: string }) => item.model === "Idempotencia-Web",
    ),
  ).toHaveLength(1);
  const cpeKeys: string[] = [];
  let loseCpe = true;
  await page.route("**/api/v1/assets/*/cpe-identifications", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    cpeKeys.push(route.request().headers()["idempotency-key"]);
    const response = await route.fetch();
    if (loseCpe) {
      loseCpe = false;
      await route.abort("failed");
    } else await route.fulfill({ response });
  });
  await page.getByRole("link", { name: "Buscar candidatos CPE" }).click();
  await search(page);
  await page.getByRole("radio").nth(0).check();
  await page.getByLabel("Componente principal").selectOption("firmware");
  await page
    .getByLabel(/Motivo de la decisión/)
    .fill("Reconciliación de respuesta perdida");
  await page
    .getByLabel(
      "Comparé el componente y la versión observada con este candidato.",
    )
    .check();
  await page
    .getByRole("button", { name: "Confirmar identificación", exact: true })
    .click();
  await expect(
    page.getByText(/El resultado de este intento es incierto/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reintentar el mismo intento" })
    .click();
  await expect(
    page.getByText(
      "Identificación confirmada. El evento quedó guardado en el historial.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(cpeKeys).toHaveLength(2);
  expect(cpeKeys[0]).toBe(cpeKeys[1]);
  await page.getByRole("link", { name: "Ver historial", exact: true }).click();
  await expect(page.locator(".timeline > li")).toHaveCount(1);
});

test("memory-only session reload, expiration timer and authenticated 401", async ({
  page,
}) => {
  await login(page);
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  expect(await page.evaluate(() => Object.keys(sessionStorage))).toEqual([]);
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
  await page.clock.install();
  await login(page);
  await page.clock.fastForward(61_000);
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("status")).toContainText("Tu sesión terminó");
  await page.clock.resume();
  await login(page);
  await page.route("**/api/v1/assets?**", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "INVALID_CREDENTIALS" } }),
    }),
  );
  await page.getByRole("link", { name: "Mis activos", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("responsive browser visuals, keyboard navigation and basic WCAG checks", async ({
  page,
}) => {
  await mkdir("test-results/visual", { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.name));
  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: "Iniciar sesión", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/visual/login-1440.png",
    fullPage: true,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await login(page);
  await expect(page.getByText("API disponible", { exact: true })).toBeVisible();
  await expect(page.locator(".coverage-label")).toContainText(
    "estados consultados",
  );
  const sizes = [];
  for (const width of [375, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(
      page.getByRole("heading", { name: "Inventario con contexto." }),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/visual/dashboard-${width}.png`,
      fullPage: true,
    });
    const geometry = await page.evaluate(() => ({
      viewport: innerWidth,
      body: document.documentElement.scrollWidth,
    }));
    expect(geometry.body).toBeLessThanOrEqual(width);
    sizes.push({ ...geometry, view: "dashboard" });
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  }
  await page.setViewportSize({ width: 375, height: 900 });
  await page.getByRole("button", { name: "Abrir navegación" }).click();
  await page
    .getByRole("navigation", { name: "Navegación móvil" })
    .getByRole("link", { name: "Mis activos" })
    .click();
  await expect(
    page.getByRole("navigation", { name: "Navegación móvil" }),
  ).not.toBeVisible();
  await page.getByRole("link", { name: "Cisco RV340", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Cisco RV340", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Revisar identificación" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/visual/detail-375.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Revisar identificación" }).click();
  await search(page);
  await expect(page.getByRole("radio")).toHaveCount(2);
  await page.screenshot({
    path: "test-results/visual/candidates-375.png",
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
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.getByRole("radio").nth(0).check();
  await page.screenshot({
    path: "test-results/visual/candidates-1280.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Ver historial", exact: true }).click();
  await page.setViewportSize({ width: 375, height: 900 });
  await expect(page.locator(".timeline > li")).toHaveCount(3);
  await page.screenshot({
    path: "test-results/visual/history-375.png",
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
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe(
    "BODY",
  );
  expect(errors).toEqual([]);
  await writeFile(
    "test-results/visual/responsive.json",
    JSON.stringify(sizes, null, 2),
  );
});
