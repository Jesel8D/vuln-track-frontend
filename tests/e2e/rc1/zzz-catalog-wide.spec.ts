import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { loginUi } from "./login";

test("RC2.3 searches the local official dataset and applies a physical reference independently", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const demo = JSON.parse(readFileSync(process.env.RC1_STATE_FILE!, "utf8"));
  const api = process.env.E2E_API_URL!;
  const origins = [
    new URL(api).origin,
    new URL(test.info().project.use.baseURL!).origin,
  ];
  await page.route("**/*", (route) =>
    origins.includes(new URL(route.request().url()).origin)
      ? route.continue()
      : route.abort(),
  );
  const token = await loginUi(page, demo.primary);
  const headers = { Authorization: token };
  await page
    .getByRole("link", { name: "Dispositivos", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Registrar dispositivo", exact: true })
    .click();
  await page.locator("select[name=device_type]").selectOption("server");
  await page
    .getByText("Consultar referencias CPE de hardware", { exact: true })
    .click();
  await page
    .getByRole("button", { name: "Buscar fabricante físico", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Buscar fabricante físico" })
    .fill("del");
  await page.getByRole("option", { name: "dell", exact: true }).click();
  await page.getByRole("button", { name: /referencia del modelo/ }).click();
  await page
    .getByRole("combobox", { name: /referencia del modelo/ })
    .fill("r740");
  await page.getByRole("option", { name: /dell:poweredge_r740$/i }).click();
  await expect(page.getByLabel("Modelo del equipo")).toHaveValue(
    "poweredge_r740",
  );
  await page.getByLabel(/administrativa$/).fill("Laboratorio RC2.3");
  await page.getByLabel("Componente principal").selectOption("software");
  await page
    .getByRole("button", { name: "Buscar fabricante CPE", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Buscar fabricante CPE" })
    .fill("apa");
  await page.getByRole("option", { name: "apache", exact: true }).click();
  await page
    .getByRole("button", { name: "Buscar producto CPE", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Buscar producto CPE" })
    .fill("http");
  await page.getByRole("option", { name: /\shttp_server$/ }).click();
  await page
    .getByRole("button", { name: "Buscar versión catalogada", exact: true })
    .click();
  await page
    .getByRole("listbox", { name: /catalogada/ })
    .getByRole("option")
    .filter({ hasNotText: "Deprecada" })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Buscar CPE exacto", exact: true })
    .click();
  await page
    .getByRole("option", { name: /^cpe:2\.3:a:apache:http_server:/ })
    .first()
    .click();
  await expect(
    page
      .locator(".rc22-cpe-result")
      .getByText(/API oficial de NVD|Diccionario CPE de NVD/),
  ).toBeVisible();
  await page
    .getByRole("checkbox", { name: /corresponden al equipo observado/ })
    .check();
  await page
    .getByLabel(/Motivo de confirmaci/)
    .fill("Equipo de prueba con software seleccionado del catalogo local");
  const created = page.waitForResponse(
    (r) => r.url().endsWith("/devices") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Guardar dispositivo" }).click();
  const response = await created;
  expect(response.status()).toBe(201);
  const device = await response.json();
  expect(device.manufacturer).toBe("dell");
  expect(device.product_vendor).toBe("apache");
  expect(device.current_identification.mode).toBe("live");
  expect(["nvd-api", "nvd-feed"]).toContain(
    device.current_identification.catalog_evidence.source,
  );
  const exact = await page.request.get(api + "/api/v2/cpe-catalog/candidates", {
    headers,
    params: { q: device.current_identification.cpe_name, mode: "live" },
  });
  expect(exact.status()).toBe(200);
  expect((await exact.json()).items[0].cpe_name_id).toBe(
    device.current_identification.cpe_name_id,
  );
});
