import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { loginUi } from "./login";

test("RC3.1 registers from official physical and component selectors with manual fallback", async ({
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
  const manufacturer = "Fabricante del equipo";
  const model = "Modelo del equipo";
  const manufacturerSelect = page.getByRole("button", {
    name: /^Fabricante del equipo/,
  });
  const modelSelect = page.getByRole("button", { name: /^Modelo del equipo/ });
  const destination = page.getByLabel("Ubicación administrativa");
  const inventory = page.getByLabel("Etiqueta de inventario");
  const notes = page.getByLabel("Notas no sensibles");
  await expect(manufacturerSelect).toBeVisible();
  await expect(modelSelect).toBeDisabled();
  await expect(page.getByRole("textbox", { name: manufacturer })).toHaveCount(
    0,
  );
  await expect(page.getByRole("textbox", { name: model })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Guardar dispositivo" }),
  ).toBeDisabled();
  await destination.fill("Laboratorio de redes");
  await inventory.fill("LAB-010");
  await notes.fill("Equipo de demostración.");

  await manufacturerSelect.press("ArrowDown");
  const manufacturerSearch = page.getByRole("combobox", { name: manufacturer });
  const vendors = page.getByRole("listbox", { name: manufacturer });
  const dell = vendors.getByRole("option", { name: "dell", exact: true });
  await expect(manufacturerSearch).toHaveValue("");
  await expect(dell).toBeVisible();
  const ciscoAvailable = await vendors
    .getByRole("option", {
      name: "cisco",
      exact: true,
    })
    .isVisible();
  await manufacturerSearch.press("Escape");
  await expect(manufacturerSelect).toBeFocused();
  await manufacturerSelect.click();
  await manufacturerSearch.fill("del");
  await expect(dell).toBeVisible();
  await manufacturerSearch.press("ArrowDown");
  await expect(dell).toHaveAttribute("aria-selected", "true");
  await manufacturerSearch.press("Enter");

  const models = page.getByRole("listbox", { name: model });
  const modelSearch = page.getByRole("combobox", { name: model });
  const powerEdge = models.getByRole("option", { name: /poweredge_r740$/i });
  await expect(modelSelect).toBeEnabled();
  await modelSelect.click();
  await expect(modelSearch).toHaveValue("");
  await expect(powerEdge).toBeVisible();
  await modelSearch.fill("r740");
  await powerEdge.click();
  await expect(modelSelect).toHaveText("poweredge_r740");
  await expect(
    page.getByRole("checkbox", {
      name: /corresponden al equipo observado/,
    }),
  ).toHaveCount(0);

  // The smaller pilot can also run this test with Dell as its only vendor.
  await manufacturerSelect.click();
  if (ciscoAvailable) {
    await vendors.getByRole("option", { name: "cisco", exact: true }).click();
    await expect(modelSelect).toHaveText("Seleccionar modelo");
    await modelSelect.click();
    await expect(
      models.getByRole("option", {
        name: /small_business_rv340$/,
      }),
    ).toBeVisible();
    await expect(powerEdge).toHaveCount(0);
    await modelSearch.press("Escape");
    await manufacturerSelect.click();
  }
  await manufacturerSearch.press("Escape");
  await page
    .getByRole("button", { name: "Limpiar Fabricante del equipo" })
    .click();
  await expect(modelSelect).toBeDisabled();
  await manufacturerSelect.click();
  await dell.click();
  await modelSelect.click();
  await powerEdge.click();

  const manualManufacturer = page.getByRole("textbox", { name: manufacturer });
  const manualModel = page.getByRole("textbox", { name: model });
  await page.getByRole("button", { name: "No encuentro mi equipo" }).click();
  await expect(manualManufacturer).toBeFocused();
  await expect(manualManufacturer).toHaveValue("dell");
  await expect(manualModel).toHaveValue("poweredge_r740");
  await expect(manufacturerSelect).toHaveCount(0);
  await expect(modelSelect).toHaveCount(0);
  await manualModel.fill("Equipo fuera del catálogo");
  await page.getByRole("button", { name: "Volver a los desplegables" }).click();
  await expect(modelSelect).toHaveText("poweredge_r740");
  await expect(manualModel).toHaveCount(0);
  await page.getByRole("button", { name: "No encuentro mi equipo" }).click();
  await expect(manualModel).toHaveValue("Equipo fuera del catálogo");
  await page.getByRole("button", { name: "Volver a los desplegables" }).click();
  await expect(destination).toHaveValue("Laboratorio de redes");
  await expect(inventory).toHaveValue("LAB-010");
  await expect(notes).toHaveValue("Equipo de demostración.");

  const screenshots = process.env.RC31_FORM_SCREENSHOTS;
  for (const width of [1280, 1440]) {
    await page.setViewportSize({ width, height: 1080 });
    await modelSelect.click();
    await expect(powerEdge).toBeVisible();
    const deviceType = page.getByRole("combobox", {
      name: "Tipo de dispositivo",
      exact: true,
    });
    expect((await deviceType.boundingBox())?.height).toBeLessThan(50);
    expect(
      (
        await page
          .getByRole("button", { name: "Limpiar Modelo del equipo" })
          .boundingBox()
      )?.height,
    ).toBeLessThan(50);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(0);
    if (screenshots) {
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: join(screenshots, `registro-dispositivos-${width}.png`),
        animations: "disabled",
      });
    }
    await modelSearch.press("Escape");
  }
  await expect(
    page.getByRole("button", { name: "Buscar fabricante CPE", exact: true }),
  ).toBeVisible();
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
  expect(device.model).toBe("poweredge_r740");
  expect(device.site_label).toBe("Laboratorio de redes");
  expect(device.inventory_label).toBe("LAB-010");
  expect(device.notes).toBe("Equipo de demostración.");
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
