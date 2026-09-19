import type { Page } from "@playwright/test";
export const USER = { id: "b8be4ed1-9603-4e77-a8ba-d47a99b08255", name: "Samira Benali", email: "samira@example.com", createdAt: "2026-09-01T10:00:00.000Z" };
const BASE = { buyer: "Ville de Rabat", estimatedValue: null, createdAt: "2026-09-10T12:00:00.000Z", deadline: "2099-09-25", status: "analyzed" };
export const TENDERS = [
  { ...BASE, id: "t1", reference: "AO-2026-001", title: "Accompagnement à la transformation digitale", analysis: { runId: "r1", status: "done", verdict: "go", score: "87", blockers: 0 } },
  { ...BASE, id: "t2", reference: "AO-2026-002", title: "Audit des systèmes d’information", analysis: { runId: "r2", status: "done", verdict: "no-go", score: "42", blockers: 2 } },
  { ...BASE, id: "t3", reference: "AO-2026-003", title: "Assistance technique et maîtrise d’ouvrage", status: "analyzing", analysis: { runId: "r3", status: "running" } },
  { ...BASE, id: "t4", reference: "AO-2026-004", title: "Étude de faisabilité et conseil", status: "pending", analysis: null },
];
// A finished no-go run: the fixture the detail screen is built for. `AO-2026-002`
// is the dossier the README documents as a no-go, so the numbers match the product.
export const ANALYSIS = {
  runId: "r2", tenderId: "t2", status: "done", error: null, pendingQuestion: null,
  nodeTrace: [
    { node: "ingest", at: "2026-09-12T09:00:00.000Z", summary: "4 pages lues, dont 4 par OCR", status: "ok", ms: 34042 },
    { node: "extractRequirements", at: "2026-09-12T09:00:34.000Z", summary: "11 exigences extraites", status: "ok", ms: 13228 },
    { node: "matchProfile", at: "2026-09-12T09:00:47.000Z", summary: "0/11 couvertes par le profil", status: "ok", ms: 21990 },
    { node: "decide", at: "2026-09-12T09:01:09.000Z", summary: "no-go - 1 point(s) bloquant(s)", status: "ok", ms: 2 },
  ],
  result: {
    verdict: "no-go", confidence: 0.82, score: "42",
    justification: "Une certification exigée à peine de rejet n'est pas détenue.",
    blockers: [{ requirementId: "q1", text: "Le candidat doit être titulaire de la certification ISO 22301:2019.", reason: "Les certifications détenues sont ISO 9001:2015, ISO 27001:2022 et Qualiopi.", sourcePage: 7, sourceArticle: "4.2", sourceDocumentId: "d1" }],
    warnings: [{ label: "Valeur technique", text: "Risque sur « Valeur technique » : 12 points projetés pour un seuil éliminatoire de 20.", detail: "Projection indicative fondée sur la couverture des exigences, pas une note réelle. À confirmer par un humain." }],
    unreadPages: [{ documentId: "d1", page: 9 }],
    rubricBreakdown: [
      { label: "Valeur technique", points: 12, maxPoints: 40 },
      { label: "Références", points: 18, maxPoints: 30 },
      { label: "Prix", points: 12, maxPoints: 30 },
    ],
  },
  sections: [{ id: "s1", sectionKey: "methodologie", title: "Méthodologie", content: "Notre approche se déroule en trois phases.", editedByHuman: false }],
};
// The same run, parked on a question the agent asked. `pendingQuestion` is what
// the screen renders the pause from after a refresh, when the stream that first
// announced it is long gone.
export const PENDING_QUESTION = {
  askId: "ask-1",
  askKey: "abc123",
  node: "matchProfile",
  question: "Detenez-vous la certification ISO 22301, meme non jointe au dossier ?",
  raison: "Pour ne pas vous ecarter sur une certification que vous avez peut-etre.",
  options: [
    { value: "oui", label: "Oui, nous la detenons" },
    { value: "non", label: "Non" },
    { value: "inconnu", label: "Je ne sais pas" },
  ],
  askedAt: "2026-09-12T09:00:50.000Z",
};

export const REQUIREMENTS = [
  { id: "q2", tenderId: "t2", text: "Fournir une attestation fiscale de moins de trois mois.", obligation: "obligatoire", category: "administratif", nature: "document", sourcePage: 3, sourceArticle: "2.1", sourceDocumentId: "d1", quote: "attestation fiscale de moins de trois mois", match: { requirementId: "q2", status: "met", evidence: ["REF-01"], reason: "Attestation fiscale du 12/08/2026 présente au dossier entreprise.", confidence: 0.91 } },
  { id: "q1", tenderId: "t2", text: "Le candidat doit être titulaire de la certification ISO 22301:2019.", obligation: "eliminatoire", category: "capacite", nature: "capacite", sourcePage: 7, sourceArticle: "4.2", sourceDocumentId: "d1", quote: "titulaire de la certification ISO 22301:2019", match: { requirementId: "q1", status: "unmet", evidence: [], reason: "Aucune certification ISO 22301 dans le profil : ISO 9001, ISO 27001 et Qualiopi uniquement.", confidence: 0.88 } },
  { id: "q3", tenderId: "t2", text: "Une démarche d'éco-conception est valorisée.", obligation: "optionnelle", category: "technique", nature: "moyen", sourcePage: 11, sourceArticle: null, sourceDocumentId: null, quote: null, match: null },
];
/** The analysis payload as the api sends it. Loose on purpose: a test builds
 *  partial envelopes (queued, failed, no sections) from the fixture above. */
