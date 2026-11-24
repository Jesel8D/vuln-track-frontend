import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { loginUi as login } from "./login";

type Identity = { username: string; password: string };
const statePath = process.env.RC1_STATE_FILE!;
const state = () => JSON.parse(readFileSync(statePath, "utf8"));
const api = process.env.E2E_API_URL!;
const cpe =
  "cpe:2.3:o:cisco:small_business_rv340_firmware:1.0.0.33:*:*:*:*:*:*:*";
const measure =
  "DEMO: revisar el aviso capturado y las condiciones AND; no concluir vulnerabilidad en un sistema real.";
const save = (value: ReturnType<typeof state>) =>
  writeFileSync(statePath, JSON.stringify(value, null, 2), { mode: 0o600 });
const evidence =
  process.env.RC1_EVIDENCE_DIR ?? "test-results-rc1/evidence/create";
mkdirSync(evidence, { recursive: true });
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  const origin = new URL(test.info().project.use.baseURL!).origin;
  await page.route("**/*", async (route) => {
    const value = new URL(route.request().url());
    if (![origin, new URL(api).origin].includes(value.origin)) {
      await route.abort();
      throw new Error("External browser request forbidden in RC1");
    }
    await route.continue();
  });
});

async function register(page: Page, user: Identity) {
  await page.goto("/crear-cuenta");
  await page.getByLabel("Usuario", { exact: true }).fill(user.username);
  await page.getByLabel("Contraseña", { exact: true }).fill(user.password);
  await page.getByLabel("Confirmar contraseña").fill(user.password);
  const response = page.waitForResponse(
    (r) =>
      r.url() === api + "/api/v1/auth/register" &&
      r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  expect((await response).status()).toBe(201);
  await expect(
    page.getByRole("heading", { name: "Cuenta creada" }),
  ).toBeVisible();
}

async function navigate(page: Page, name: string) {
  await page.locator(".v2-topbar").waitFor({ state: "visible" });
  const menu = page.getByRole("button", { name: "Abrir menú" });
  if (await menu.isVisible()) await menu.click();
  await page
    .getByRole("link", { name, exact: true })
    .filter({ visible: true })
    .click();
}

test("A: new normal user sees explicit fixture provenance", async ({
  page,
}) => {
  const data = state();
  await register(page, data.primary);
  const authorization = await login(page, data.primary);
  await expect(
    page.getByRole("note", { name: "Datos de demostración" }),
  ).toBeVisible();
  const directory = await page.request.get(api + "/api/v2/workspaces", {
    headers: { Authorization: authorization },
  });
  const items = (await directory.json()).items;
  expect(items).toHaveLength(1);
  expect(items[0].role).toBe("owner");
  const workspace = items[0].workspace_id;
  const dashboard = await page.request.get(
    api + `/api/v2/workspaces/${workspace}/dashboard`,
    { headers: { Authorization: authorization } },
  );
  expect(
    Object.values((await dashboard.json()).summary).every(
      (value) => value === 0,
    ),
  ).toBeTruthy();
  save({ ...data, workspace, fixture_notice_verified: true });
});

test("A: application, URL, explicit CPE, worker CVE, review, recommendations and history", async ({
  page,
}) => {
  const data = state();
  const authorization = await login(page, data.primary);
  const headers = { Authorization: authorization };
  const root = api + `/api/v2/workspaces/${data.workspace}/applications`;
  await page.getByRole("link", { name: "Aplicaciones", exact: true }).click();
  await page
    .getByRole("button", { name: "Registrar aplicación", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Nombre", { exact: true })
    .fill("DEMO RC1 - Portal de laboratorio");
  await dialog
    .getByLabel("Descripción", { exact: false })
    .fill(
      "FICTICIO. Producto de fixture capturado; no representa un dispositivo o sitio real.",
    );
  const applicationResponse = page.waitForResponse(
    (r) => r.url() === root && r.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "Guardar aplicación" }).click();
  const appHTTP = await applicationResponse;
  expect(appHTTP.status()).toBe(201);
  const application = await appHTTP.json();
  await page.getByRole("link", { name: application.name, exact: true }).click();
  const base = root + "/" + application.id;
  await page
    .getByLabel("URL base", { exact: true })
    .fill("https://example.com/rc1-demo");
  await page
    .getByLabel("Etiqueta", { exact: false })
    .fill("FICTICIA - referencia de inventario, sin conexión");
  const targetResponse = page.waitForResponse(
    (r) => r.url() === base + "/targets" && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Agregar URL" }).click();
  expect((await targetResponse).status()).toBe(201);
  await page
    .getByRole("button", { name: "Agregar tecnología", exact: true })
    .click();
  const technologyDialog = page.getByRole("dialog");
  await technologyDialog
    .getByLabel("Producto", { exact: true })
    .fill("small_business_rv340_firmware");
  await technologyDialog
    .getByLabel("Fabricante", { exact: false })
    .fill("cisco");
  await technologyDialog
    .getByLabel("Versión observada", { exact: true })
    .fill("1.0.0.33");
  const technologyResponse = page.waitForResponse(
    (r) =>
      r.url() === base + "/technologies" && r.request().method() === "POST",
  );
  await technologyDialog
    .getByRole("button", { name: "Registrar tecnología" })
    .click();
  const technologyHTTP = await technologyResponse;
  expect(technologyHTTP.status()).toBe(201);
  const technology = await technologyHTTP.json();
  await page.getByLabel("Tipo de CPE").selectOption("o");
  await page.getByLabel("Fuente CPE").selectOption("fixture");
  await page
    .getByLabel("Buscar candidatos en el catálogo CPE de NVD")
    .fill("RV340");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await page.getByRole("radio").check();
  const confirmResponse = page.waitForResponse(
    (r) =>
      r.url().endsWith("/technologies/" + technology.id + "/cpe") &&
      r.request().method() === "PUT",
  );
  await page
    .getByRole("button", { name: "Confirmar CPE", exact: true })
    .click();
  expect((await confirmResponse).status()).toBe(200);
  await expect(page.getByText("CPE confirmado", { exact: true })).toBeVisible();
  const runResponse = page.waitForResponse(
    (r) =>
      r.url().endsWith("/technologies/" + technology.id + "/analyses") &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Consultar CVE", exact: true })
    .click();
  const accepted = await runResponse;
  expect(accepted.status()).toBe(201);
  const acceptedRun = await accepted.json();
  await expect
    .poll(
      async () =>
        (
          await (
            await page.request.get(base + "/analyses/" + acceptedRun.id, {
              headers,
            })
          ).json()
        ).status,
      { timeout: 25000 },
    )
    .toBe("completed");
  await expect(
    page.getByRole("link", { name: "CVE-2017-6784", exact: true }),
  ).toBeVisible({ timeout: 15000 });
  const found = await page.request.get(
    base + "/analyses/" + acceptedRun.id + "/findings",
    { headers },
  );
  const finding = (await found.json()).items[0];
  expect(finding.applicability).toBe("undetermined");
  await page
    .getByRole("combobox", { name: "Resultado de la revisión", exact: true })
    .selectOption("undetermined");
  const reviewResponse = page.waitForResponse(
    (r) =>
      r.url() === base + "/findings/" + finding.id &&
      r.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: "Guardar revisión" }).click();
  const reviewedHTTP = await reviewResponse;
  expect(reviewedHTTP.status()).toBe(200);
  const reviewed = await reviewedHTTP.json();
  expect(reviewed.applicability).toBe("undetermined");
  expect(reviewed.status).toBe("reviewed");
  await page.locator("details.v2-recommendations > summary").click();
  await page.getByLabel("Medida recomendada").fill(measure);
  const recommendationResponse = page.waitForResponse(
    (r) =>
      r.url().endsWith("/findings/" + finding.id + "/recommendations") &&
      r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Agregar medida" }).click();
  const recommendationHTTP = await recommendationResponse;
  expect(recommendationHTTP.status()).toBe(201);
  const recommendation = await recommendationHTTP.json();
  await expect(page.getByText(measure, { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Historial", exact: true }).click();
  await page
    .getByRole("button", { name: "Ver resultados", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "CVE-2017-6784", exact: true }),
  ).toBeVisible();
  await page.locator("details.v2-recommendations > summary").click();
  await expect(page.getByText(measure, { exact: true })).toBeVisible();
  await page.screenshot({
    path: evidence + "/history-reviewed-1440.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  const dashboardResponse = await (
    await page.request.get(
      api + `/api/v2/workspaces/${data.workspace}/dashboard`,
      { headers },
    )
  ).json();
  const dashboard = dashboardResponse.summary;
  expect(dashboard.applications_total).toBe(1);
  expect(dashboard.analyses_total).toBe(1);
  expect(dashboard.findings_open).toBe(0);
  await expect(page.locator(".v2-stat-card > strong")).toHaveText([
    String(dashboard.applications_total),
    String(dashboard.analyses_total),
    String(dashboard.findings_open),
    String(dashboard.critical_open + dashboard.high_open),
  ]);
  await expect(page.locator(".v2-trend-labels > span")).toHaveText(
    dashboardResponse.analysis_trend.map(
      (row: { month: string; analyses: number }) =>
        new Date(row.month).toLocaleDateString("es-MX", {
          month: "short",
          timeZone: "UTC",
        }) + row.analyses,
    ),
  );
  await page.screenshot({
    path: evidence + "/dashboard-1440.png",
    fullPage: true,
  });
  const confirmed = (
    await (await page.request.get(base + "/technologies", { headers })).json()
  ).items[0];
  expect(confirmed.selected_cpe).toBe(cpe);
  const run = await (
    await page.request.get(base + "/analyses/" + acceptedRun.id, { headers })
  ).json();
  save({
    ...data,
    dataset: {
      application,
      technology: confirmed,
      run,
      finding: reviewed,
      recommendation,
      measure,
    },
  });
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await login(page, data.primary);
  await page.getByRole("link", { name: "Aplicaciones", exact: true }).click();
  await expect(
    page.getByRole("link", { name: application.name, exact: true }),
  ).toBeVisible();
});

test("C: two normal users cannot cross IDs, roles or session caches", async ({
  page,
}) => {
  const data = state();
  await register(page, data.secondary);
  const secondaryToken = await login(page, data.secondary);
  const headers = { Authorization: secondaryToken };
  const directory = await page.request.get(api + "/api/v2/workspaces", {
    headers,
  });
  const secondWorkspace = (await directory.json()).items[0].workspace_id;
  expect(secondWorkspace).not.toBe(data.workspace);
  const foreign =
    api +
    `/api/v2/workspaces/${data.workspace}/applications/${data.dataset.application.id}`;
  for (const suffix of [
    "/technologies",
    "/analyses",
    "/targets",
    "/analyses/" + data.dataset.run.id + "/findings",
    "/findings/" + data.dataset.finding.id + "/recommendations",
  ]) {
    expect(
      (await page.request.get(foreign + suffix, { headers })).status(),
    ).toBe(404);
  }
  expect(
    (
      await page.request.patch(
        foreign + "/findings/" + data.dataset.finding.id,
        {
          headers,
          data: {
            applicability: "potential",
            expected_updated_at: data.dataset.finding.updated_at,
          },
        },
      )
    ).status(),
  ).toBe(404);
  const own = api + `/api/v2/workspaces/${secondWorkspace}/applications`;
  expect(
    (
      await page.request.post(own, {
        headers,
        data: {
          name: "forged role",
          role: "owner",
          workspace_id: data.workspace,
        },
      })
    ).status(),
  ).toBe(422);
  const created = await page.request.post(own, {
    headers,
    data: { name: "DEMO RC1 - privada B" },
  });
  expect(created.status()).toBe(201);
  const secondApplication = await created.json();
  await page.getByRole("link", { name: "Aplicaciones", exact: true }).click();
  await expect(
    page.getByText(data.dataset.application.name, { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  const firstToken = await login(page, data.primary);
  expect(
    (
      await page.request.get(
        own + "/" + secondApplication.id + "/technologies",
        { headers: { Authorization: firstToken } },
      )
    ).status(),
  ).toBe(404);
  for (let i = 0; i < 12; i++) {
    expect(
      (
        await page.request.get(
          api + `/api/v2/workspaces/${data.workspace}/applications`,
          { headers },
        )
      ).status(),
    ).toBe(404);
    expect(
      (
        await page.request.get(
          api + `/api/v2/workspaces/${data.workspace}/applications`,
          { headers: { Authorization: firstToken } },
        )
      ).status(),
    ).toBe(200);
  }
  save({
    ...data,
    secondaryWorkspace: secondWorkspace,
    secondaryApplication: secondApplication.id,
  });
});

test("D: real challenge revocation and expiry never enable web execution", async ({
  page,
}) => {
  const data = state();
  const token = await login(page, data.primary);
  const headers = { Authorization: token };
  const base =
    api +
    `/api/v2/workspaces/${data.workspace}/applications/${data.dataset.application.id}/targets`;
  const create = async (label: string, seconds: number) => {
    const response = await page.request.post(base, {
      headers,
      data: { url: "https://example.com/rc1-security", label },
    });
    expect(response.status()).toBe(201);
    const row = await response.json();
    const approved = await page.request.patch(
      base + "/" + row.id + "/authorization",
      {
        headers,
        data: {
          authorization_status: "approved",
          authorization_reference:
            "DEMO fixture only; never operational scan permission",
          authorization_expires_at: new Date(
            Date.now() + seconds * 1000,
          ).toISOString(),
          expected_updated_at: row.updated_at,
        },
      },
    );
    expect(approved.status()).toBe(200);
    return approved.json();
  };
  const current = await create("DEMO RC1 revocación", 3600);
  await page.goto("/aplicaciones/" + data.dataset.application.id);
  const targetCard = page
    .locator(".v2-target-item")
    .filter({ hasText: current.label });
  await targetCard
    .getByText("Desafío de control (sin comprobación remota)", { exact: true })
    .click();
  let region = targetCard.getByRole("region", {
    name: "Verificación del destino",
  });
  const issueResponse = page.waitForResponse(
    (r) =>
      r.url().endsWith("/verifications") && r.request().method() === "POST",
  );
  await region.getByRole("button", { name: "Emitir desafío" }).click();
  const issued = await (await issueResponse).json();
  const challengeURL =
    base + "/" + current.id + "/verifications/" + issued.challenge.id;
  expect(
    (
      await page.request.post(challengeURL + "/verify", {
        headers,
        data: { expected_version: 1 },
      })
    ).status(),
  ).toBe(503);
  await region.getByRole("button", { name: "Revocar desafío" }).click();
  await expect(
    region.getByText("Desafío revocado", { exact: true }),
  ).toBeVisible();
  await expect(
    region.getByLabel("Contenido del archivo de desafío"),
  ).toHaveCount(0);
  const stored = await (
    await page.request.get(challengeURL, { headers })
  ).json();
  expect(stored.control_verified).toBe(false);
  expect(stored.attempts).toBe(0);
  expect(stored.verified_at).toBeNull();
  const temporary = await create("DEMO RC1 caducidad real", 8);
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  headers.Authorization = await login(page, data.primary);
  await page.goto("/aplicaciones/" + data.dataset.application.id);
  const temporaryCard = page
    .locator(".v2-target-item")
    .filter({ hasText: temporary.label });
  await temporaryCard
    .getByText("Desafío de control (sin comprobación remota)", { exact: true })
    .click();
  region = temporaryCard.getByRole("region", {
    name: "Verificación del destino",
  });
  await region.getByRole("button", { name: "Emitir desafío" }).click();
  await expect(
    region.getByText("Desafío pendiente", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(
      async () =>
        (
          await (
            await page.request.get(
              base + "/" + temporary.id + "/verifications",
              { headers },
            )
          ).json()
        ).items[0].effective_state,
      { timeout: 15000 },
    )
    .toBe("expired");
  await region.getByRole("button", { name: "Actualizar verificación" }).click();
  await expect(
    region.getByText("Desafío expirado", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Iniciar análisis Baseline" }),
  ).toHaveCount(0);
  await page.screenshot({
    path: evidence + "/security-expired-1440.png",
    fullPage: true,
  });
});

for (const width of [375, 768, 1280, 1440]) {
  test(`UX: ${width}px navigation, forms, populated pages and accessibility`, async ({
    page,
  }) => {
    const data = state();
    await page.setViewportSize({ width, height: 1000 });
    for (const path of ["/login", "/crear-cuenta"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBeTruthy();
    }
    await login(page, data.primary);
    for (const [name, path] of [
      ["dashboard", "/"],
      ["applications", "/aplicaciones"],
      ["technology-cpe", "/aplicaciones/" + data.dataset.application.id],
      ["history", "/historial"],
      ["account", "/cuenta"],
    ]) {
      if (name === "technology-cpe") {
        await navigate(page, "Aplicaciones");
        await page
          .getByRole("link", {
            name: data.dataset.application.name,
            exact: true,
          })
          .click();
      } else {
        const labels: Record<string, string> = {
          dashboard: "Dashboard",
          applications: "Aplicaciones",
          history: "Historial",
          account: "Mi cuenta",
        };
        await navigate(page, labels[name]);
      }
      await expect(page).toHaveURL(
        new RegExp(path.replaceAll("/", "\\/") + "$"),
      );
      if (name === "technology-cpe") {
        await page.getByLabel("Tipo de CPE").selectOption("o");
        await page.getByLabel("Fuente CPE").selectOption("live");
        await page
          .getByLabel("Buscar otro candidato para reemplazar la selección")
          .fill("RV340");
        await page.getByRole("button", { name: "Buscar", exact: true }).click();
        await expect(page.getByRole("radio")).toHaveCount(1);
        const targetCard = page.locator(".v2-target-item").first();
        await targetCard
          .getByText("Desafío de control (sin comprobación remota)", {
            exact: true,
          })
          .click();
        await expect(
          targetCard.getByRole("button", { name: "Actualizar verificación" }),
        ).toBeEnabled();
      }
      if (name === "history") {
        await page
          .getByRole("button", { name: "Ver resultados", exact: true })
          .click();
        await expect(
          page.getByRole("link", { name: "CVE-2017-6784", exact: true }),
        ).toBeVisible();
        await page.locator("details.v2-recommendations > summary").click();
        await expect(
          page.getByText(data.dataset.measure, { exact: true }),
        ).toBeVisible();
      }
      await page.waitForLoadState("networkidle");
      await page.screenshot({
        path: `${evidence}/${name}-${width}.png`,
        fullPage: true,
      });
      const layout = await page.evaluate(() => ({
        width: window.innerWidth,
        scroll: document.documentElement.scrollWidth,
        overflowing: Array.from(document.querySelectorAll("main *"))
          .filter(
            (element) =>
              element.getBoundingClientRect().right > window.innerWidth,
          )
          .slice(0, 15)
          .map((element) => ({
            tag: element.tagName,
            className: element.className,
          })),
      }));
      expect(
        layout.scroll,
        `${name}: ${JSON.stringify(layout)}`,
      ).toBeLessThanOrEqual(width);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    }
    if (width === 375 || width === 768) {
      await navigate(page, "Historial");
      await expect(
        page.getByRole("heading", { name: "Historial de análisis" }),
      ).toBeVisible();
    }
  });
}
