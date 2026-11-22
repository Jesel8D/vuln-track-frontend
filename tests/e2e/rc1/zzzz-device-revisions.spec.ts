import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { loginUi } from "./login";

test("RC3 keeps prior CVE, compares a conflict and confirms the new observed firmware", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const fixture = JSON.parse(readFileSync(process.env.RC1_STATE_FILE!, "utf8"));
  const api = process.env.E2E_API_URL!;
  const allowed = [api, new URL(test.info().project.use.baseURL!).origin];
  await page.route("**/*", (route) =>
    allowed.includes(new URL(route.request().url()).origin)
      ? route.continue()
      : route.abort(),
  );
  const token = await loginUi(page, fixture.primary);
  const headers = { Authorization: token };
  const collection =
    api + "/api/v2/workspaces/" + fixture.workspace + "/devices";
  const created = await page.request.post(collection, {
    headers,
    data: {
      device_type: "router",
      manufacturer: "Cisco",
      model: "RV340 RC3",
      product_vendor: "cisco",
      product: "small_business_rv340_firmware",
      component_kind: "firmware",
      version: "1.0.0.33",
      site_label: "Sala inicial",
    },
  });
  expect(created.status()).toBe(201);
  const path = collection + "/" + (await created.json()).id;
  const original = await page.request.post(path + "/identifications", {
    headers,
    data: {
      cpe_name_id: "c817e5ba-62c1-41e7-a15c-fb851fea761e",
      expected_identification_id: null,
      reason: "Firmware de fixture confirmado",
    },
  });
  expect(original.status()).toBe(201);
  await page
    .getByRole("link", { name: "Dispositivos", exact: true })
    .first()
    .click();
  await page
    .getByRole("link", { name: "Cisco RV340 RC3", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Consultar CVE", exact: true })
    .click();
  await expect(
    page.getByText("Versión evaluada 1.0.0.33", { exact: false }),
  ).toBeVisible();

  const edit = page.getByRole("button", {
    name: "Editar dispositivo",
    exact: true,
  });
  await edit.click();
  await page.getByLabel("Ubicación administrativa").fill("Sala de operaciones");
  await page.getByLabel("Motivo del cambio").fill("Traslado verificado");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("CPE vigente", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Historial de cambios" }),
  ).toBeVisible();
  await expect(
    page.getByText("Revisión 2 · Administrativo", { exact: false }),
  ).toBeVisible();

  await edit.click();
  await page
    .getByLabel("Etiqueta de inventario")
    .fill("Propuesta de un borrador");
  await page.getByLabel("Motivo del cambio").fill("Propuesta de prueba");
  const latest = await page.request.patch(path, {
    headers,
    data: {
      expected_record_version: 2,
      site_label: "Sala confirmada",
      reason: "Cambio concurrente",
    },
  });
  expect(latest.status()).toBe(200);
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await page
    .getByRole("button", { name: "Cargar versión actual y comparar" })
    .click();
  await expect(
    page.getByText("Actual: Sala confirmada", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Editar desde la revisión actual" })
    .click();

  await page.getByLabel("Versión observada", { exact: true }).fill("1.0.1.16");
  await page
    .getByRole("checkbox", { name: "Confirmo los cambios de identidad" })
    .check();
  await page.getByLabel("Motivo del cambio").fill("Firmware observado");
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
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(
    page.getByText(/El CPE requiere una nueva revisión/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Consultar CVE", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText(
      /Identidad tecnológica anterior.*Versión evaluada 1\.0\.0\.33/,
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Comparar revisiones" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "1.0.0.33 → 1.0.1.16" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Buscar nueva identidad" }).click();
  await page.getByLabel("Fuente del catálogo").selectOption("fixture");
  await page
    .getByRole("button", { name: "Buscar fabricante CPE", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Buscar fabricante CPE" })
    .fill("cis");
  await page.getByRole("option", { name: "cisco", exact: true }).click();
  await page
    .getByRole("button", { name: "Buscar producto CPE", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Buscar producto CPE" })
    .fill("rv340");
  await page
    .getByRole("option", { name: /small_business_rv340_firmware/ })
    .click();
  await page
    .getByRole("button", { name: "Buscar versión catalogada", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Buscar versión catalogada" })
    .fill("1.0.1.16");
  await page.getByRole("option", { name: "1.0.1.16", exact: true }).click();
  await page
    .getByRole("button", { name: "Buscar CPE exacto", exact: true })
    .click();
  await page
    .getByRole("option", {
      name: /cpe:2\.3:o:cisco:small_business_rv340_firmware:1\.0\.1\.16/,
    })
    .click();
  await page
    .getByRole("checkbox", {
      name: "Confirmo que el CPE corresponde a la versión observada",
    })
    .check();
  await page
    .getByLabel("Motivo de la nueva identificación")
    .fill("CPE cotejado");
  await page.getByRole("button", { name: "Confirmar nueva identidad" }).click();
  await expect(
    page.getByRole("button", { name: "Consultar CVE", exact: true }),
  ).toBeEnabled();
  await expect(page.getByText("CPE vigente", { exact: true })).toBeVisible();
  const dto = await page.request.get(path, { headers });
  expect((await dto.json()).current_identification.cpe_name).toContain(
    ":1.0.1.16:",
  );
  await expect(
    page.getByText(
      /Identidad tecnológica anterior.*Versión evaluada 1\.0\.0\.33/,
    ),
  ).toBeVisible();
});
