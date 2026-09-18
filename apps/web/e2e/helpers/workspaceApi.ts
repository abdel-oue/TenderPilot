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
  runId: "r2", tenderId: "t2", status: "done", error: null,
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
export const REQUIREMENTS = [
  { id: "q2", tenderId: "t2", text: "Fournir une attestation fiscale de moins de trois mois.", obligation: "obligatoire", category: "administratif", nature: "document", sourcePage: 3, sourceArticle: "2.1", sourceDocumentId: "d1", quote: "attestation fiscale de moins de trois mois", match: { requirementId: "q2", status: "met", evidence: ["REF-01"], reason: "Attestation fiscale du 12/08/2026 présente au dossier entreprise.", confidence: 0.91 } },
  { id: "q1", tenderId: "t2", text: "Le candidat doit être titulaire de la certification ISO 22301:2019.", obligation: "eliminatoire", category: "capacite", nature: "capacite", sourcePage: 7, sourceArticle: "4.2", sourceDocumentId: "d1", quote: "titulaire de la certification ISO 22301:2019", match: { requirementId: "q1", status: "unmet", evidence: [], reason: "Aucune certification ISO 22301 dans le profil : ISO 9001, ISO 27001 et Qualiopi uniquement.", confidence: 0.88 } },
  { id: "q3", tenderId: "t2", text: "Une démarche d'éco-conception est valorisée.", obligation: "optionnelle", category: "technique", nature: "moyen", sourcePage: 11, sourceArticle: null, sourceDocumentId: null, quote: null, match: null },
];
/** The analysis payload as the api sends it. Loose on purpose: a test builds
 *  partial envelopes (queued, failed, no sections) from the fixture above. */
type Envelope = Record<string, unknown> | null;
interface MockOptions { signedIn?: boolean; empty?: boolean; failTenders?: boolean; loginFailure?: boolean; uploadFailure?: boolean; analysis?: Envelope; requirements?: typeof REQUIREMENTS; saveFailure?: boolean }
export async function mockWorkspaceApi(page: Page, options: MockOptions = {}) {
  const state = { signedIn: options.signedIn ?? true, empty: options.empty ?? false, failTenders: options.failTenders ?? false, loginFailure: options.loginFailure ?? false, uploadFailure: options.uploadFailure ?? false, saveFailure: options.saveFailure ?? false, analysis: (options.analysis ?? null) as Envelope, requirements: options.requirements ?? [], posts: [] as string[], patches: [] as unknown[] };
  await page.route("http://localhost:3000/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    const send = (json: unknown, status = 200) => route.fulfill({ status, json });
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "http://127.0.0.1:3101", "access-control-allow-credentials": "true", "access-control-allow-methods": "GET,POST,PATCH", "access-control-allow-headers": "content-type" } });
    if (method === "POST") state.posts.push(path);
    if (path === "/auth/me") return state.signedIn ? send({ user: USER }) : send({ error: "Non connecté", code: "UNAUTHORIZED" }, 401);
    if (path === "/auth/login" || path === "/auth/signup") {
      if (state.loginFailure) return send({ error: "Identifiants incorrects.", code: "INVALID_CREDENTIALS" }, 401);
      state.signedIn = true;
      return send({ user: USER });
    }
    if (path === "/auth/logout") { state.signedIn = false; return route.fulfill({ status: 204 }); }
    if (path === "/company") return send({ profile: null, references: [], team: [] });
    if (path === "/company/documents") return send({ documents: [] });
    if (path === "/tenders" && method === "GET") return state.failTenders ? send({ error: "Service temporairement indisponible", code: "UNAVAILABLE" }, 503) : send({ tenders: state.empty ? [] : TENDERS });
    if (path === "/tenders" && method === "POST") return send({ ...TENDERS[3], ...route.request().postDataJSON(), id: "created", documents: [] });
    if (path.endsWith("/documents") && method === "POST") return state.uploadFailure ? send({ error: "Envoi interrompu. Réessayez.", code: "UPLOAD_FAILED" }, 503) : send({ id: "doc", kind: "avis", originalName: "avis.pdf", pageCount: 1, extractionPath: "pending" });
    if (path.endsWith("/analyze") && method === "POST") {
      // Mirrors the api: the run is queued, and the UI learns the rest by polling.
      state.analysis = { ...ANALYSIS, status: "queued", nodeTrace: [], result: null, sections: [] };
      return send({ runId: "r2", status: "queued" });
    }
    if (path.endsWith("/analysis")) return state.analysis ? send(state.analysis) : send({ error: "Aucune analyse", code: "ANALYSIS_NOT_FOUND" }, 404);
    if (path.endsWith("/requirements")) return send({ requirements: state.requirements, rubric: [] });
    if (path.endsWith("/sections") && method === "PATCH") {
      if (state.saveFailure) return send({ error: "Enregistrement impossible.", code: "SAVE_FAILED" }, 503);
      state.patches.push(route.request().postDataJSON());
      return send({ id: "s1", sectionKey: "methodologie", title: "Méthodologie", content: "", editedByHuman: true });
    }
    if (path.startsWith("/tenders/")) {
      const tender = TENDERS.find((entry) => entry.id === path.split("/")[2]);
      return send({ ...(tender ?? TENDERS[3]), id: tender?.id ?? "created", documents: [{ id: "d1", kind: "cps", originalName: "cps.pdf", pageCount: 12, extractionPath: "cache/cps.json" }] });
    }
    return send({ error: "Unexpected mock request", code: "NOT_FOUND" }, 404);
  });
  return state;
}
