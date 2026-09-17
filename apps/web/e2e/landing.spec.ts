import { expect, test } from "@playwright/test";

test("shows French by default with the template section sequence and working logos", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByTestId("landing")).toHaveAttribute("lang", "fr");
  await expect(page.getByTestId("hero-title")).toContainText("Vos appels d’offres.");
  const sectionIds = await page.getByTestId("landing").evaluate((element) => Array.from(element.querySelectorAll("main > section")).map((section) => section.getAttribute("data-testid")));
  expect(sectionIds).toEqual(["hero", "features", "workflow", "dossier", "metrics", "documents", "approach", "demo", "cta"]);
  await expect.poll(() => page.getByTestId("header-logo").evaluate((element) => { const image = element.querySelector("img"); return Boolean(image?.complete && image.naturalWidth > 0); })).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("switches language throughout the page and remembers the choice", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("language-en").click();
  await expect(page.getByTestId("landing")).toHaveAttribute("lang", "en");
  await expect(page.getByTestId("hero-title")).toContainText("Complex tenders.");
  await expect(page.getByTestId("analysis-tab-0")).toHaveText("Summary");
  await expect(page.getByTestId("footer")).toContainText("All rights reserved.");
  await page.goto("/");
  await expect(page.getByTestId("landing")).toHaveAttribute("lang", "en");
  await page.getByTestId("language-fr").click();
  await expect(page.getByTestId("landing")).toHaveAttribute("lang", "fr");
  await expect(page.getByTestId("analysis-tab-0")).toHaveText("Synthèse");
});

test("switches theme, adapts the logo and persists the preference", async ({ page }) => {
  await page.goto("/");
  const lightFilter = await page.getByTestId("header-logo").evaluate((element) => getComputedStyle(element.querySelector("img")!).filter);
  await page.getByTestId("theme-dark").click();
  await expect(page.getByTestId("theme-light")).toBeVisible();
  const darkFilter = await page.getByTestId("header-logo").evaluate((element) => getComputedStyle(element.querySelector("img")!).filter);
  expect(darkFilter).not.toBe(lightFilter);
  await page.reload();
  await expect(page.getByTestId("theme-light")).toBeVisible();
  await page.getByTestId("language-en").click();
  await expect(page.getByTestId("theme-light")).toBeVisible();
  await page.getByTestId("theme-light").click();
  await expect(page.getByTestId("theme-dark")).toBeVisible();
});

test("changes the walkthrough and opens the cited passage in the demo", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("workflow-step-1").click();
  await expect(page.getByTestId("workflow-step-1")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("workflow-preview")).toContainText("Les points à examiner");
  await page.getByTestId("hero-demo").click();
  await expect(page).toHaveURL(/#demo$/);
  await page.getByTestId("view-source").click();
  await expect(page.getByTestId("analysis-tab-2")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("source-excerpt")).toBeVisible();
  await page.getByTestId("source-toggle").click();
  await expect(page.getByTestId("source-excerpt")).toBeHidden();
  await page.getByTestId("analysis-tab-1").click();
  await expect(page.getByTestId("analysis-panel")).toContainText("À compléter");
  await page.getByTestId("analysis-tab-1").press("ArrowRight");
  await expect(page.getByTestId("analysis-tab-2")).toBeFocused();
});

test("opens mobile navigation and closes it after selection or Escape", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Mobile navigation only");
  await page.goto("/");
  await page.getByTestId("mobile-toggle").click();
  await expect(page.getByTestId("mobile-toggle")).toHaveAttribute("aria-expanded", "true");
  await page.getByTestId("mobile-link-0").click();
  await expect(page.getByTestId("mobile-toggle")).toHaveAttribute("aria-expanded", "false");
  await expect(page).toHaveURL(/#features$/);
  await page.getByTestId("mobile-toggle").click();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("mobile-toggle")).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByTestId("mobile-toggle")).toBeFocused();
});
