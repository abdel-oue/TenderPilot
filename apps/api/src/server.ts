// Fastify bootstrap ONLY. No routes defined inline, no business logic, no DB.
//
// TODO: create the fastify instance with the pino logger
// TODO: CORS - allow WEB_ORIGIN on every response, handle preflight
// TODO: register routes/ modules under their prefixes
// TODO: run pending migrations on startup
// TODO: global error handler -> { error: "Human readable message", code: "SNAKE_CASE_CODE" }
// TODO: listen on PORT, graceful shutdown on SIGTERM
