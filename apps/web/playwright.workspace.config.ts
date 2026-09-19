import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e", testMatch: "workspace.spec.ts", fullyParallel: true, retries: 0,
  workers: 2, timeout: 60_000, expect: { timeout: 15_000 },
  use: { baseURL: "http://127.0.0.1:4101", trace: "retain-on-failure" },
  outputDir: "../../test-results/workspace",
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }, { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } }],
  webServer: { command: "npx next dev --port 4101 --hostname 127.0.0.1", url: "http://127.0.0.1:4101", reuseExistingServer: false, timeout: 120_000 },
});
