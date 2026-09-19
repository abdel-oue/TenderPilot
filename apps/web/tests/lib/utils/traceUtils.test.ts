import { describe, expect, it } from "vitest";
import { NODE_ORDER, NODE_PHRASES, currentNode, nodePhrase, totalDuration } from "../../../lib/utils/traceUtils";
import type { TraceEntry } from "../../../lib/types";

// The nine nodes registered in apps/api/src/graph/index.js. Duplicated here on
// purpose: the api is JavaScript and this is TypeScript, so nothing links them
// but this list. A node added to the graph without a phrase should fail here,
// loudly, rather than render as a bare camelCase identifier on the screen.
const GRAPH_NODES = [
  "ingest",
  "extractRequirements",
  "classifyRequirements",
  "parseRubric",
  "matchProfile",
  "computeScore",
  "decide",
  "draft",
  "reconcileDecision",
  "compliance",
];

function entry(node: string, extra: Partial<TraceEntry> = {}): TraceEntry {
  return { node, at: "2026-09-19T09:58:20.000Z", summary: "", status: "ok", ...extra };
}

describe("node phrases", () => {
  it("has a French phrase for every node in the graph", () => {
    expect(Object.keys(NODE_PHRASES).sort()).toEqual([...GRAPH_NODES].sort());
    for (const node of GRAPH_NODES) {
      expect(NODE_PHRASES[node]).toMatch(/…$/);
    }
  });

  it("falls back to the raw node name rather than rendering nothing", () => {
    expect(nodePhrase("unNoeudInconnu")).toBe("unNoeudInconnu");
  });
});

describe("currentNode", () => {
  it("names the first node before anything has finished", () => {
    expect(currentNode([])).toBe(NODE_ORDER[0]);
  });

  it("names the node after the last one that finished", () => {
    expect(currentNode([entry("ingest")])).toBe("extractRequirements");
    expect(currentNode([entry("ingest"), entry("extractRequirements")])).toBe("classifyRequirements");
  });

  it("follows the redraft loop back to draft rather than counting rows", () => {
    // compliance can send a section back, so the graph revisits draft. Counting
    // finished rows would claim the run is somewhere it has already been past.
    const trace = [entry("draft"), entry("compliance")];
    expect(currentNode(trace)).toBe(null);
    expect(currentNode([...trace, entry("draft")])).toBe("reconcileDecision");
  });

  it("ignores the human's own answers when working out where the agent is", () => {
    const trace = [entry("ingest"), entry("matchProfile", { status: "human" })];
    expect(currentNode(trace)).toBe("extractRequirements");
  });

  it("returns null once the graph is past the last node", () => {
    expect(currentNode([entry("compliance")])).toBe(null);
  });
});

describe("totalDuration", () => {
  it("says nothing when no row carries a duration", () => {
    expect(totalDuration([entry("ingest")])).toBe("");
  });

  it("reads in seconds under a minute and in minutes above", () => {
    expect(totalDuration([entry("ingest", { ms: 34_042 })])).toBe("34 s");
    expect(totalDuration([entry("ingest", { ms: 90_000 }), entry("draft", { ms: 44_000 })])).toBe(
      "2 min 14 s",
    );
  });
});
