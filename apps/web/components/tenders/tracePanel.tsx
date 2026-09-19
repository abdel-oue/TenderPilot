// The agent activity feed — one row per graph node, as it happens.
//
// This is the "profondeur agentique" criterion made visible: the jury asked to
// see the agent reason, not only its result. The entries come from the database,
// so a refresh mid-run does not lose the history.
import { formatDateTime, formatDuration } from "@/lib/utils/formatUtils";
import { cn } from "@/lib/utils/classNameUtils";
import type { TraceEntry } from "@/lib/types";

interface TracePanelProps {
  trace: TraceEntry[];
  status: string;
}

export default function TracePanel({ trace, status }: TracePanelProps) {
  return (
    <div data-testid="trace-panel" className="rounded-md border border-border bg-surface p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide">Trace de l&apos;agent</h2>
        <span data-testid="analysis-status" className="text-mini uppercase text-muted">
          {status}
        </span>
      </div>

      {trace.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Aucune étape pour le moment.</p>
      ) : (
        <ol className="mt-3 space-y-2">
          {trace.map((entry, index) => (
            <li key={`${entry.node}-${index}`} className="flex gap-3 text-sm">
              <span className="w-20 shrink-0 text-mini text-muted">{formatDateTime(entry.at)}</span>
              <span
                className={cn(
                  "w-44 shrink-0 font-medium",
                  entry.status === "error" && "text-no-go",
                )}
              >
                {entry.node}
              </span>
              <div className="flex-1 space-y-1">
                <p className="text-muted">{entry.summary}</p>
                {/* The tools the agent CHOSE to call on this step. Without this
                    row the belt is a claim; with it, it is something the reader
                    watches happen. */}
                {entry.tools && entry.tools.length > 0 ? (
                  <ul data-testid="trace-tools" className="space-y-1.5 pt-1">
                    {entry.tools.map((tool, position) => (
                      <li
                        key={`${tool.name}-${position}`}
                        data-testid="trace-tool"
                        className="border-l-2 border-border pl-2"
                      >
                        {/* The model's own reason, in the reader's language. */}
                        {tool.raison ? <p className="text-mini">{tool.raison}</p> : null}
                        <p className="text-mini text-muted">
                          <span aria-hidden="true">↳ </span>
                          {tool.outcome}
                        </p>
                        {/* Secondary on purpose: the dirigeant ignores it, a
                            technical reader wants to see a real named tool. */}
                        <span
                          data-testid="trace-tool-name"
                          className="font-mono text-mini text-muted/60"
                        >
                          {tool.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <span className="shrink-0 text-mini text-muted">{formatDuration(entry.ms)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
