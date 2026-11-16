import { readFileSync } from "node:fs";
import { defineConfig } from "@playwright/test";

if (!process.env.RC1_GUARD_FILE || !process.env.RC1_STATE_FILE) {
  throw new Error("Use the owned Backend scripts.rc1_acceptance runner");
}
const guard = JSON.parse(readFileSync(process.env.RC1_GUARD_FILE, "utf8"));
if (
  typeof guard.profile !== "string" ||
  !/^rc1(?:-restore(?:-[0-9a-f]{8})?)?$/.test(guard.profile) ||
  guard.fixture !== true ||
  guard.volume !== `vulntrack_v2_${guard.profile.replaceAll("-", "_")}_pgdata`
) {
  throw new Error("Only explicitly owned RC1 fixture volumes are accepted");
}
for (const value of [guard.api_url, guard.web_url]) {
  const url = new URL(value);
  if (
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    !url.port ||
    ["8000", "5173", "55434"].includes(url.port)
  ) {
    throw new Error("Personal or external endpoints are forbidden");
  }
}
process.env.E2E_API_URL = guard.api_url;
export default defineConfig({
  testDir: "./tests/e2e/rc1",
  testMatch:
    process.env.RC1_PHASE === "create"
      ? ["acceptance.spec.ts", "fault.spec.ts"]
      : "resume.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  reporter: [["list"]],
  outputDir: `test-results-rc1/run/${process.env.RC1_PHASE}`,
  use: {
    baseURL: guard.web_url,
    headless: true,
    actionTimeout: 10000,
    timezoneId: "America/Mexico_City",
    viewport: { width: 1440, height: 1000 },
    trace: "off",
    screenshot: "off",
    video: "off",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    },
  },
});
