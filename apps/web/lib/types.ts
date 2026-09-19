// Web-only view types: the SHAPES THE API RETURNS that have no zod schema on the
// api side yet (list rows, the analysis envelope). Anything that is validated by
// zod is imported from @tenderpilot/shared instead - a type duplicated between
// web and api is a bug.
import type { Blocker, Requirement, Tender } from "@tenderpilot/shared";

/** A row in the dossier list: the tender plus its latest verdict, if any. */
export interface TenderListItem extends Tender {
  analysis: {
    runId: string;
    status: AnalysisStatus;
    verdict?: "go" | "no-go";
    score?: string | null;
    blockers?: number;
  } | null;
}

export interface TenderDocument {
  id: string;
  kind: string;
  originalName: string | null;
  pageCount: number;
  extractionPath: string;
}

export interface TenderDetail extends Tender {
  documents: TenderDocument[];
}

export type AnalysisStatus = "queued" | "running" | "done" | "failed";

/** One line of the agent activity feed. This is the "profondeur agentique" view. */
export interface TraceEntry {
  node: string;
  at: string;
  summary: string;
  status: "ok" | "error" | "retry";
  ms?: number;
  /** Tools the agent chose to call on this step, in order. */
  tools?: ToolNarration[];
}

/** One tool call, written for the person reading the screen. */
export interface ToolNarration {
  /** The raw tool name. Secondary: evidence for a technical reader. */
  name: string;
  /** The model's own reason for calling it. Null if it did not give one. */
  raison: string | null;
  /** What actually came back, derived from the real result, never from the model. */
  outcome: string;
}

export interface AnalysisSection {
  id: string;
  sectionKey: string;
  title: string;
  content: string;
  editedByHuman: boolean;
}

export interface AnalysisResult {
  verdict: "go" | "no-go";
  confidence: number;
  justification: string;
  score: string | null;
  blockers: Blocker[];
  /** A risk the agent flagged without turning it into a disqualification. */
  warnings: { label: string; text: string; detail: string }[];
  unreadPages: { documentId: string; page: number }[];
  rubricBreakdown: { label: string; points: number; maxPoints: number }[];
}

export interface AnalysisEnvelope {
  runId: string;
  tenderId: string;
  status: AnalysisStatus;
  error: string | null;
  nodeTrace: TraceEntry[];
  result: AnalysisResult | null;
  sections: AnalysisSection[];
}

/** How the profile answered one requirement, merged into the matrix row. */
export interface RequirementMatch {
  status: "met" | "partial" | "unmet" | "unknown";
  evidence: string[];
  reason: string;
  confidence: number;
}

export interface MatrixRow extends Requirement {
  quote: string | null;
  match: RequirementMatch | null;
}
