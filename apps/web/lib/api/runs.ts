// Fetch wrappers for analysis runs — the Contrôle screen. Ownership is the
// session's, so no id is ever passed for the list.
import type { RunDetail, RunSummary } from "@/lib/types";
import { request } from "./client";

export async function fetchRuns(): Promise<RunSummary[]> {
  const payload = (await request("/analyses")) as { runs: RunSummary[] };
  return payload.runs;
}

export async function fetchRunDetail(runId: string): Promise<RunDetail> {
  return (await request(`/analyses/${runId}`)) as RunDetail;
}
