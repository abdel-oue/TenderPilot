"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchRunDetail, fetchRuns } from "@/lib/api/runs";
import { runKeys } from "@/lib/keys/runKeys";
import { LIVE_STATUSES } from "@/lib/types";

/**
 * Every run this user has launched. Refetches while one is still live, so a
 * run started from a dossier screen lands here without a reload.
 */
export function useRuns() {
  return useQuery({
    queryKey: runKeys.lists(),
    queryFn: fetchRuns,
    refetchInterval: (query) =>
      query.state.data?.some((run) => LIVE_STATUSES.includes(run.status)) ? 3000 : false,
  });
}

/**
 * One run in full. Only fetched once its row is expanded — a list of fifty runs
 * has no business pulling fifty traces.
 */
export function useRunDetail(runId: string | null) {
  return useQuery({
    queryKey: runKeys.detail(runId ?? ""),
    queryFn: () => fetchRunDetail(runId!),
    enabled: runId !== null,
  });
}
