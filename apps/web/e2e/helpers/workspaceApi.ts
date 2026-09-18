import type { Page } from "@playwright/test";
export const USER = { id: "b8be4ed1-9603-4e77-a8ba-d47a99b08255", name: "Samira Benali", email: "samira@example.com", createdAt: "2026-09-01T10:00:00.000Z" };
const BASE = { buyer: "Ville de Rabat", estimatedValue: null, createdAt: "2026-09-10T12:00:00.000Z", deadline: "2099-09-25", status: "analyzed" };
export const TENDERS = [
  { ...BASE, id: "t1", reference: "AO-2026-001", title: "Accompagnement à la transformation digitale", analysis: { runId: "r1", status: "done", verdict: "go", score: "87", blockers: 0 } },
  { ...BASE, id: "t2", reference: "AO-2026-002", title: "Audit des systèmes d’information", analysis: { runId: "r2", status: "done", verdict: "no-go", score: "42", blockers: 2 } },
  { ...BASE, id: "t3", reference: "AO-2026-003", title: "Assistance technique et maîtrise d’ouvrage", status: "analyzing", analysis: { runId: "r3", status: "running" } },
  { ...BASE, id: "t4", reference: "AO-2026-004", title: "Étude de faisabilité et conseil", status: "pending", analysis: null },
];
interface MockOptions { signedIn?: boolean; empty?: boolean; failTenders?: boolean; loginFailure?: boolean; uploadFailure?: boolean }
export async function mockWorkspaceApi(page: Page, options: MockOptions = {}) {
  const state = { signedIn: options.signedIn ?? true, empty: options.empty ?? false, failTenders: options.failTenders ?? false, loginFailure: options.loginFailure ?? false, uploadFailure: options.uploadFailure ?? false, posts: [] as string[] };
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
    if (path.endsWith("/analysis")) return send({ error: "Aucune analyse", code: "ANALYSIS_NOT_FOUND" }, 404);
    if (path.endsWith("/requirements")) return send({ requirements: [] });
    if (path.startsWith("/tenders/")) return send({ ...TENDERS[3], id: "created", documents: [] });
    return send({ error: "Unexpected mock request", code: "NOT_FOUND" }, 404);
  });
  return state;
}
