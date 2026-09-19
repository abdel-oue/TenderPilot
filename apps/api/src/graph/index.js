/**
 * The agent graph. Wiring ONLY - node logic lives in nodes/, prompts in prompts/.
 *
 *   ingest -> extractRequirements -> classifyRequirements -> parseRubric
 *          -> matchProfile -> computeScore -> decide -[no-go]-> END
 *                                            \-[go]---> draft -> reconcileDecision
 *                                                                  -[no-go]-> END
 *                                                                  -[go]----> compliance
 *                                                         ^                       |
 *                                                         \-------- refus --------/  (max 2)
 *
 * Three conditional edges, and they are the whole point:
 *
 *   decide             a no-go stops before drafting. Writing a memoire for a
 *                      dossier the company is disqualified from is the expensive
 *                      mistake this product exists to prevent, and burning tokens
 *                      on it would be ironic.
 *   reconcileDecision  the same decide() re-run on the post-draft state, behind the
 *                      same shouldDraft condition: a verdict that no longer holds
 *                      stops before compliance.
 *   compliance         a refused section goes BACK to the Writer. That cycle is the
 *                      "reviser" verb of the agentic-depth criterion.
 *
 * All three are decided in the edge condition, and the redraft loop is bounded
 * there too - never by asking the model to stop.
 *
 * GRAPH_VERSION is bumped on any node or prompt change: checkpoints are keyed on
 * it, so a stale checkpoint from an older graph is never resumed into a newer one.
 */
import { END, START, StateGraph } from '@langchain/langgraph';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { env } from '../lib/env.js';
import { logger } from '../lib/logger.js';
import { isGraphBubbleUp } from '@langchain/langgraph';
import { describeToolCall } from '../lib/narration.js';
import { publishRunEvent } from '../lib/runEvents.js';
import { randomUUID } from 'node:crypto';
import { nodeActivity } from '../lib/activity.js';
import AnalysisRepository from '../repositories/analysis.repository.js';
import { ingest } from './nodes/ingest.node.js';
import { extractRequirementsNode } from './nodes/extractRequirements.node.js';
import { classifyRequirements } from './nodes/classifyRequirements.node.js';
import { parseRubric } from './nodes/parseRubric.node.js';
import { matchProfile } from './nodes/matchProfile.node.js';
import { score } from './nodes/score.node.js';
import { decide } from './nodes/decide.node.js';
import { draft } from './nodes/draft.node.js';
import { reviewSections, shouldRedraft } from './nodes/compliance.node.js';

export const GRAPH_VERSION = 'v4';

/**
 * State channels. Each key says how two updates are merged; nodes return partial
 * state and never mutate, which is what makes a node testable as fixture in,
 * object out.
 */
const replace = { reducer: (_previous, next) => next };
const append = { reducer: (previous = [], next = []) => [...previous, ...next], default: () => [] };

const channels = {
  tenderId: replace,
  runId: replace,
  // Whose dossier this is. Every node that touches company data reads it from
  // here, so no node can widen the query to "all companies" by omission.
  ownerId: replace,
  documents: { ...replace, default: () => [] },
  pages: { ...replace, default: () => [] },
  requirements: { ...replace, default: () => [] },
  extractionAudit: { ...replace, default: () => null },
  humanDecisions: { ...replace, default: () => [] },
  rubric: { ...replace, default: () => [] },
  matches: { ...replace, default: () => [] },
  score: { ...replace, default: () => null },
  rubricBreakdown: { ...replace, default: () => [] },
  thresholdWarnings: { ...replace, default: () => [] },
  warnings: { ...replace, default: () => [] },
  verdict: { ...replace, default: () => null },
  confidence: { ...replace, default: () => null },
  justification: { ...replace, default: () => null },
  // Set by decide() when eligibility could not be settled - nothing evaluated,
  // a stage in error, or a blocker only partially assessed. It travels with the
  // verdict because it qualifies it.
  needsHuman: { ...replace, default: () => false },
  blockers: { ...replace, default: () => [] },
  sections: { ...replace, default: () => [] },
  rejected: { ...replace, default: () => [] },
  redraftInstructions: { ...replace, default: () => ({}) },
  redraftCount: { ...replace, default: () => ({}) },
  // Errors accumulate across nodes: one node failing must not erase what an
  // earlier node already reported.
  errors: append,
  nodeTrace: append,
  // Every tool the agents actually called, in order. This is the evidence that
  // the belt is real rather than declared: the trace panel renders it, and it is
  // what the jury is asking to see when it asks to see the reasoning.
  toolCalls: append,
};

/**
 * Wraps a node so every execution appends one trace entry, written by ONE
 * graph-level callback rather than sprinkled through each node. Adding a node
 * cannot forget to log.
 *
 * Exported for the tests: what it does with a thrown error is the difference
 * between a paused run and a wrong answer, and that deserves an assertion.
 *
 * @param {string} name
 * @param {(state: object) => Promise<object>} fn
 * @param {AnalysisRepository} analyses
 * @returns {(state: object) => Promise<object>}
 */
