import AxeBuilder from "@axe-core/playwright";
import { readFileSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { loginUi } from "./login";

test("RC2.2 local catalog, keyboard, atomic confirmation, fixture review and manual fallback", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const file = process.env.RC1_STATE_FILE!;
  const state = JSON.parse(readFileSync(file, "utf8"));
  const api = process.env.E2E_API_URL!;
  const origin = new URL(test.info().project.use.baseURL!).origin;
  const allowed = [origin, new URL(api).origin];
  await page.route("**/*", (route) =>
    allowed.includes(new URL(route.request().url()).origin)
      ? route.continue()
      : route.abort(),
  );
  const authorization = await loginUi(page, state.primary);
  const headers = { Authorization: authorization };
  const devices = "/api/v2/workspaces/" + state.workspace + "/devices";
  const catalog = "/api/v2/cpe-catalog";
  const nav = page
    .getByRole("link", { name: "Dispositivos", exact: true })
    .first();
  await nav.click();
  async function physical(model: string) {
    await page
      .getByRole("button", { name: "Registrar dispositivo", exact: true })
      .click();
    await page.getByLabel("Fabricante del equipo").fill("Cisco");
    await page.getByLabel("Modelo del equipo").fill(model);
    await page.getByLabel(/administrativa$/).fill("Laboratorio RC2.2");
  }
  await physical("RV340 asistido");
  await page.getByLabel("Fuente del catálogo").selectOption("fixture");

  async function pick(label: RegExp, q: string, result: RegExp) {
    const field = page.getByRole("combobox", { name: label });
    await field.fill(q);
    await expect(page.getByRole("option", { name: result })).toBeVisible();
    await field.press("ArrowDown");
    await expect(page.getByRole("option", { name: result })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await field.press("Enter");
  }
  await pick(/fabricante CPE/, "cis", /^cisco$/);
  await pick(/producto CPE/, "RV340", /small_business_rv340_firmware/);
  await pick(/catalogada/, "1.0.0.33", /^1\.0\.0\.33$/);
  await pick(/CPE exacto/, "", /cpe:2\.3:o:cisco/);
  const observed = page.getByRole("checkbox", {
    name: /corresponden al equipo observado/,
  });
  await expect(observed).not.toBeChecked();
  await observed.check();
  await page
    .getByLabel(/Motivo de confirmaci/)
    .fill("Verificada en inventario de demostracion");
  for (const width of [375, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(0);
    expect(
      (await new AxeBuilder({ page }).analyze()).violations.map(({ id }) => id),
    ).toEqual([]);
  }
  const creating = page.waitForResponse(
    (response) =>
      response.url().endsWith("/devices") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Guardar dispositivo" }).click();
  const created = await creating;
  expect(created.status()).toBe(201);
  const row = await created.json();
  expect(row.version).toBe("1.0.0.33");
  expect(row.current_identification.mode).toBe("fixture");
  expect(row.current_identification.catalog_evidence.source).toBe(
    "nvd-captured-fixture",
  );
  const currentCatalog =
    catalog + "/candidates/" + row.current_identification.cpe_name_id;
  const deprecation = (url: URL) => url.pathname === currentCatalog;
  await page.route(deprecation, async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    const original = await route.fetch();
    await route.fulfill({
      response: original,
      json: { ...(await original.json()), deprecated: true },
    });
  });
  await page.getByRole("link", { name: "Cisco RV340 asistido" }).click();
  await expect(page.getByText("CPE vigente", { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "muestra este CPE como deprecado" }),
  ).toBeVisible();
  await page.unroute(deprecation);
  await page.getByRole("button", { name: "Consultar CVE" }).click();
  await expect(
    page.getByRole("heading", { name: "CVE-2017-6784" }),
  ).toBeVisible();
  await page
    .getByLabel(/Motivo de revisi/)
    .fill("Se requiere evidencia de la plataforma");
  await page
    .getByLabel(/Evidencia de revisi/)
    .fill("Condiciones AND incompletas en la demostracion");
  await page.getByRole("button", { name: /Guardar revisi/ }).click();
  await expect(page.getByText(/Indeterminada · Revisado/)).toBeVisible();
  await page.getByText("Medidas recomendadas", { exact: true }).click();
  await page
    .getByLabel("Medida recomendada")
    .fill("Consultar el aviso del fabricante");
  await page.getByRole("button", { name: "Agregar medida" }).click();
  await expect(
    page.getByText(/Consultar el aviso del fabricante · Pendiente/),
  ).toBeVisible();

  await page.getByRole("link", { name: "Volver a dispositivos" }).click();
  await physical("Modelo fuera del alcance");
  await page.getByRole("button", { name: "Registrar sin CPE" }).click();
  const pending = page.waitForResponse(
    (response) =>
      response.url().endsWith("/devices") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Guardar dispositivo" }).click();
  const fallback = await pending;
  expect(fallback.status()).toBe(201);
  expect((await fallback.json()).version).toBeNull();
  await page
    .getByRole("link", { name: "Cisco Modelo fuera del alcance" })
    .click();
  await expect(
    page.getByRole("button", { name: "Consultar CVE" }),
  ).toBeDisabled();

  const entry = await page.request.get(
    api +
      catalog +
      "/candidates/" +
      row.current_identification.cpe_name_id +
      "?mode=fixture",
    { headers },
  );
  expect(entry.status()).toBe(200);
  const live = await page.request.get(api + catalog + "/status?mode=live", {
    headers,
  });
  expect(live.status()).toBe(200);
  const second = await page.request.post(api + "/api/v1/auth/login", {
    data: state.secondary,
  });
  if (second.status() === 200) {
    const isolation = await page.request.get(api + devices + "/" + row.id, {
      headers: {
        Authorization: "Bearer " + (await second.json()).access_token,
      },
    });
    expect(isolation.status()).toBe(404);
  } else {
    expect(second.status()).toBe(429);
  }
  writeFileSync(
    file,
    JSON.stringify(
      {
        ...state,
        catalog_dataset: {
          device_id: row.id,
          identification: row.current_identification,
          entry: await entry.json(),
          live_count: (await live.json()).records,
        },
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
});
