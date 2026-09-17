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
 * @param {{ data: { runId: string, tenderId: string } }} job
 * @returns {Promise<{ verdict: string|null }>}
 */
export async function processAnalysis(job) {
  const { runId, tenderId } = job.data;
  logger.info({ jobId: job.id, runId, tenderId }, 'job: analysis start');

  const state = await getService().execute(runId, tenderId);

  logger.info({ jobId: job.id, runId, verdict: state?.verdict }, 'job: analysis done');
  return { verdict: state?.verdict ?? null };
}
