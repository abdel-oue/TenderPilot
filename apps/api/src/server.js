// Fastify bootstrap ONLY. No routes defined inline, no business logic, no DB.
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { env } from './lib/env.js';
import { logger } from './lib/logger.js';
import { AppError } from './lib/errors.js';
import { closeDb } from './db/client.js';
import { runMigrations } from './db/migrate.js';
import authRoutes from './routes/auth.routes.js';
import analysisRoutes from './routes/analysis.routes.js';
import tenderRoutes from './routes/tender.routes.js';
import documentRoutes from './routes/document.routes.js';
import companyRoutes from './routes/company.routes.js';
import { runWithContext } from './lib/requestContext.js';
import { MAX_UPLOAD_BYTES } from './lib/uploads.js';

const app = Fastify({ loggerInstance: logger });

// credentials: the session cookie is cross-origin (web :4100 -> api :4000).
await app.register(cors, { origin: env.WEB_ORIGIN, credentials: true });

// EX-01: a dossier is deposited as a PDF from the interface. One file per
// request, ceiling enforced here as well as per-part, so an oversized upload is
// refused by the server rather than trusted to stop itself.
await app.register(multipart, {
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 4 },
});

// Every request runs inside a context, so the LLM calls fired deep inside the
// graph are attributable to the request that caused them without any node having
// to carry a correlation id in its signature.
app.addHook('onRequest', (request, _reply, done) => {
  runWithContext({ requestId: request.id }, async () => done());
});

await app.register(authRoutes, { prefix: '/auth' });
await app.register(companyRoutes);
await app.register(tenderRoutes);
await app.register(documentRoutes);
await app.register(analysisRoutes);

app.get('/health', async () => ({ status: 'ok' }));

app.setErrorHandler((error, request, reply) => {
  if (error instanceof AppError) return reply.code(error.status).send(error.toBody());
  request.log.error({ error }, 'unhandled error');
  return reply.code(500).send({ error: 'Une erreur interne est survenue.', code: 'INTERNAL_ERROR' });
});

app.setNotFoundHandler((_request, reply) =>
  reply.code(404).send({ error: 'Ressource introuvable.', code: 'NOT_FOUND' }),
);

await runMigrations();
await app.listen({ port: env.PORT, host: '0.0.0.0' });

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, async () => {
    await app.close();
    await closeDb();
    process.exit(0);
  });
}
