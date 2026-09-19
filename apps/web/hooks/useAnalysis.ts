"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { answerQuestion, fetchAnalysis, saveSection, startAnalysis } from "@/lib/api/analysis";
import { tenderKeys } from "@/lib/keys/tenderKeys";
import { LIVE_STATUSES, type HumanAnswer } from "@/lib/types";

/**
 * Polls while the run is still going to do something, stops when it is not.
 *
 * The poll stayed when the stream arrived, and that is deliberate. The trace
 * lives in the database, so this is what makes the screen correct after a
 * refresh, after a reconnect, and on any network that eats SSE. The stream
 * (useRunStream) only makes it faster.
 *
 * `awaiting_human` counts as live: the run is parked, not finished, and dropping
 * the poll there would leave the screen frozen on a question already answered
 * from another tab.
 */
export function useAnalysis(tenderId: string) {
  return useQuery({
    queryKey: tenderKeys.analysis(tenderId),
    queryFn: () => fetchAnalysis(tenderId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && LIVE_STATUSES.includes(status) ? 1000 : false;
    },
  });
}

/**
 * Answers the question the agent asked and puts the run back on the queue.
 * Invalidates immediately so the screen leaves `awaiting_human` without waiting
 * for the next poll tick.
 */
export function useAnswerQuestion(tenderId: string, runId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (answer: HumanAnswer) => answerQuestion(runId!, answer),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tenderKeys.analysis(tenderId) }),
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