type Envelope = Record<string, unknown> | null;
// A filled company: the shape /company sends once a profil-entreprise.json has been
// imported. Two secteurs and two document kinds, so the filters have something to do.
export const COMPANY = {
  profile: { ice: "001234567000089", raisonSociale: "Atlas Ingenierie SARL", siege: "Casablanca", effectif: 42, certifications: ["ISO 9001:2015", "Qualiopi"], secteurs: ["Ferroviaire", "Industrie"] },
  references: [
    { id: "REF-01", client: "ONCF", secteur: "Ferroviaire", objet: "Maintenance des voies sur la ligne Casablanca-Rabat" },
    { id: "REF-02", client: "OCP", secteur: "Industrie", objet: "Genie civil sur le site de Khouribga" },
  ],
  team: [
    { id: "CV-01", initiales: "S.B.", poste: "Directrice de projet", anneesExperience: 14, diplome: "Ingenieure EMI", certifications: ["PMP"], langues: ["FR", "EN"] },
    { id: "CV-02", initiales: "Y.T.", poste: "Conducteur de travaux", anneesExperience: 9, diplome: "EHTP", certifications: [], langues: ["FR", "AR"] },
  ],
};
// The Controle screen: one finished run and one that failed, so the list has a
// status to distinguish and the detail has both a trace and a token table.
export const RUNS = [
  { runId: "r2", tenderId: "t2", reference: "AO-2026-002", title: "Audit des systemes d'information", status: "done", graphVersion: "v1", startedAt: "2026-09-12T09:00:00.000Z", finishedAt: "2026-09-12T09:01:09.000Z", durationMs: 69_000, error: null, awaiting: false, steps: 4, totalTokens: 38_210, calls: 9 },
  { runId: "r5", tenderId: "t1", reference: "AO-2026-001", title: null, status: "failed", graphVersion: "v1", startedAt: "2026-09-11T08:00:00.000Z", finishedAt: "2026-09-11T08:00:12.000Z", durationMs: 12_000, error: "Le modele n a pas repondu.", awaiting: false, steps: 1, totalTokens: 1_240, calls: 1 },
];
export const RUN_DETAIL = {
  ...RUNS[0],
  nodeTrace: [
    ...ANALYSIS.nodeTrace,
    { node: "matchProfile", at: "2026-09-12T09:00:48.000Z", summary: "Recherche dans le corpus", status: "ok", ms: 900, tools: [{ name: "search_documents", raison: "Verifier la certification", outcome: "2 passages trouves" }] },
  ],
  pendingQuestion: null,
  usage: [
    { operation: "extractor", tier: "volume", model: "gpt-4.1", calls: 4, promptTokens: 18_000, completionTokens: 4_200, totalTokens: 22_200, avgLatencyMs: 3_100, errors: 0 },
    { operation: "matcher", tier: "reasoning", model: "gpt-5.5", calls: 3, promptTokens: 12_010, completionTokens: 4_000, totalTokens: 16_010, avgLatencyMs: 5_400, errors: 1 },
  ],
  result: ANALYSIS.result,
};
export const COMPANY_DOCUMENTS = [
  { id: "d10", kind: "attestation", originalName: "attestation-fiscale.pdf", pageCount: 2, extractionPath: "text" },
  { id: "d11", kind: "memoire", originalName: "memoire-technique-2025.pdf", pageCount: 18, extractionPath: "text" },
];
interface MockOptions { runs?: typeof RUNS; demoFailure?: boolean; signedIn?: boolean; empty?: boolean; failTenders?: boolean; loginFailure?: boolean; uploadFailure?: boolean; analysis?: Envelope; requirements?: (typeof REQUIREMENTS[number] & { quoteVerified?: boolean })[]; saveFailure?: boolean; company?: boolean }
export async function mockWorkspaceApi(page: Page, options: MockOptions = {}) {
  const state = { signedIn: options.signedIn ?? true, empty: options.empty ?? false, failTenders: options.failTenders ?? false, loginFailure: options.loginFailure ?? false, uploadFailure: options.uploadFailure ?? false, saveFailure: options.saveFailure ?? false, analysis: (options.analysis ?? null) as Envelope, requirements: options.requirements ?? [], company: options.company ?? false, runs: options.runs ?? RUNS, demoFailure: options.demoFailure ?? false, posts: [] as string[], patches: [] as unknown[], answers: [] as unknown[] };
  // The Next dev overlay button sits in the bottom-left corner, on top of the rail's
  // account control. It only exists under `next dev`, so hide it for the whole run.
  await page.addInitScript(() => {
    const style = document.createElement("style");
    style.textContent = "nextjs-portal { display: none !important; }";
    document.addEventListener("DOMContentLoaded", () => document.head.append(style));
  });
  await page.route("http://localhost:4000/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    const send = (json: unknown, status = 200) => route.fulfill({ status, json });
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "http://127.0.0.1:4101", "access-control-allow-credentials": "true", "access-control-allow-methods": "GET,POST,PATCH", "access-control-allow-headers": "content-type" } });
    if (method === "POST") state.posts.push(path);
    if (path === "/auth/me") return state.signedIn ? send({ user: USER }) : send({ error: "Non connecté", code: "UNAUTHORIZED" }, 401);
    if (path === "/auth/login" || path === "/auth/signup") {
      if (state.loginFailure) return send({ error: "Identifiants incorrects.", code: "INVALID_CREDENTIALS" }, 401);
      state.signedIn = true;
      return send({ user: USER });
    }
    if (path === "/auth/demo") {
      if (state.demoFailure) return send({ error: "Espace de demonstration indisponible.", code: "DEMO_UNAVAILABLE" }, 503);
      state.signedIn = true;
      return send({ user: USER }, 201);
    }
    if (path === "/analyses" && method === "GET") return send({ runs: state.runs });
    // One segment only: /analyses/:runId/answer and /sections are handled below.
    if (/^\/analyses\/[^/]+$/.test(path)) return send(RUN_DETAIL);
    if (path === "/auth/logout") { state.signedIn = false; return route.fulfill({ status: 204 }); }
    if (path === "/company") return send(state.company ? COMPANY : { profile: null, references: [], team: [] });
    if (path === "/company/documents") return send({ documents: state.company ? COMPANY_DOCUMENTS : [] });
    if (path === "/tenders" && method === "GET") return state.failTenders ? send({ error: "Service temporairement indisponible", code: "UNAVAILABLE" }, 503) : send({ tenders: state.empty ? [] : TENDERS });
    if (path === "/tenders" && method === "POST") return send({ ...TENDERS[3], ...route.request().postDataJSON(), id: "created", documents: [] });
    if (path.endsWith("/documents") && method === "POST") return state.uploadFailure ? send({ error: "Envoi interrompu. Réessayez.", code: "UPLOAD_FAILED" }, 503) : send({ id: "doc", kind: "avis", originalName: "avis.pdf", pageCount: 1, extractionPath: "pending" });
    if (path.endsWith("/analyze") && method === "POST") {
      // Mirrors the api: the run is queued, and the UI learns the rest by polling.
      state.analysis = { ...ANALYSIS, status: "queued", nodeTrace: [], result: null, sections: [] };
      return send({ runId: "r2", status: "queued" });
    }
    // The live stream, stubbed as one frame and then silence. The screen must
    // stay correct on the poll alone, so a stream that says nothing is exactly
    // the condition worth holding the specs to.
    if (path.endsWith("/analysis/stream")) {
      return route.fulfill({
        status: 200,
        headers: { "content-type": "text/event-stream", "cache-control": "no-cache" },
        body: `data: ${JSON.stringify({ type: "status", status: state.analysis?.status ?? "queued" })}

`,
      });
    }
    if (path.endsWith("/analysis")) return state.analysis ? send(state.analysis) : send({ error: "Aucune analyse", code: "ANALYSIS_NOT_FOUND" }, 404);
    if (path.endsWith("/answer") && method === "POST") {
      state.answers.push(route.request().postDataJSON());
      // Mirrors the api: the answer is recorded, the run goes back on the queue,
      // and the graph resumes from its checkpoint in the worker.
      state.analysis = { ...(state.analysis ?? ANALYSIS), status: "queued", pendingQuestion: null };
      return send({ runId: "r2", status: "queued" }, 202);
    }
    if (path.endsWith("/requirements")) return send({ requirements: state.requirements, rubric: [] });
    if (path.endsWith("/sections") && method === "PATCH") {
      if (state.saveFailure) return send({ error: "Enregistrement impossible.", code: "SAVE_FAILED" }, 503);
      state.patches.push(route.request().postDataJSON());
      const patch = route.request().postDataJSON();
      const envelope = state.analysis as typeof ANALYSIS | null;
      if (envelope) {
        state.analysis = { ...envelope, sections: envelope.sections.map((section) => section.sectionKey === patch.sectionKey ? {
          ...section, ...patch, editedByHuman: true, validatedByHuman: patch.validatedByHuman === true,
          needsHuman: patch.validatedByHuman !== true,
          complianceWarnings: patch.validatedByHuman ? [] : (section as { complianceWarnings?: string[] }).complianceWarnings ?? [],
        } : section) };
      }
      return send({ id: "s1", ...patch, editedByHuman: true });
    }
    if (path.startsWith("/tenders/")) {
      const tender = TENDERS.find((entry) => entry.id === path.split("/")[2]);
      return send({ ...(tender ?? TENDERS[3]), id: tender?.id ?? "created", documents: [{ id: "d1", kind: "cps", originalName: "cps.pdf", pageCount: 12, extractionPath: "cache/cps.json" }] });
    }
    return send({ error: "Unexpected mock request", code: "NOT_FOUND" }, 404);
  });
  return state;
}
