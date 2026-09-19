import { defineConfig, devices } from "@playwright/test";
// The real stack: no interception, the api and the model answer for themselves.
// Run it against a started `npm run up`, never in the default suite.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "smoke.spec.ts",
  retries: 0,
  // A full dossier is OCR plus a dozen model calls. Minutes, not seconds.
  timeout: 15 * 60_000,
  expect: { timeout: 10 * 60_000 },
  use: { baseURL: process.env.SMOKE_WEB_URL ?? "http://localhost:4100", trace: "retain-on-failure" },
  outputDir: "../../test-results/smoke",
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }],
});
