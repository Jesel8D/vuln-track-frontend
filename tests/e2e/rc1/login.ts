import {
  expect,
  type Page,
  type Request,
  type Response,
} from "@playwright/test";

export async function loginUi(
  page: Page,
  user: { username: string; password: string },
) {
  const api = process.env.E2E_API_URL!;
  let identity: Request | undefined;
  let verified: Response | undefined;
  const request = (value: Request) => {
    if (value.url() === api + "/api/v1/auth/me") identity = value;
  };
  const response = (value: Response) => {
    if (value.url() === api + "/api/v1/auth/me") verified = value;
  };
  page.on("request", request);
  page.on("response", response);
  try {
    await page.goto("/login");
    for (let attempt = 0; attempt < 2; attempt++) {
      await page.getByLabel("Usuario", { exact: true }).fill(user.username);
      await page.getByLabel("Contraseña", { exact: true }).fill(user.password);
      const pending = page.waitForResponse(
        (value) => value.url() === api + "/api/v1/auth/login",
      );
      await page
        .getByRole("button", { name: "Iniciar sesión", exact: true })
        .click();
      const login = await pending;
      if (login.status() === 429 && attempt === 0) {
        const seconds = Number(login.headers()["retry-after"]);
        expect(seconds).toBeGreaterThan(0);
        expect(seconds).toBeLessThanOrEqual(60);
        await expect(page.getByRole("alert")).toContainText(
          "Demasiadas solicitudes",
        );
        // Respect the actual API quota; never relax the production limiter for E2E.
        await page.waitForTimeout((seconds + 1) * 1000);
        continue;
      }
      expect(login.status()).toBe(200);
      break;
    }
    await expect.poll(() => verified?.status()).toBe(200);
    expect((await verified!.json()).username).toBe(user.username);
    await expect(page).not.toHaveURL(/\/login$/);
    return identity!.headers().authorization;
  } finally {
    page.off("request", request);
    page.off("response", response);
  }
}
