import { expect, test } from "@playwright/test";
import { mockWorkspaceApi } from "./helpers/workspaceApi";

test("validates signup, toggles password and opens company onboarding", async ({ page }) => {
  const state = await mockWorkspaceApi(page, { signedIn: false });
  await page.goto("/signup");
  await page.getByTestId("auth-submit").click();
  await expect(page.getByTestId("auth-email")).toHaveAttribute("aria-invalid", "true");
  expect(state.posts).toEqual([]);
  await page.getByTestId("auth-name").fill("Samira Benali");
  await page.getByTestId("auth-email").fill("samira@example.com");
  await page.getByTestId("auth-password").fill("long-password");
  await page.getByTestId("auth-password-toggle").click();
  await expect(page.getByTestId("auth-password")).toHaveAttribute("type", "text");
  await page.getByTestId("auth-password").press("Enter");
  await expect(page).toHaveURL(/\/company$/);
  await expect(page.getByTestId("company-profile-file")).toBeVisible();
  expect(state.posts).toContain("/auth/signup");
});

test("shows login errors and lets the user retry successfully", async ({ page }) => {
  const state = await mockWorkspaceApi(page, { signedIn: false, loginFailure: true });
  await page.goto("/login");
  await page.getByTestId("auth-email").fill("samira@example.com");
  await page.getByTestId("auth-password").fill("long-password");
  await page.getByTestId("auth-submit").click();
  await expect(page.getByTestId("auth-error")).toBeVisible();
  state.loginFailure = false;
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId("stat-0")).toHaveText("04");
});

test("protects workspace pages for signed-out visitors", async ({ page }) => {
  await mockWorkspaceApi(page, { signedIn: false });
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByTestId("auth-panel")).toBeVisible();
});

test("renders real counts, navigates, searches and filters on desktop and mobile", async ({ page, isMobile }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await mockWorkspaceApi(page);
  await page.goto("/dashboard");
  await expect(page.getByTestId("stat-0")).toHaveText("04");
  await expect(page.getByTestId("stat-1")).toHaveText("01");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("dashboard.png"), fullPage: true });
  if (isMobile) {
    await page.getByTestId("workspace-menu").click();
    await expect(page.getByTestId("workspace-drawer")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("workspace-menu")).toBeFocused();
    await page.getByTestId("workspace-menu").click();
  }
  await page.getByTestId(`${isMobile ? "mobile-" : ""}nav-tenders`).click();
  await expect(page.getByTestId("tender-row")).toHaveCount(4);
  await page.getByTestId("filter-go").click();
  await expect(page.getByTestId("tender-row")).toHaveCount(1);
  await page.getByTestId("tender-search").fill("nothing matches");
  await expect(page.getByTestId("tenders-empty")).toBeVisible();
  await page.getByTestId("tender-search").fill("digitale");
  await expect(page.getByTestId("tender-row")).toHaveCount(1);
  await page.getByTestId("density-tenders-compact").click();
  await page.reload();
  await expect(page.getByTestId("density-tenders-compact")).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("handles empty data and recovers from a service error", async ({ page }) => {
  const state = await mockWorkspaceApi(page, { empty: true, failTenders: true });
  await page.goto("/dashboard");
  await expect(page.getByTestId("data-error")).toBeVisible({ timeout: 20000 });
  state.failTenders = false;
  await page.getByTestId("data-retry").click();
  await expect(page.getByTestId("stat-0")).toHaveText("00");
  await expect(page.getByTestId("tenders-empty")).toBeVisible();
});

test("creates a dossier with a PDF and opens its detail", async ({ page }) => {
  const state = await mockWorkspaceApi(page);
  await page.goto("/tenders/new");
  await expect(page.getByTestId("upload-submit")).toBeDisabled();
  await page.getByTestId("upload-input").setInputFiles({ name: "avis.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 test") });
  await page.getByTestId("upload-submit").click();
  await expect(page.getByTestId("upload-error")).toBeVisible();
  expect(state.posts).toEqual([]);
  await page.getByTestId("dossier-reference").fill("AO-2026-005");
  await page.getByTestId("dossier-title").fill("Nouveau marché");
  await page.getByTestId("upload-submit").click();
  await expect(page).toHaveURL(/\/tenders\/created$/);
  expect(state.posts).toEqual(["/tenders", "/tenders/created/documents"]);
});

test("retries an interrupted upload without creating a duplicate dossier", async ({ page }) => {
  const state = await mockWorkspaceApi(page, { uploadFailure: true });
  await page.goto("/tenders/new");
  await page.getByTestId("dossier-reference").fill("AO-2026-005");
  await page.getByTestId("upload-input").setInputFiles({ name: "avis.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 test") });
  await page.getByTestId("upload-submit").click();
  await expect(page.getByTestId("upload-error")).toBeVisible();
  state.uploadFailure = false;
  await page.getByTestId("upload-submit").click();
  await expect(page).toHaveURL(/\/tenders\/created$/);
  expect(state.posts.filter((path) => path === "/tenders")).toHaveLength(1);
  expect(state.posts.filter((path) => path.endsWith("/documents"))).toHaveLength(2);
});

