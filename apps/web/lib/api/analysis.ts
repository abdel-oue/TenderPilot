// Fetch wrappers for analysis.
import { apiUrl, ApiError, request } from "./client";
import type { AnalysisEnvelope, HumanAnswer } from "@/lib/types";

/**
 * Returns null when no analysis has ever run for this dossier. That is a normal
 * state - the user has not pressed "analyser" yet - not an error to surface.
 */
export async function fetchAnalysis(tenderId: string): Promise<AnalysisEnvelope | null> {
  try {
    return (await request(`/tenders/${tenderId}/analysis`)) as AnalysisEnvelope;
  } catch (error) {
    if (error instanceof ApiError && error.code === "ANALYSIS_NOT_FOUND") return null;
    throw error;
  }
}

export async function startAnalysis(tenderId: string) {
  return (await request(`/tenders/${tenderId}/analyze`, { body: {} })) as {
    runId: string;
    status: string;
  };
}

/** EX-06: the human correction, kept and reused by later sections. */
export async function saveSection(
  runId: string,
  input: { sectionKey: string; title: string; content: string; validatedByHuman?: boolean },
) {
  return await request(`/analyses/${runId}/sections`, { method: "PATCH", body: input });
}

/**
 * The human's reply to a question the agent asked. 202: the run goes back on the
 * queue and resumes from its checkpoint, it does not finish inside this request.
 */
export async function answerQuestion(runId: string, answer: HumanAnswer) {
  return (await request(`/analyses/${runId}/answer`, { body: answer })) as {
    runId: string;
    status: string;
  };
}

export async function reviewDecision(runId: string, input: { verdictOverride: "go" | "no-go"; instruction: string; dismissedBlockers: string[] }) {
  return request(`/analyses/${runId}/decision`, { body: input });
}

/**
 * The live event stream for a run. EventSource, not fetch: it reconnects on its
 * own and the browser owns the retry, which is the whole reason to use it.
 *
 * `withCredentials` matters - the session is an httpOnly cookie on the api's
 * origin, and without it the stream is rejected as anonymous.
 */
export function runStreamUrl(tenderId: string): string {
  return apiUrl(`/tenders/${tenderId}/analysis/stream`);
}

/** EX-05: a plain download link, so the browser handles the file. */
export function exportDocxUrl(runId: string): string {
  return apiUrl(`/analyses/${runId}/export.docx`);
}
