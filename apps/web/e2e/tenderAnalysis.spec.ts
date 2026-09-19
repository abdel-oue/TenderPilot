// The review screen: EX-02 to EX-07, the part of the product the other specs stop
// short of. The api is intercepted, so no model is called and no run is queued.
import { expect, test } from "@playwright/test";
import { ANALYSIS, PENDING_QUESTION, REQUIREMENTS, mockWorkspaceApi } from "./helpers/workspaceApi";

test("keeps warnings after saving and clears them only after explicit validation", async ({ page }) => {
  await mockWorkspaceApi(page, { analysis: { ...ANALYSIS,
    result: { ...ANALYSIS.result, needsHuman: true, stageErrors: [{ node: "compliance", message: "Contrôle indisponible" }] },
    sections: [{ ...ANALYSIS.sections[0], needsHuman: true, complianceWarnings: ["Référence non justifiée"] }],
  } });
  await page.goto("/tenders/t2");
  await expect(page.getByTestId("analysis-warnings")).toContainText("Contrôle indisponible");
  await page.getByTestId("panel-memo").click();
  await expect(page.getByTestId("section-warnings")).toContainText("Référence non justifiée");
  await page.getByTestId("section-toggle").click();
  await page.getByTestId("section-textarea").fill("Correction complète après vérification des pièces.");
  await expect(page.getByTestId("section-validate")).toBeDisabled();
  await page.getByTestId("section-save").click();
  await expect(page.getByTestId("section-validate")).toBeEnabled();
  await expect(page.getByTestId("section-warnings")).toBeVisible();
  await page.getByTestId("section-validate").click();
  await expect(page.getByTestId("section-validated")).toBeVisible();
  await expect(page.getByTestId("section-warnings")).toHaveCount(0);
  await page.reload();
  await page.getByTestId("panel-memo").click();
  await expect(page.getByTestId("section-validated")).toBeVisible();
  await expect(page.getByTestId("section")).toContainText("Correction complète après vérification des pièces.");
});

test("flags an unverified citation instead of presenting it as a source link", async ({ page }) => {
  await mockWorkspaceApi(page, { analysis: ANALYSIS, requirements: [{ ...REQUIREMENTS[1], quoteVerified: false }] });
  await page.goto("/tenders/t2");
  await page.getByTestId("panel-matrix").click();
  await expect(page.getByTestId("citation-unverified")).toBeVisible();
  await expect(page.getByTestId("requirement-citation")).toHaveCount(0);
});

test("runs the analysis and shows the verdict once the run finishes", async ({ page }) => {
  const state = await mockWorkspaceApi(page);
  await page.goto("/tenders/t2");
  await expect(page.getByTestId("analysis-status")).toHaveText("aucune analyse");

  await page.getByTestId("analyze-button").click();
  expect(state.posts).toContain("/tenders/t2/analyze");
  await expect(page.getByTestId("analysis-status")).toHaveText("En file d’attente");
  await expect(page.getByTestId("analysis-queued")).toContainText("Ce dossier est en file d’attente");
  await expect(page.getByTestId("trace-current")).toHaveCount(0);

  // The screen learns the rest by polling; nothing is pushed to it.
  state.analysis = { ...ANALYSIS, status: "running", result: null, sections: [] };
  await expect(page.getByTestId("analysis-status")).toHaveText("Analyse en cours");
  state.analysis = ANALYSIS;
  await expect(page.getByTestId("verdict-badge")).toHaveText(/no-go/i);
  await expect(page.getByTestId("verdict-justification")).toContainText("certification exigée");
});

test("streams tool calls before a node finishes and keeps distinct repeated calls", async ({ page }) => {
  const now = new Date().toISOString();
  await mockWorkspaceApi(page, { analysis: { ...ANALYSIS, status: "running", result: null, sections: [], nodeTrace: [
    { id: "node1", node: "matchProfile", status: "running", startedAt: now, at: now, summary: "", tools: [] },
  ] } });
  await page.route("**/tenders/t2/analysis/stream", (route) => route.fulfill({
    headers: { "content-type": "text/event-stream", "cache-control": "no-cache" },
    body: [
      { id: "tool1", status: "running", outcome: "En cours…" },
      { id: "tool1", status: "ok", outcome: "Deux références trouvées", ms: 420 },
      { id: "tool2", status: "ok", outcome: "Deux références trouvées", ms: 600 },
    ].map((tool) => `data: ${JSON.stringify({ type: "tool", node: "matchProfile", name: "search_documents", raison: "Vérifier les références", at: now, startedAt: now, ...tool })}\n\n`).join(""),
  }));
  await page.goto("/tenders/t2");
  await expect(page.getByTestId("trace-tool")).toHaveCount(2);
  await expect(page.getByTestId("trace-tool").first()).toContainText("Deux références trouvées");
  await expect(page.getByTestId("trace-tool-name").first()).toContainText("420 ms");
  await expect(page.getByTestId("trace-entry")).toContainText("Confrontation à votre profil");
});

