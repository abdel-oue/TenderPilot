/**
 * Analysis routes. Dispatch only - the controller does the work.
 */
import AnalysisController from '../controllers/analysis.controller.js';

/**
 * @param {import('fastify').FastifyInstance} app
 * @returns {Promise<void>}
 */
export default async function analysisRoutes(app) {
  const controller = new AnalysisController();

  app.post('/tenders/:id/analyze', (request, reply) => controller.start(request, reply));
  app.get('/tenders/:id/analysis', (request, reply) => controller.get(request, reply));
  app.patch('/analyses/:runId/sections', (request, reply) => controller.saveSection(request, reply));
}
