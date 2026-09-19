"use client";
// The agent, working. One row per graph node, and under each one the tools it
// chose to call, as they return.
//
// This is the "profondeur agentique" criterion made visible: the jury asked to
// see the agent reason, not only its result. Two sources feed it and they carry
// the same shape on purpose — the durable trace from the database, which is what
// survives a refresh, and the live tool events from the stream, which are what
// make a twenty-second node something other than a spinner.
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import type { RunEvent, TraceEntry, ToolNarration } from "@/lib/types";
import { formatDateTime, formatDuration } from "@/lib/utils/formatUtils";
import { nodePhrase } from "@/lib/utils/traceUtils";
import { fadeUp, stagger } from "@/lib/utils/motionUtils";
import { cn } from "@/lib/utils/classNameUtils";

type LiveTool = Extract<RunEvent, { type: "tool" }>;

interface ThinkingFeedProps {
  trace: TraceEntry[];
  liveTools: LiveTool[];
  running: boolean;
  /** Collapsed after the run; the summary strip expands it again. */
  expanded: boolean;
  onToggle: () => void;
}

/** One tool call, whichever source it came from. */
function Elapsed({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return <>{formatDuration(Math.max(0, now - Date.parse(startedAt)))}</>;
}

/** The trailing " · 3s" / " · 12.4s" duration badge, live while the row is still running. */
function ElapsedOrDuration({ ticking, running, startedAt, ms }: { ticking: boolean; running: boolean; startedAt?: string; ms?: number }) {
  if (ticking && running && startedAt) {
    return <> · <Elapsed startedAt={startedAt} /></>;
  }
  return <>{ms === undefined ? "" : ` · ${formatDuration(ms)}`}</>;
}

function ToolRow({ name, raison, outcome, ms, status, startedAt, ticking }: ToolNarration & { ticking: boolean }) {
  return (
    <div className="flex items-start gap-3 py-1" data-testid="trace-tool">
      <div className="min-w-0 flex-1">
        {/* The model's own words for why it reached for this tool. */}
        {raison ? <p className="text-xs leading-5">« {raison} »</p> : null}
        {/* Built from the real result by lib/narration.js, never from the model:
            an empty search says so here whatever the model claimed. */}
        <p className="mt-0.5 text-mini leading-5 text-muted">{status === "running" && !ticking ? "Appel suspendu ou interrompu" : outcome}</p>
      </div>
      {/* Secondary on purpose: the dirigeant ignores it, a technical reader
          wants to see that a real named tool ran. */}
      <span
        data-testid="trace-tool-name"
        className="shrink-0 pt-0.5 font-mono text-mini text-muted/60"
      >
        {name}
        <ElapsedOrDuration ticking={ticking} running={status === "running"} startedAt={startedAt} ms={ms} />
      </span>
    </div>
  );
}

/** What a trace row's main line should say, given its status and whether it's the active row. */
function entrySummary(entry: TraceEntry, isActive: boolean): string {
  if (entry.status === "human") return `Vous : ${entry.choiceLabel ?? entry.choice}`;
  if (entry.status === "running") return isActive ? nodePhrase(entry.node) : "Étape suspendue ou interrompue";
  return entry.summary;
}

export function ThinkingFeed({ trace, liveTools, running, expanded, onToggle }: ThinkingFeedProps) {
  const reduced = useReducedMotion();
  const active = running ? trace.findLast((entry) => entry.status === "running") : undefined;

  // Tools already written into a node's trace row are the same calls the stream
  // announced. Once the row lands, it wins: it is the durable copy.
  const settled = new Set(trace.flatMap((entry) => (entry.tools ?? []).map((t) => t.id ?? t.name + "|" + t.outcome)));
  const pendingTools = liveTools.filter((tool) => !settled.has(tool.id ?? tool.name + "|" + tool.outcome));
  const latestTool = (tool: ToolNarration) => {
    const live = tool.id ? liveTools.find((item) => item.id === tool.id) : undefined;
    if (tool.status && tool.status !== "running" && live?.status === "running") return tool;
    return live && (live.at >= (tool.at ?? "")) ? live : tool;
  };

  return (
    <div data-testid="trace-panel">
      <button
        className="flex w-full cursor-pointer items-center justify-center gap-2 text-mini uppercase tracking-label text-muted transition duration-200 hover:text-foreground"
        aria-expanded={expanded}
        data-testid="trace-toggle"
        onClick={onToggle}
      >
        <Sparkles size={13} />
        Raisonnement de l&apos;agent
        <ChevronDown size={13} className={cn("transition duration-200", expanded && "rotate-180")} />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.ol
            className="mt-4 space-y-3 text-left"
            variants={stagger(reduced)}
            initial="hidden"
            animate="visible"
            exit="hidden"
          >
            {trace.map((entry, index) => (
              <motion.li
                key={entry.id ?? `${entry.node}-${entry.at}-${index}`}
                variants={fadeUp(reduced, 8)}
                data-testid="trace-entry"
                className={cn(
                  "rounded-xl px-3 py-2.5",
                  entry.status === "human" ? "bg-accent-soft" : "bg-surface",
                )}
              >
                <div className="flex items-baseline gap-3">
                  <span className="w-16 shrink-0 text-mini tabular-nums text-muted">
                    {formatDateTime(entry.at)}
                  </span>
                  <p
                    className={cn(
                      "min-w-0 flex-1 text-xs",
                      entry.status === "error" && "text-no-go",
                      entry.status === "human" && "font-medium text-accent",
                    )}
                  >
                    {entrySummary(entry, entry === active)}
                  </p>
                  {/* Name on the right and small: the node is how it happened,
                      the summary above is what happened. */}
                  <span className="shrink-0 font-mono text-mini text-muted/60">
                    {entry.node}
                    <ElapsedOrDuration ticking={entry === active} running={entry === active} startedAt={entry.startedAt} ms={entry.ms} />
                  </span>
                </div>

                {entry.status === "human" && entry.instruction ? (
                  <p className="mt-1 pl-[4.75rem] text-mini leading-5 text-muted">
                    « {entry.instruction} »
                  </p>
                ) : null}

                {entry.tools && entry.tools.length > 0 ? (
                  <div
                    data-testid="trace-tools"
                    className="mt-1.5 space-y-1 border-l border-border pl-3 md:ml-[4.75rem]"
                  >
                    {entry.tools.map((tool, position) => (
                      <ToolRow key={tool.id ?? `${tool.name}-${position}`} {...latestTool(tool)} ticking={entry === active} />
                    ))}
                  </div>
                ) : null}
              </motion.li>
            ))}

            {/* The node in flight: its tools as they return, then the phrase for
                what it is doing while it has nothing to show yet. */}
            {((running && !active) || pendingTools.length > 0) && (
              <motion.li
                variants={fadeUp(reduced, 8)}
                data-testid="trace-current"
                className="rounded-xl bg-surface px-3 py-2.5"
              >
                <div className="flex items-baseline gap-3">
                  <span className="w-16 shrink-0" aria-hidden="true" />
                  <p className="min-w-0 flex-1 animate-pulse text-xs text-muted">
                    {running && !active ? "Préparation de l’étape suivante…" : "Activité des outils"}
                  </p>
                </div>
                <AnimatePresence initial={false}>
                  {pendingTools.length > 0 && (
                    <motion.div
                      className="mt-1.5 space-y-1 border-l border-border pl-3 md:ml-[4.75rem]"
                      variants={stagger(reduced)}
                      initial="hidden"
                      animate="visible"
                    >
                      {pendingTools.map((tool, index) => (
                        <motion.div key={`${tool.name}-${tool.at}-${index}`} variants={fadeUp(reduced, 6)}>
                          <ToolRow {...tool} ticking={running} />
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.li>
            )}
          </motion.ol>
        )}
      </AnimatePresence>
    </div>
  );
}
