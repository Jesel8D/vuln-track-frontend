import { mkdirSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { loginUi } from "./login";

test("B: existing user retains CPE, analysis, review and recommendations with isolation", async ({
  page,
}) => {
  const data = JSON.parse(readFileSync(process.env.RC1_STATE_FILE!, "utf8"));
  const api = process.env.E2E_API_URL!;
  const origin = new URL(test.info().project.use.baseURL!).origin;
  await page.route("**/*", async (route) => {
    if (
      ![origin, new URL(api).origin].includes(
        new URL(route.request().url()).origin,
      )
    ) {
      await route.abort();
      throw new Error("External request forbidden");
    }
    await route.continue();
  });
  const token = await loginUi(page, data.primary);
  await expect(
    page.getByRole("heading", {
      name: "Personal de " + data.primary.username,
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("note", { name: "Datos de demostración" }),
  ).toBeVisible();
  const headers = { Authorization: token };
  const root = api + `/api/v2/workspaces/${data.workspace}/applications`;
  const base = root + "/" + data.dataset.application.id;
  const applications = (
    await (await page.request.get(root, { headers })).json()
  ).items;
  expect(
    applications.find(
      (v: { id: string }) => v.id === data.dataset.application.id,
    ),
  ).toEqual(data.dataset.application);
  const technologies = (
    await (await page.request.get(base + "/technologies", { headers })).json()
  ).items;
  expect(technologies[0]).toEqual(data.dataset.technology);
  const run = await (
    await page.request.get(base + "/analyses/" + data.dataset.run.id, {
      headers,
    })
  ).json();
  expect(run).toEqual(data.dataset.run);
  const findings = (
    await (
      await page.request.get(base + "/analyses/" + run.id + "/findings", {
        headers,
      })
    ).json()
  ).items;
  expect(findings[0]).toEqual(data.dataset.finding);
  expect(findings[0].applicability).toBe("undetermined");
  const recommendations = (
    await (
      await page.request.get(
        base + "/findings/" + findings[0].id + "/recommendations",
        { headers },
      )
    ).json()
  ).items;
  expect(
    recommendations.find(
      (v: { id: string }) => v.id === data.dataset.recommendation.id,
    ),
  ).toEqual(data.dataset.recommendation);
  await page.getByRole("link", { name: "Historial", exact: true }).click();
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
  const login = await page.request.post(api + "/api/v1/auth/login", {
    data: data.secondary,
  });
  expect(login.status()).toBe(200);
  const secondToken = "Bearer " + (await login.json()).access_token;
  for (let i = 0; i < 12; i++) {
    expect(
      (
        await page.request.get(base + "/technologies", {
          headers: { Authorization: secondToken },
        })
      ).status(),
    ).toBe(404);
    expect(
      (await page.request.get(base + "/technologies", { headers })).status(),
    ).toBe(200);
  }
  const path = "test-results-rc1/evidence/" + process.env.RC1_PHASE;
  mkdirSync(path, { recursive: true });
  await page.screenshot({
    path: path + "/existing-review-1440.png",
    fullPage: true,
  });
});