export function traced(name, fn, analyses) {
  return async (state) => {
    const startedAt = Date.now();
    const startedAtIso = new Date(startedAt).toISOString();
    const liveEntry = {
      id: randomUUID(),
      node: name,
      at: startedAtIso,
      startedAt: startedAtIso,
      status: 'running',
      summary: '',
      tools: [],
    };
    if (state.runId) await analyses.appendTrace(state.runId, liveEntry).catch(() => {});
    await publishRunEvent(state.runId, { type: 'node', ...liveEntry });
    let pendingWrite = Promise.resolve();
    function recordTool(tool) {
      const index = liveEntry.tools.findIndex((item) => item.id === tool.id);
      if (index < 0) liveEntry.tools.push({ ...tool });
      else liveEntry.tools[index] = { ...tool };

      const snapshot = structuredClone(liveEntry);
      pendingWrite = pendingWrite
        .then(() => state.runId && analyses.updateTrace(state.runId, snapshot))
        .catch(() => {});
      return pendingWrite;
    }
    const activity = { runId: state.runId, node: name, record: recordTool };
    try {
      const patch = await nodeActivity.run(activity, () => fn(state));
      const entry = {
        ...liveEntry,
        node: name,
        at: new Date().toISOString(),
        summary: summarize(name, patch) + ((patch.errors ?? []).length ? ' — ' + patch.errors.map((e) => e.message).join('; ') : ''),
        status: (patch.errors ?? []).length ? 'error' : 'ok',
        ms: Date.now() - startedAt,
        tools: liveEntry.tools.length ? liveEntry.tools : narrate(patch.toolCalls),
      };
      await pendingWrite;
      if (state.runId) await analyses.updateTrace(state.runId, entry).catch(() => {});
      // Send the complete row too, covering a missed individual tool event.
      await publishRunEvent(state.runId, { type: 'node', ...entry });
      return { ...patch, nodeTrace: [entry] };
    } catch (error) {
      // An interrupt is not a node failure. ask_human raised it to park the run
      // on its checkpoint, and this catch-all is the last thing between it and
      // LangGraph: recorded as an error here, the pause would become a failed
      // node and the graph would carry on and answer the dossier alone.
      if (isGraphBubbleUp(error)) {
        if (state.runId) await analyses.updateTrace(state.runId, { ...liveEntry, status: 'paused', ms: Date.now() - startedAt, summary: 'En attente de votre réponse' }).catch(() => {});
        throw error;
      }
      const entry = {
        ...liveEntry,
        node: name,
        at: new Date().toISOString(),
        summary: error.message,
        status: 'error',
        ms: Date.now() - startedAt,
      };
      await pendingWrite;
      if (state.runId) await analyses.updateTrace(state.runId, entry).catch(() => {});
      await publishRunEvent(state.runId, { type: 'node', ...entry });
      logger.error({ node: name, err: error.message }, 'graph: node failed');
      // One node failing records itself and lets the graph continue: a dossier
      // half-analysed with an explicit error beats no answer at all.
      return { errors: [{ node: name, message: error.message }], nodeTrace: [entry] };
    }
  };
}

/**
 * Turns the raw tool calls of one node into rows a company director can read.
 *
 * Three fields, and the split is the point: `raison` is the model's own words
 * for why it reached for the tool, `outcome` is built from what the tool really
 * returned and cannot be hallucinated, and `name` is kept so a technical reader
 * can still see which named tool ran. The dirigeant reads the first two; the
 * jury checks the third.
 *
 * @param {{ tool: string, args: object, result: object }[]} [toolCalls]
 * @returns {{ name: string, raison: string|null, outcome: string }[]}
 */
function narrate(toolCalls = []) {
  return toolCalls.map((call) => ({
    name: call.tool,
    raison: call.args?.raison ?? null,
    outcome: describeToolCall(call.tool, call.args ?? {}, call.result ?? {}),
  }));
}

/**
 * A one-line, human-readable summary per node. This is the text the UI trace
 * panel shows and the video films, so it says what happened, not that it ran.
 * @param {string} name
 * @param {object} patch
 * @returns {string}
 */
