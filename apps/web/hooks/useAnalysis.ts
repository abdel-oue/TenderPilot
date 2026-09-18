"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAnalysis, saveSection, startAnalysis } from "@/lib/api/analysis";
import { tenderKeys } from "@/lib/keys/tenderKeys";

/**
 * Polls while the graph is running, stops when it is not.
 *
 * Polling rather than SSE: the trace already lives in the database (it survives a
 * refresh, which an in-memory stream would not), so a one-second GET is the whole
 * feature. A stream would be a second transport for data we already store.
 */
export function useAnalysis(tenderId: string) {
  return useQuery({
    queryKey: tenderKeys.analysis(tenderId),
    queryFn: () => fetchAnalysis(tenderId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "queued" || status === "running" ? 1000 : false;
    },
  });
}

export function useStartAnalysis(tenderId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => startAnalysis(tenderId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tenderKeys.detail(tenderId) }),
  });
}

/** EX-06. Invalidates the analysis so the saved text is what the panel shows next. */
export function useSaveSection(tenderId: string, runId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { sectionKey: string; title: string; content: string }) =>
      saveSection(runId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tenderKeys.analysis(tenderId) }),
  });
}
