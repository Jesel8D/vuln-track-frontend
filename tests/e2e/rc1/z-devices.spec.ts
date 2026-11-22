import AxeBuilder from "@axe-core/playwright";
import { readFileSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { loginUi } from "./login";

test("RC2 device registration, CPE, CVE, review, history and four viewports", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const file = process.env.RC1_STATE_FILE!;
  const data = JSON.parse(readFileSync(file, "utf8"));
  const api = process.env.E2E_API_URL!;
  const origin = new URL(test.info().project.use.baseURL!).origin;
  await page.route("**/*", async (route) => {
    if (
      ![origin, new URL(api).origin].includes(
        new URL(route.request().url()).origin,
      )
    )
      return route.abort();
    await route.continue();
  });
  const token = await loginUi(page, data.primary);
  const link = page
    .getByRole("link", { name: "Dispositivos", exact: true })
    .first();
  await link.click();
  await expect(
    page.getByRole("heading", { name: "Inventario de dispositivos" }),
  ).toBeVisible();
  async function register(
    type: string,
    maker: string,
    model: string,
    unknown = false,
  ) {
    await page
      .getByRole("button", { name: "Registrar dispositivo", exact: true })
      .click();
    await page.getByRole("button", { name: "Registrar sin CPE" }).click();
    await page
      .getByRole("combobox", { name: "Tipo de dispositivo", exact: true })
      .selectOption(type);
    await page.getByLabel("Fabricante del equipo").fill(maker);
    await page.getByLabel("Modelo del equipo").fill(model);
    await page
      .getByLabel("Ubicación administrativa")
      .fill("Laboratorio ficticio");
    await page
      .getByLabel("Componente principal")
      .selectOption(unknown ? "software" : "firmware");
    await page
      .getByLabel("Fabricante del producto")
      .fill(unknown ? "apache" : "cisco");
    await page
      .getByLabel("Producto principal")
      .fill(unknown ? "http_server" : "small_business_rv340_firmware");
    if (!unknown) await page.getByLabel("Versión observada").fill("1.0.0.33");
    const pending = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().endsWith("/devices"),
    );
    await page.getByRole("button", { name: "Guardar dispositivo" }).click();
    const response = await pending;
    expect(response.status()).toBe(201);
    await expect(
      page.getByRole("link", { name: maker + " " + model, exact: true }),
    ).toBeVisible();
    return (await response.json()).id;
  }
  const router = await register("router", "Cisco", "RV340 RC2");
  await register("switch", "Equipo de prueba", "Switch RC2");
  await register("server", "Equipo de prueba", "Servidor RC2", true);
  await page
    .getByRole("link", { name: "Equipo de prueba Servidor RC2" })
    .click();
  await expect(
    page.getByText("La versión es desconocida.", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("Buscar candidatos CPE").fill("RV340");
  await page.getByRole("button", { name: "Buscar CPE" }).click();
  await expect(page.getByRole("radio")).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Consultar CVE" }),
  ).toBeDisabled();
  await page.getByRole("link", { name: "Volver a dispositivos" }).click();
  await page.getByLabel("Buscar fabricante o modelo").fill("RV340");
  await page.getByLabel("Filtrar tipo de dispositivo").selectOption("router");
  await expect(
    page.getByRole("link", { name: "Cisco RV340 RC2", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Cisco RV340 RC2", exact: true })
    .click();
  await page.getByLabel("Buscar candidatos CPE").fill("RV340");
  await page.getByRole("button", { name: "Buscar CPE" }).click();
  await page.getByRole("radio").check();
  await page
    .getByLabel("Motivo de confirmación")
    .fill("Comparación manual con inventario ficticio");
  await page.getByRole("button", { name: "Confirmar CPE" }).click();
  await expect(page.getByText("CPE vigente", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Consultar CVE" }).click();
  await expect(
    page.getByRole("heading", { name: "CVE-2017-6784" }),
  ).toBeVisible();
  await page.getByLabel("Motivo de revisión").fill("Revisión académica");
  await page
    .getByLabel("Evidencia de revisión")
    .fill("Condiciones adicionales sin verificar");
  await page.getByRole("button", { name: "Guardar revisión" }).click();
  await expect(
    page.getByText("Indeterminada · Revisado", { exact: false }),
  ).toBeVisible();
  await page.getByText("Medidas recomendadas", { exact: true }).click();
  await page
    .getByLabel("Medida recomendada")
    .fill("Revisar las condiciones del aviso capturado");
  await page
    .getByRole("button", { name: "Agregar medida", exact: true })
    .click();
  await expect(
    page.getByText("Revisar las condiciones del aviso capturado · Pendiente"),
  ).toBeVisible();
  for (const width of [375, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, "device detail overflow at " + width).toBeLessThanOrEqual(
      0,
    );
    const findings = await new AxeBuilder({ page }).analyze();
    expect(
      findings.violations.map(({ id, nodes }) => ({
        id,
        targets: nodes.map((node) => node.target),
      })),
    ).toEqual([]);
    await page.screenshot({
      path: "test-results-rc1/evidence/create/device-" + width + ".png",
      fullPage: true,
    });
  }
  const get = async (path: string) => {
    const response = await page.request.get(api + path, {
      headers: { Authorization: token },
    });
    expect(response.status()).toBe(200);
    return response.json();
  };
  const path = "/api/v2/workspaces/" + data.workspace + "/devices/" + router;
  const detail = await get(path);
  const identifications = await get(path + "/identifications");
  const runs = await get(path + "/analyses");
  const findings = await get(
    path + "/analyses/" + runs.items[0].id + "/findings",
  );
  const recommendations = await get(
    path + "/findings/" + findings.items[0].id + "/recommendations",
  );
  expect(runs.items[0].mode).toBe("fixture");
  expect(identifications.items[0].mode).toBe("fixture");
  const second = await page.request.post(api + "/api/v1/auth/login", {
    data: data.secondary,
  });
  if (second.status() === 200) {
    expect(
      (
        await page.request.get(api + path, {
          headers: {
            Authorization: "Bearer " + (await second.json()).access_token,
          },
        })
      ).status(),
    ).toBe(404);
  } else {
    // Full A/B assertions are also covered by the database regression and restart/restore.
    expect(second.status()).toBe(429);
  }
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await loginUi(page, data.primary);
  await page
    .getByRole("link", { name: "Dispositivos", exact: true })
    .first()
    .click();
  await page
    .getByRole("link", { name: "Cisco RV340 RC2", exact: true })
    .click();
  await page.getByRole("button", { name: "Ver hallazgos" }).click();
  await expect(
    page.getByText("Indeterminada · Revisado", { exact: false }),
  ).toBeVisible();
  writeFileSync(
    file,
    JSON.stringify(
      {
        ...data,
        device_dataset: {
          device_id: router,
          detail,
          identifications,
          runs,
          findings,
          recommendations,
        },
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
});