test("restores active OCR and its timer from polling after a refresh", async ({ page }) => {
  const at = new Date(Date.now() - 5000).toISOString();
  const state = await mockWorkspaceApi(page, { analysis: { ...ANALYSIS, status: "running", result: null, sections: [], nodeTrace: [
    { id: "node1", node: "ingest", status: "running", startedAt: at, at, summary: "", tools: [
      { id: "text1", name: "extract_text", raison: null, outcome: "1/2 pages lisibles", status: "ok", ms: 25 },
      { id: "ocr1", name: "ocr", raison: "Page scannée", outcome: "En cours…", status: "running", startedAt: at, at },
    ] },
  ] } });
  await page.goto("/tenders/t2");
  await expect(page.getByTestId("trace-tool")).toHaveCount(2);
  await expect(page.getByTestId("trace-tool-name").last()).toHaveText(/ocr · \d+\.\d s/);
  await page.reload();
  await expect(page.getByTestId("trace-tool")).toHaveCount(2);
  state.analysis = { ...state.analysis!, nodeTrace: [{ id: "node1", node: "ingest", status: "ok", at, summary: "2 pages lues, dont 1 par OCR", ms: 7525, tools: [
    { id: "text1", name: "extract_text", raison: null, outcome: "1/2 pages lisibles", status: "ok", ms: 25 },
    { id: "ocr1", name: "ocr", raison: null, outcome: "1 page lisible après OCR", status: "ok", ms: 7500 },
  ] }] };
  await expect(page.getByTestId("trace-tool-name").last()).toHaveText("ocr · 7.5 s");
  await expect(page.getByTestId("trace-entry")).toContainText("2 pages lues, dont 1 par OCR");
});

test("cites each blocker with its page and article on a no-go", async ({ page }) => {
  await mockWorkspaceApi(page, { analysis: ANALYSIS });
  await page.goto("/tenders/t2");

  await page.getByTestId("panel-blockers").click();
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

  // Every graph step, in order, with its duration. Scoped by testid rather than
  // by role: each step also carries its tool calls, which are list items too.
  await page.getByTestId("trace-toggle").click();
  const steps = page.getByTestId("trace-entry");
  await expect(steps).toHaveCount(4);
  await expect(steps.first()).toContainText("ingest");
  await expect(steps.first()).toContainText("4 pages lues");
  await expect(steps.last()).toContainText("decide");
});

test("gives the reason behind every requirement match", async ({ page }) => {
  await mockWorkspaceApi(page, { analysis: ANALYSIS, requirements: REQUIREMENTS });
  await page.goto("/tenders/t2");

  await page.getByTestId("panel-matrix").click();
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

  await page.getByTestId("panel-memo").click();
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
  await page.getByTestId("panel-memo").click();
  await expect(page.getByText("Aucune section rédigée")).toBeVisible();
  await page.getByTestId("slideover-close").click();

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
  await expect(page.getByTestId("analysis-status")).toHaveText("Analyse échouée");
  // A failed run must not keep the button spinning: retrying is the whole recovery.
  await expect(page.getByTestId("analyze-button")).toBeEnabled();
});

test("stops for a question the agent asked and resumes on the answer", async ({ page }) => {
  // The human-in-the-loop path. The agent called ask_human, LangGraph parked the
  // run on its checkpoint, and nothing moves until somebody answers.
  const state = await mockWorkspaceApi(page, {
    analysis: {
      ...ANALYSIS,
      status: "awaiting_human",
      pendingQuestion: PENDING_QUESTION,
      result: null,
      sections: [],
    },
  });
  await page.goto("/tenders/t2");

  await expect(page.getByTestId("analysis-status")).toHaveText("En attente de votre réponse");
  const question = page.getByTestId("human-question");
  await expect(question).toContainText("ISO 22301");
  // Its own reason for asking, in the agent's words, not ours.
  await expect(question).toContainText("Pour ne pas vous ecarter");

  // The options come from the model: answering must not mean guessing what it
  // will accept.
  await expect(page.getByTestId("answer-oui")).toBeVisible();
  await expect(page.getByTestId("answer-non")).toBeVisible();
  await expect(page.getByTestId("answer-inconnu")).toBeVisible();

  // Nothing is sent until a choice is made.
  await expect(page.getByTestId("answer-submit")).toBeDisabled();

  await page.getByTestId("answer-oui").click();
  await page.getByTestId("answer-instruction").fill("Certifiés depuis 2023.");
  await page.getByTestId("answer-submit").click();

  await expect.poll(() => state.answers).toEqual([
    { askId: "ask-1", choice: "oui", instruction: "Certifiés depuis 2023.", verdictOverride: null, dismissedBlockers: [] },
  ]);
  expect(state.posts).toContain("/analyses/r2/answer");

  // The run goes back on the queue and the screen follows it there.
  await expect(page.getByTestId("analysis-status")).toHaveText("En file d’attente");
  await expect(page.getByTestId("human-question")).toHaveCount(0);
});

test("opens each part of the analysis in a panel and closes it again", async ({ page }) => {
  await mockWorkspaceApi(page, { analysis: ANALYSIS, requirements: REQUIREMENTS });
  await page.goto("/tenders/t2");

  await page.getByTestId("panel-blockers").click();
  await expect(page.getByTestId("blocker").first()).toBeVisible();
  // Escape is the browser's own <dialog> handling; it must still reach us.
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("blocker")).toHaveCount(0);

  await page.getByTestId("panel-matrix").click();
  await expect(page.getByTestId("compliance-matrix")).toBeVisible();
  await page.getByTestId("slideover-close").click();
  await expect(page.getByTestId("compliance-matrix")).toHaveCount(0);

  await page.getByTestId("panel-memo").click();
  await expect(page.getByTestId("section").first()).toBeVisible();
  await page.getByTestId("slideover-close").click();
  await expect(page.getByTestId("section")).toHaveCount(0);
});
