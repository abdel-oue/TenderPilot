// The review screen: EX-02 to EX-07, the part of the product the other specs stop
// short of. The api is intercepted, so no model is called and no run is queued.
import { expect, test } from "@playwright/test";
import { ANALYSIS, REQUIREMENTS, mockWorkspaceApi } from "./helpers/workspaceApi";

test("runs the analysis and shows the verdict once the run finishes", async ({ page }) => {
  const state = await mockWorkspaceApi(page);
  await page.goto("/tenders/t2");
  await expect(page.getByTestId("analysis-status")).toHaveText("aucune analyse");

  await page.getByTestId("analyze-button").click();
  expect(state.posts).toContain("/tenders/t2/analyze");
  await expect(page.getByTestId("analysis-status")).toHaveText("queued");

  // The screen learns the rest by polling; nothing is pushed to it.
  state.analysis = { ...ANALYSIS, status: "running", result: null, sections: [] };
  await expect(page.getByTestId("analysis-status")).toHaveText("running");
  state.analysis = ANALYSIS;
  await expect(page.getByTestId("verdict-badge")).toHaveText(/no-go/i);
  await expect(page.getByTestId("verdict-justification")).toContainText("certification exigée");
});

test("cites each blocker with its page and article on a no-go", async ({ page }) => {
  await mockWorkspaceApi(page, { analysis: ANALYSIS });
  await page.goto("/tenders/t2");

  const blocker = page.getByTestId("blocker").first();
  await expect(blocker).toContainText("ISO 22301:2019");
  await expect(blocker).toContainText("ISO 9001:2015");
  // EX-03: the citation opens the source PDF at the exact page.
  await expect(blocker.getByRole("link")).toHaveAttribute("href", /\/documents\/d1\/file#page=7$/);
  await expect(blocker.getByRole("link")).toContainText("art. 4.2");
});

test("shows how the agent reached the verdict, not only the verdict", async ({ page }) => {
  await mockWorkspaceApi(page, { analysis: ANALYSIS, requirements: REQUIREMENTS });
  await page.goto("/tenders/t2");

  // The score's own derivation, criterion by criterion.
  await expect(page.getByTestId("rubric-criterion")).toHaveCount(3);
  await expect(page.getByTestId("rubric-criterion").first()).toContainText("12 / 40");

  // A risk the agent refused to promote into a disqualification.
  await expect(page.getByTestId("analysis-warning")).toContainText("seuil éliminatoire de 20");

  // Every graph step, in order, with its duration.
  const steps = page.getByTestId("trace-panel").getByRole("listitem");
  await expect(steps).toHaveCount(4);
  await expect(steps.first()).toContainText("ingest");
  await expect(steps.first()).toContainText("4 pages lues");
  await expect(steps.last()).toContainText("decide");
});

test("gives the reason behind every requirement match", async ({ page }) => {
  await mockWorkspaceApi(page, { analysis: ANALYSIS, requirements: REQUIREMENTS });
  await page.goto("/tenders/t2");

  // EX-02: eliminatory sorts first, whatever order the api answered in.
  const rows = page.getByTestId("requirement-row");
  await expect(rows.first()).toHaveAttribute("data-obligation", "eliminatoire");

  await expect(rows.first().getByTestId("requirement-match")).toHaveAttribute("data-status", "unmet");
  await expect(rows.first().getByTestId("requirement-reason")).toContainText("Aucune certification ISO 22301");
  await expect(rows.nth(1).getByTestId("requirement-reason")).toContainText("12/08/2026");
  // A requirement no analysis has answered says so, rather than showing a reason.
  await expect(rows.nth(2).getByTestId("requirement-reason")).toHaveCount(0);
});

test("reports pages the pipeline could not read", async ({ page }) => {
  await mockWorkspaceApi(page, { analysis: ANALYSIS });
  await page.goto("/tenders/t2");

  // EX-07: silence here would be indistinguishable from "this dossier demands nothing".
  await expect(page.getByTestId("unread-banner")).toContainText("1 page(s) illisible(s)");
  await expect(page.getByTestId("unread-banner").getByRole("link")).toHaveAttribute("href", /#page=9$/);
});

test("keeps a human correction and surfaces a save that failed", async ({ page }) => {
  const state = await mockWorkspaceApi(page, { analysis: ANALYSIS, saveFailure: true });
  await page.goto("/tenders/t2");

  await page.getByTestId("section-toggle").click();
  await page.getByTestId("section-textarea").fill("Notre approche se déroule en quatre phases.");
  await page.getByTestId("section-save").click();
  await expect(page.getByTestId("section-error")).toContainText("Enregistrement impossible");
  expect(state.patches).toEqual([]);

  state.saveFailure = false;
  await page.getByTestId("section-save").click();
  await expect.poll(() => state.patches).toEqual([
    { sectionKey: "methodologie", title: "Méthodologie", content: "Notre approche se déroule en quatre phases." },
  ]);
});

test("offers the DOCX export only when something was drafted", async ({ page }) => {
  // A no-go is never drafted, so there is nothing to export.
  await mockWorkspaceApi(page, { analysis: { ...ANALYSIS, sections: [] } });
  await page.goto("/tenders/t2");
  await expect(page.getByTestId("export-docx")).toHaveCount(0);
  await expect(page.getByText("Aucune section rédigée")).toBeVisible();

  await mockWorkspaceApi(page, { analysis: ANALYSIS });
  await page.reload();
  await expect(page.getByTestId("export-docx")).toHaveAttribute("href", /\/analyses\/r2\/export\.docx$/);
});

test("shows a failed run instead of an empty screen", async ({ page }) => {
  await mockWorkspaceApi(page, {
    analysis: { ...ANALYSIS, status: "failed", error: "OCR indisponible", result: null, sections: [] },
  });
  await page.goto("/tenders/t2");

  await expect(page.getByTestId("analysis-failed")).toContainText("OCR indisponible");
  await expect(page.getByTestId("analysis-status")).toHaveText("failed");
  // A failed run must not keep the button spinning: retrying is the whole recovery.
  await expect(page.getByTestId("analyze-button")).toBeEnabled();
});
