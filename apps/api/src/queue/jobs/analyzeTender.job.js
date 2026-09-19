/**
 * Analysis job processor. Bootstrap only - the work lives in AnalysisService.
 */
import { logger } from '../../lib/logger.js';
import AnalysisService from '../../services/analysis.service.js';

let service = null;

/**
 * The graph is compiled once per worker process, not once per job: building it
 * also opens the checkpointer.
 * @returns {AnalysisService}
 */
function getService() {
  if (!service) service = new AnalysisService();
  return service;
}

/**
 * `resume` is present when a human answered a question the agent asked: the same
 * processor runs, but the graph picks up from its checkpoint instead of starting.
 *
 * @param {{ data: { runId: string, tenderId: string, ownerId: string, resume?: object } }} job
 * @returns {Promise<{ verdict: string|null }>}
 */
export async function processAnalysis(job) {
  const { runId, tenderId, ownerId, resume = null } = job.data;
  logger.info({ jobId: job.id, runId, tenderId, resumed: Boolean(resume) }, 'job: analysis start');

  const state = await getService().execute(runId, tenderId, ownerId, resume);

  logger.info({ jobId: job.id, runId, verdict: state?.verdict }, 'job: analysis done');
  return { verdict: state?.verdict ?? null };
}
