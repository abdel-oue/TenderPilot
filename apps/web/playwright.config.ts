import { defineConfig } from "@playwright/test";
import workspaceConfig from "./playwright.workspace.config";
// Frontend journeys use intercepted APIs; no database or model is contacted.
export default defineConfig({
  ...workspaceConfig,
  testMatch: ["workspace.spec.ts", "landing.spec.ts"],
  outputDir: "../../test-results/frontend",
});