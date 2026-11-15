import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { ApplicationTarget } from "../../src/types/v2";

const api = process.env.E2E_API_URL!;
const account = () => ({
  username: "web_" + randomBytes(8).toString("hex"),
  password: randomBytes(24).toString("base64url"),
});
async function fill(page: Page, identity: ReturnType<typeof account>) {
  await page.getByLabel("Usuario", { exact: true }).fill(identity.username);
  await page.getByLabel("Contraseña", { exact: true }).fill(identity.password);
  await page.getByLabel("Confirmar contraseña").fill(identity.password);
}
async function register(page: Page, identity: ReturnType<typeof account>) {
  await page.goto("/crear-cuenta");
  await fill(page, identity);
  const response = page.waitForResponse(
    (row) =>
      row.url() === api + "/api/v1/auth/register" &&
      row.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  expect((await response).status()).toBe(201);
  await expect(
    page.getByRole("heading", { name: "Cuenta creada" }),
  ).toBeVisible();
}
async function login(page: Page, identity: ReturnType<typeof account>) {
  await page.goto("/login");
  await page.getByLabel("Usuario", { exact: true }).fill(identity.username);
  await page.getByLabel("Contraseña", { exact: true }).fill(identity.password);
  const request = page.waitForRequest(
    (row) => row.url() === api + "/api/v1/auth/me",
  );
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  const authorization = (await request).headers().authorization;
  await expect(
    page.getByRole("heading", {
      name: "Personal de " + identity.username,
      exact: true,
    }),
  ).toBeVisible();
  return authorization;
}

test("public registration, verified login, empty workspace and logout", async ({
  page,
}) => {
  const identity = account();
  await page.goto("/login");
  await page.getByRole("link", { name: "Crear cuenta", exact: true }).click();
  await fill(page, identity);
  await page.getByLabel("Confirmar contraseña").fill(identity.password + "x");
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Las contraseñas no coinciden",
  );
  await page.getByLabel("Confirmar contraseña").fill(identity.password);
  await page.getByRole("button", { name: "Mostrar contraseñas" }).click();
  await expect(page.getByLabel("Contraseña", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Cuenta creada" }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Ir a iniciar sesión/ }).click();
  const authorization = await login(page, identity);
  const dashboard = await page.request.get(api + "/api/v2/workspaces", {
    headers: { Authorization: authorization },
  });
  expect(dashboard.status()).toBe(200);
  const workspace = (await dashboard.json()).items;
  expect(workspace).toHaveLength(1);
  const metrics = await page.request.get(
    api + `/api/v2/workspaces/${workspace[0].workspace_id}/dashboard`,
    { headers: { Authorization: authorization } },
  );
  expect(
    Object.values((await metrics.json()).summary).every((value) => value === 0),
  ).toBeTruthy();
  await page.getByRole("link", { name: "Aplicaciones", exact: true }).click();
  await expect(
    page.getByText("Aún no hay aplicaciones en este workspace"),
  ).toBeVisible();
  await page.getByRole("link", { name: "Historial", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Aún no hay análisis registrados" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Análisis de seguridad", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Iniciar análisis Baseline" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/aplicaciones");
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
});

test("server rejects common passwords and duplicate accounts without false success", async ({
  page,
}) => {
  const identity = account();
  await page.goto("/crear-cuenta");
  await fill(page, { ...identity, password: "Password123456789!" });
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Revisa los campos");
  await register(page, identity);
  await page.goto("/crear-cuenta");
  await fill(page, identity);
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Prueba otro usuario o intenta iniciar sesión",
  );
  await expect(
    page.getByRole("heading", { name: "Cuenta creada" }),
  ).toHaveCount(0);
});

test("two new users have separate resources and session caches", async ({
  page,
}) => {
  const first = account(),
    second = account();
  await register(page, first);
  const firstToken = await login(page, first);
  const directory = await page.request.get(api + "/api/v2/workspaces", {
    headers: { Authorization: firstToken },
  });
  const firstWorkspace = (await directory.json()).items[0].workspace_id;
  await page.getByRole("link", { name: "Aplicaciones", exact: true }).click();
  await page
    .getByRole("button", { name: "Registrar aplicación", exact: true })
    .first()
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Nombre", { exact: true })
    .fill("Private application A");
  const created = page.waitForResponse(
    (row) =>
      row.request().method() === "POST" &&
      row.url() === api + `/api/v2/workspaces/${firstWorkspace}/applications`,
  );
  await page
    .getByRole("button", { name: "Guardar aplicación", exact: true })
    .click();
  expect((await created).status()).toBe(201);
  await expect(
    page.getByRole("link", { name: "Private application A", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Private application A", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Aún no hay tecnologías registradas" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await register(page, second);
  const secondToken = await login(page, second);
  const foreign = await page.request.get(
    api + `/api/v2/workspaces/${firstWorkspace}/applications`,
    { headers: { Authorization: secondToken } },
  );
  expect(foreign.status()).toBe(404);
  await page.getByRole("link", { name: "Aplicaciones", exact: true }).click();
  await expect(
    page.getByText("Aún no hay aplicaciones en este workspace"),
  ).toBeVisible();
  await expect(
    page.getByText("Private application A", { exact: true }),
  ).toHaveCount(0);
});

test("registration is responsive and has basic accessible form semantics", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/crear-cuenta");
  await expect(
    page.getByRole("heading", { name: "Crear cuenta", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: "test-results/registration-375.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});

test("security preparation uses real declarations and stays blocked on desktop and mobile", async ({
  page,
}) => {
  const identity = account();
  await register(page, identity);
  const authorization = await login(page, identity);
  const headers = { Authorization: authorization };
  const directory = await page.request.get(api + "/api/v2/workspaces", {
    headers,
  });
  const workspace = (await directory.json()).items[0].workspace_id;
  const created = await page.request.post(
    api + `/api/v2/workspaces/${workspace}/applications`,
    {
      headers,
      data: { name: "DEMO security phase1 - disposable only" },
    },
  );
  expect(created.status()).toBe(201);
  const application = (await created.json()).id;
  const base =
    api + `/api/v2/workspaces/${workspace}/applications/${application}/targets`;
  const targets: ApplicationTarget[] = [];
  for (const label of [
    "Pending laboratory declaration",
    "Declared laboratory target",
    "Withdrawn laboratory declaration",
  ]) {
    const response = await page.request.post(base, {
      headers,
      data: { url: "https://example.com/", label },
    });
    expect(response.status()).toBe(201);
    targets.push(await response.json());
  }
  for (const index of [1, 2]) {
    const response = await page.request.patch(
      base + `/${targets[index].id}/authorization`,
      {
        headers,
        data: {
          authorization_status: "approved",
          authorization_expires_at: new Date(
            Date.now() + 3600_000,
          ).toISOString(),
          authorization_reference:
            "Synthetic declaration in disposable test; never authorizes a scan",
          expected_updated_at: targets[index].updated_at,
        },
      },
    );
    expect(response.status()).toBe(200);
    targets[index] = await response.json();
    expect(targets[index].analysis_readiness.control_verified).toBe(false);
  }
  expect(
    (
      await page.request.patch(base + `/${targets[2].id}/authorization`, {
        headers,
        data: {
          authorization_status: "rejected",
          authorization_expires_at: null,
          authorization_reference: "Laboratory declaration withdrawn",
          expected_updated_at: targets[2].updated_at,
        },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await page.request.post(base, {
        headers,
        data: { url: "http://127.0.0.1:8080/" },
      })
    ).status(),
  ).toBe(422);
  const external: string[] = [];
  const webOrigin = new URL(page.url()).origin;
  page.on("request", (request) => {
    const origin = new URL(request.url()).origin;
    if (origin !== webOrigin && origin !== new URL(api).origin)
      external.push(origin);
  });
  await page
    .getByRole("link", { name: "Análisis de seguridad", exact: true })
    .click();
  const select = page.getByRole("combobox", { name: "Destino registrado" });
  await expect(select.getByRole("option")).toHaveCount(4);
  await expect(
    select.getByRole("option", { name: /Pendiente de declaración/ }),
  ).toHaveCount(1);
  await expect(
    select.getByRole("option", { name: /rechazada o retirada/ }),
  ).toHaveCount(1);
  await select.selectOption(targets[1].id);
  await expect(page.getByRole("status")).toContainText(
    "Control del destino sin verificar",
  );
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(
      page.getByRole("button", { name: "Iniciar análisis Baseline" }),
    ).toBeDisabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: `test-results/security-phase1-${width}.png`,
      fullPage: true,
    });
  }
  expect(external).toEqual([]);
});

test("real registration throttling is displayed with retry guidance", async ({
  page,
}) => {
  for (let attempt = 0; attempt < 11; attempt++) {
    const result = await page.request.post(api + "/api/v1/auth/register", {
      data: {},
    });
    if (result.status() === 429) break;
    expect(result.status()).toBe(422);
  }
  await page.goto("/crear-cuenta");
  await fill(page, account());
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("60 segundos");
  await expect(
    page.getByRole("heading", { name: "Cuenta creada" }),
  ).toHaveCount(0);
});
