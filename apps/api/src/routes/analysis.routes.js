/**
 * Analysis routes. Dispatch only - the controller does the work.
 */
import { requireAuth } from '../lib/auth.js';
import AnalysisController from '../controllers/analysis.controller.js';

/**
 * @param {import('fastify').FastifyInstance} app
 * @returns {Promise<void>}
 */
export default async function analysisRoutes(app) {
  const controller = new AnalysisController();

  app.addHook('preHandler', requireAuth);

  app.post('/tenders/:id/analyze', (request, reply) => controller.start(request, reply));
  app.get('/tenders/:id/analysis', (request, reply) => controller.get(request, reply));
  app.get('/tenders/:id/analysis/stream', (request, reply) => controller.stream(request, reply));
  app.get('/analyses', (request, reply) => controller.list(request, reply));
  app.get('/analyses/:runId', (request, reply) => controller.detail(request, reply));
  app.post('/analyses/:runId/answer', (request, reply) => controller.answer(request, reply));
  app.post('/analyses/:runId/decision', (request, reply) => controller.reviewDecision(request, reply));
  app.patch('/analyses/:runId/sections', (request, reply) => controller.saveSection(request, reply));
  app.get('/analyses/:runId/export.docx', (request, reply) => controller.exportDocx(request, reply));
}
