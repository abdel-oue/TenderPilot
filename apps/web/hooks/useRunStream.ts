"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { runStreamUrl } from "@/lib/api/analysis";
import { tenderKeys } from "@/lib/keys/tenderKeys";
import { LIVE_STATUSES, type AnalysisStatus, type RunEvent } from "@/lib/types";

/**
 * The live half of the analysis screen.
 *
 * It is a mirror, never a source of truth. Everything here is also in the
 * database and also arrives on the one-second poll in useAnalysis; this only
 * gets it to the screen sooner. So there is no reconnect logic, no buffering and
 * no error surface: EventSource retries on its own, and if it never comes back
 * the screen is exactly what it was before any of this existed.
 *
 * The one thing it does that the poll cannot: a tool row the moment that tool
 * returns. The durable trace is written per NODE, so a node calling six tools
 * over twenty seconds is silent and then says everything at once.
 *
 * @param tenderId the dossier being watched
 * @param runId the current run; a new one empties the buffer
 * @param status the run status from the poll; the stream is open only while live
 * @returns the tool events received during this mount, oldest first
 */
export function useRunStream(
  tenderId: string,
  runId: string | undefined,
  status: AnalysisStatus | undefined,
) {
  const queryClient = useQueryClient();
  const [liveTools, setLiveTools] = useState<Extract<RunEvent, { type: "tool" }>[]>([]);
  const [bufferedRun, setBufferedRun] = useState(runId);
  const live = Boolean(status && LIVE_STATUSES.includes(status));

  // Adjusted during render rather than in an effect: a new run must not show the
  // previous run's tools for the one frame an effect would take to clear them.
  // This is React's documented way to reset state when a prop changes.
  if (runId !== bufferedRun) {
    setBufferedRun(runId);
    setLiveTools([]);
  }

  useEffect(() => {
    if (!live) return;

    const source = new EventSource(runStreamUrl(tenderId), { withCredentials: true });

    source.onmessage = (message) => {
      let event: RunEvent;
      try {
        event = JSON.parse(message.data) as RunEvent;
      } catch {
        return;
      }

      if (event.type === "tool") {
        setLiveTools((tools) => [...tools, event]);
        return;
      }
      // A node finished, the status moved, or a question was asked. All three
      // change what the envelope says, and the envelope is the poll's business:
      // refetching keeps one shape on screen instead of merging two.
      void queryClient.invalidateQueries({ queryKey: tenderKeys.analysis(tenderId) });
    };

    // Nothing here. An error means EventSource is already retrying, and a
    // message to that effect would be noise about a thing that self-heals.
    source.onerror = () => {};

    return () => source.close();
    // runId is a dependency even though the URL does not contain it: the server
    // resolves the run at connect time, so a stream opened for the previous run
    // would keep listening on its channel and hear nothing from this one.
  }, [tenderId, runId, live, queryClient]);

  return liveTools;
}
