/**
 * Test environment. Runs before any module is imported, because lib/env.js parses
 * process.env at import time and every repository transitively imports it.
 *
 * These are deliberately fake: a unit test that reaches a real database or a real
 * provider is not a unit test, it is a flaky bill. The DATABASE_URL points at a
 * port nothing listens on, so an accidental live query fails loudly instead of
 * quietly hitting a developer's dev database.
 */
process.env.NODE_ENV ??= 'test';
process.env.PORT ??= '3000';
process.env.WEB_ORIGIN ??= 'http://localhost:3100';
process.env.DATABASE_URL ??= 'postgres://test:test@127.0.0.1:1/tenderpilot_test';
process.env.REDIS_URL ??= 'redis://127.0.0.1:1';
process.env.JWT_SECRET ??= '0'.repeat(64);
process.env.LOG_LEVEL ??= 'silent';

process.env.LLM_URL ??= 'https://example.invalid/openai/v1';
process.env.LLM_API_KEY ??= 'test-key';
process.env.LLM_MODEL ??= 'gpt-5.5';
process.env.EMBEDDING_MODEL ??= 'embedder-small-3';
process.env.EMBEDDING_DIMENSIONS ??= '512';

process.env.AZURE_OPENAI_API_KEY ??= 'test-key';
process.env.AZURE_OPENAI_ENDPOINT ??= 'https://example.invalid/';
process.env.AZURE_OPENAI_API_VERSION ??= '2024-12-01-preview';
process.env.AZURE_OPENAI_DEPLOYMENT_NAME ??= 'gpt-4.1';
process.env.AZURE_OPENAI_MAX_TOKENS ??= '16384';

process.env.OCR_LANG ??= 'fra';
// Nothing in the default suite is allowed to call a provider.
process.env.STUB_LLM ??= '1';
