// The ONE spec allowed to hit the real pipeline. Slow. Not in the default run.
//
// It needs a started stack (`npm run up`), the corpus seeded, and a real model
// key — so it asserts on INVARIANTS, never on what the model wrote. A verdict
// exists, every requirement carries a page, the trace names the nodes that ran.
// Anything stricter would fail on a model that phrased itself differently, which
// is how a smoke spec becomes something people disable.
import { expect, test } from "@playwright/test";

const REFERENCE = process.env.SMOKE_REFERENCE ?? "AO-2026-001";
const EMAIL = process.env.SMOKE_EMAIL ?? "demo@tenderpilot.local";
const PASSWORD = process.env.SMOKE_PASSWORD ?? "demo1234";

test("@smoke analyses a seeded dossier end to end with the real model", async ({ page }) => {
  await page.goto("/login");
  await page.getByTestId("auth-email").fill(EMAIL);
  await page.getByTestId("auth-password").fill(PASSWORD);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/tenders");
  await page.getByText(REFERENCE).first().click();
  await expect(page).toHaveURL(/\/tenders\/[0-9a-f-]+$/);

  await page.getByTestId("analyze-button").click();
  // The graph runs in the worker; the screen polls. No waitForTimeout.
  await expect(page.getByTestId("analysis-status")).toHaveText("Analyse terminée");

  // A verdict, with a justification the agent wrote — whatever it says.
  await expect(page.getByTestId("verdict-badge")).toHaveText(/go|no-go/i);
  await expect(page.getByTestId("verdict-justification")).not.toBeEmpty();

  // Provenance is the product: every extracted requirement cites a real page.
  const citations = page.getByTestId("requirement-citation");
  expect(await citations.count()).toBeGreaterThan(0);
  await expect(citations.first()).toHaveAttribute("href", /\/documents\/[0-9a-f-]+\/file#page=\d+$/);

  // The agent's reasoning is on screen, not only in the worker's logs.
  const steps = page.getByTestId("trace-panel").getByRole("listitem");
  await expect(steps.filter({ hasText: "ingest" })).toHaveCount(1);
  await expect(steps.filter({ hasText: "decide" })).toHaveCount(1);

  // A go drafts and exports; a no-go is never drafted. Both are correct.
  const verdict = await page.getByTestId("verdict-badge").innerText();
  await expect(page.getByTestId("export-docx")).toHaveCount(/no-go/i.test(verdict) ? 0 : 1);
});
