// Fetch wrappers for analysis.
import { apiUrl, ApiError, request } from "./client";
import type { AnalysisEnvelope } from "@/lib/types";

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
  input: { sectionKey: string; title: string; content: string },
) {
  return await request(`/analyses/${runId}/sections`, { method: "PATCH", body: input });
}

/** EX-05: a plain download link, so the browser handles the file. */
export function exportDocxUrl(runId: string): string {
  return apiUrl(`/analyses/${runId}/export.docx`);
}
