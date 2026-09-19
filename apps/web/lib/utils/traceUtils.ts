import type { TraceEntry } from "@/lib/types";

/**
 * What each graph node is called on screen, while it is still running.
 *
 * A node writes its trace row when it FINISHES, so between "started" and "done"
 * there is nothing to show. This is what fills that gap, and it is keyed on the
 * node the run is actually in — not a list of phrases on a timer. A rotating
 * caption that says "Extraction des exigences" while the agent is drafting is a
 * lie that happens to look livelier.
 *
 * Keys are the node names registered in apps/api/src/graph/index.js. A node with
 * no phrase here falls back to its raw name, and the test asserts every node has
 * one, so adding a node to the graph fails the suite rather than the screen.
 */
export const NODE_PHRASES: Record<string, string> = {
  ingest: "Lecture du dossier…",
  extractRequirements: "Extraction des exigences…",
  classifyRequirements: "Tri des exigences éliminatoires…",
  parseRubric: "Lecture de la grille de notation…",
  matchProfile: "Confrontation à votre profil…",
  computeScore: "Calcul du score projeté…",
  decide: "Décision go / no-go…",
  draft: "Rédaction du mémoire technique…",
  reconcileDecision: "Vérification de la décision après rédaction…",
  compliance: "Relecture des sections rédigées…",
};

/** The order the graph runs them in, for the phrase shown before the first row. */
export const NODE_ORDER = Object.keys(NODE_PHRASES);

/**
 * @param node a graph node name
 * @returns the phrase to show while it runs
 */
export function nodePhrase(node: string): string {
  return NODE_PHRASES[node] ?? node;
}

/**
 * The node the run is in right now: the one after the last row written.
 *
 * Derived rather than reported, because the api tells us what has FINISHED, and
 * "what is it doing" is the question the screen has to answer in between.
 *
 * @param trace the rows written so far
 * @returns the running node's name, or null once the graph is past the list
 */
export function currentNode(trace: TraceEntry[]): string | null {
  const active = trace.findLast((entry) => entry.status === "running");
  if (active) return active.node;
  const done = trace.filter((entry) => entry.status !== "human").map((entry) => entry.node);
  if (done.length === 0) return NODE_ORDER[0];
  // The redraft loop revisits draft and compliance, so the last row is a better
  // anchor than the count: after compliance sends a section back, the next node
  // is draft again, not whatever follows compliance in the list.
  const last = done[done.length - 1];
  const next = NODE_ORDER[NODE_ORDER.indexOf(last) + 1];
  return next ?? null;
}

/**
 * Total wall time of a finished run, as a sentence.
 * @param trace the rows written
 * @returns e.g. "2 min 14 s", or "" when nothing has a duration
 */
export function totalDuration(trace: TraceEntry[]): string {
  const ms = trace.reduce((sum, entry) => sum + (entry.status === "running" ? 0 : entry.ms ?? 0), 0);
  if (ms === 0) return "";
  if (ms < 60_000) return `${(ms / 1000).toFixed(0)} s`;
  const roundedSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(roundedSeconds / 60);
  const seconds = roundedSeconds % 60;
  return `${minutes} min ${String(seconds).padStart(2, "0")} s`;
}
