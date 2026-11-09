import { defineConfig } from "@playwright/test";
if (
  !process.env.E2E_WEB_URL ||
  !process.env.E2E_API_URL ||
  !process.env.TEST_DISPOSABLE_DATABASE?.startsWith("vulntrack-web-test-")
) {
  throw new Error(
    "Usar ../backend/.venv/bin/python scripts/dev_stack.py --e2e; no aceptar una base existente",
  );
}
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45000,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_WEB_URL,
    headless: true,
    timezoneId: "America/Mexico_City",
    viewport: { width: 1440, height: 1000 },
    trace: "off",
    screenshot: "off",
    video: "off",
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? "/usr/bin/google-chrome",
    },
  },
  webServer: {
    command: `npm run dev -- --port ${new URL(process.env.E2E_WEB_URL).port}`,
    url: process.env.E2E_WEB_URL,
    reuseExistingServer: false,
    timeout: 30000,
    env: {
      VITE_API_URL: process.env.E2E_API_URL,
      DATABASE_URL: "",
      MIGRATION_DATABASE_URL: "",
      TOKEN_SECRET: "",
      NVD_API_KEY: "",
      POSTGRES_PASSWORD: "",
      TEST_PASSWORD: "",
      TEST_USER: "",
      TEST_OTHER_USER: "",
    },
  },
});
