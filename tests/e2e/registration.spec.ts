import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

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