test("reports invalid company profile files without sending them", async ({ page }) => {
  const state = await mockWorkspaceApi(page);
  await page.goto("/company");
  await page.getByTestId("company-profile-file").setInputFiles({ name: "profil.json", mimeType: "application/json", buffer: Buffer.from("not valid JSON") });
  await page.getByTestId("company-import").click();
  await expect(page.getByTestId("company-import-error")).toBeVisible();
  expect(state.posts).toEqual([]);
});

test("filters references and documents and remembers each list's density", async ({ page }, testInfo) => {
  await mockWorkspaceApi(page, { company: true });
  await page.goto("/company");
  const references = page.getByTestId("company-references").getByRole("listitem");
  await expect(references).toHaveCount(2);
  await page.getByTestId("reference-filter-Ferroviaire").click();
  await expect(references).toHaveCount(1);
  await expect(references.first()).toContainText("ONCF");
  await page.getByTestId("reference-filter-all").click();
  await expect(references).toContainText(["ONCF", "OCP"]);
  const documents = page.getByTestId("company-documents").getByRole("listitem");
  await expect(documents).toHaveCount(2);
  await page.getByTestId("document-filter-memoire").click();
  await expect(documents).toHaveCount(1);
  await expect(documents.first()).toContainText("memoire-technique-2025.pdf");
  // Two lists on one page, each with its own remembered density.
  await page.getByTestId("density-references-compact").click();
  await page.reload();
  await expect(page.getByTestId("density-references-compact")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("density-documents-normal")).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: testInfo.outputPath("company.png"), fullPage: true });
});

test("persists theme and logs out without retaining the old dashboard", async ({ page, isMobile }) => {
  const state = await mockWorkspaceApi(page);
  await page.goto("/dashboard");
  const scope = isMobile ? "mobile-" : "";
  // The theme toggle now lives in the account menu, beside the email and the guide.
  if (isMobile) await page.getByTestId("workspace-menu").click();
  await page.getByTestId(`${scope}workspace-account`).click();
  await page.getByTestId(`${scope}workspace-theme`).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  if (isMobile) await page.getByTestId("workspace-menu").click();
  await page.getByTestId(`${scope}workspace-account`).click();
  await expect(page.getByTestId(`${scope}workspace-email`)).toContainText("@");
  await page.getByTestId(`${scope}workspace-logout`).click();
  await expect(page.getByTestId("auth-panel")).toBeVisible();
  expect(state.signedIn).toBe(false);
  state.empty = true;
  await page.getByTestId("auth-email").fill("samira@example.com");
  await page.getByTestId("auth-password").fill("long-password");
  await page.getByTestId("auth-submit").click();
  await expect(page.getByTestId("stat-0")).toHaveText("00");
});

test("keeps authentication usable at 320px and honors reduced motion", async ({ page }, testInfo) => {
  await mockWorkspaceApi(page, { signedIn: false });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  await expect(page.getByTestId("auth-panel")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("login.png"), fullPage: true });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.getByTestId("auth-tab-signup").click();
  await expect(page.getByTestId("auth-name")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("opens a demo workspace from the login screen without signing up", async ({ page }) => {
  const state = await mockWorkspaceApi(page, { signedIn: false, demoFailure: true });
  await page.goto("/login");
  // The affordance says what it does before it is clicked: a temporary account.
  await expect(page.getByTestId("auth-demo")).toContainText("données d’exemple");
  await page.getByTestId("auth-demo").click();
  await expect(page.getByTestId("auth-demo-error")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);

  state.demoFailure = false;
  await page.getByTestId("auth-demo").click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(state.posts).toContain("/auth/demo");
});

test("lists the team and filters it by poste", async ({ page }) => {
  await mockWorkspaceApi(page, { company: true });
  await page.goto("/company");
  const rows = page.getByTestId("company-team").getByRole("row");
  // Two profiles plus the header row.
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(1)).toContainText("CV-01");
  await expect(rows.nth(1)).toContainText("Directrice de projet");
  await expect(rows.nth(1)).toContainText("14 ans");
  await page.getByTestId("team-filter-Conducteur de travaux").click();
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(1)).toContainText("CV-02");
});

test("shows every run on Contrôle with its reasoning and its tokens", async ({ page }) => {
  await mockWorkspaceApi(page);
  await page.goto("/dashboard/controle");
  const runs = page.getByTestId("runs-table").getByTestId("run-row");
  await expect(runs).toHaveCount(2);
  await expect(runs.first()).toContainText("AO-2026-002");
  await expect(runs.first()).toContainText("4 étapes");
  // The detail is fetched only once the row is opened.
  await expect(page.getByTestId("run-detail")).toHaveCount(0);
  await runs.first().click();
  await expect(page.getByTestId("run-trace-entry").first()).toContainText("4 pages lues");
  await expect(page.getByTestId("run-trace-tool").first()).toContainText("search_documents");
  await expect(page.getByTestId("run-usage-row")).toHaveCount(2);
  await expect(page.getByTestId("run-usage-row").first()).toContainText("extractor");
});

test("says so plainly when no analysis has ever been launched", async ({ page }) => {
  await mockWorkspaceApi(page, { runs: [] });
  await page.goto("/dashboard/controle");
  await expect(page.getByTestId("runs-empty")).toBeVisible();
});