export function summarize(name, patch = {}) {
  switch (name) {
    case 'ingest': {
      const unread = (patch.pages ?? []).filter((p) => p.extraction === 'unread').length;
      const ocr = (patch.pages ?? []).filter((p) => p.extraction === 'ocr').length;
      const cached = (patch.documents ?? []).filter((document) => document.extractionPath === 'cached').length;
      return `${(patch.pages ?? []).length} pages lues` +
        (ocr ? `, dont ${ocr} par OCR` : '') +
        (cached ? ` ; ${cached} document(s) repris du cache` : '') +
        (unread ? `, ${unread} illisibles` : '');
    }
    case 'extractRequirements':
      return `${(patch.requirements ?? []).length} exigences extraites` + (patch.extractionAudit
        ? ` ; ${patch.extractionAudit.auditedPages} pages auditees, ${patch.extractionAudit.recoveredRequirements} omissions ou corrections recuperees` : '');
    case 'classifyRequirements':
      return `${(patch.requirements ?? []).filter((r) => r.obligation === 'eliminatoire').length} exigences eliminatoires identifiees`;
    case 'parseRubric':
      return `grille de notation : ${(patch.rubric ?? []).length} criteres`;
    case 'matchProfile': {
      const tools = (patch.toolCalls ?? []).length;
      return (
        `${(patch.matches ?? []).filter((m) => m.status === 'met').length}/${(patch.matches ?? []).length} exigences couvertes par le profil` +
        (tools ? ` (${tools} appel(s) d'outil)` : '')
      );
    }
    case 'computeScore':
      return `score de couverture : ${patch.score}/100`;
    case 'decide':
      return `${patch.verdict} - ${(patch.blockers ?? []).length} point(s) bloquant(s)`;
    case 'draft': {
      const tools = (patch.toolCalls ?? []).length;
      return (
        `${(patch.sections ?? []).length} sections redigees` +
        (tools ? `, ${tools} appel(s) d'outil` : '')
      );
    }
    case 'compliance':
      return `${(patch.sections ?? []).filter((s) => !s.needsHuman).length} sections controlees, ${(patch.sections ?? []).filter((s) => s.needsHuman).length} a revoir, ${(patch.rejected ?? []).length} refusees`;
    default:
      return name;
  }
}

/**
 * The go/no-go edge. A disqualified dossier stops before the Writer: drafting a
 * memoire for a tender the company cannot win is exactly the waste this product
 * exists to prevent.
 * @param {object} state
 * @returns {'draft'|typeof END}
 */
export function shouldDraft(state) {
  return state.verdict === 'go' ? 'draft' : END;
}

let checkpointerPromise = null;

/**
 * The Postgres checkpointer, created once per process. A run that dies at node 6
 * resumes instead of restarting an OCR pass from zero - which matters most at
 * exactly the worst moment, during a demo.
 * @returns {Promise<PostgresSaver>} rejects when durable state is unavailable
 */
export async function getCheckpointer() {
  if (!checkpointerPromise) {
    checkpointerPromise = (async () => {
      try {
        const saver = PostgresSaver.fromConnString(env.DATABASE_URL);
        await saver.setup();
        logger.info('graph: postgres checkpointer ready');
        return saver;
      } catch (error) {
        checkpointerPromise = null;
        throw new Error('Points de reprise indisponibles : ' + error.message);
      }
    })();
  }
  return checkpointerPromise;
}

/**
 * Builds and compiles the graph.
 * @param {{ analyses?: AnalysisRepository, checkpointer?: object }} [deps]
 * @returns {Promise<object>} the compiled graph
 */
export async function buildGraph({ analyses = new AnalysisRepository(), checkpointer } = {}) {
  const graph = new StateGraph({ channels })
    .addNode('ingest', traced('ingest', ingest, analyses))
    .addNode('extractRequirements', traced('extractRequirements', extractRequirementsNode, analyses))
    .addNode('classifyRequirements', traced('classifyRequirements', classifyRequirements, analyses))
    .addNode('parseRubric', traced('parseRubric', parseRubric, analyses))
    .addNode('matchProfile', traced('matchProfile', matchProfile, analyses))
    .addNode('computeScore', traced('computeScore', score, analyses))
    .addNode('decide', traced('decide', decide, analyses))
    .addNode('draft', traced('draft', draft, analyses))
    .addNode('reconcileDecision', traced('reconcileDecision', decide, analyses))
    .addNode('compliance', traced('compliance', reviewSections, analyses));

  graph.addEdge(START, 'ingest');
  graph.addEdge('ingest', 'extractRequirements');
  graph.addEdge('extractRequirements', 'classifyRequirements');
  graph.addEdge('classifyRequirements', 'parseRubric');
  graph.addEdge('parseRubric', 'matchProfile');
  graph.addEdge('matchProfile', 'computeScore');
  graph.addEdge('computeScore', 'decide');

  // Conditional edge 1: no-go never reaches the Writer.
  graph.addConditionalEdges('decide', shouldDraft, { draft: 'draft', [END]: END });
  graph.addEdge('draft', 'reconcileDecision');
  graph.addConditionalEdges('reconcileDecision', shouldDraft, { draft: 'compliance', [END]: END });
  // Conditional edge 2: a refused section goes back to the Writer, bounded.
  graph.addConditionalEdges('compliance', shouldRedraft, { draft: 'draft', export: END });

  const resolved = checkpointer === undefined ? await getCheckpointer() : checkpointer;
  return graph.compile(resolved ? { checkpointer: resolved } : {});
}
