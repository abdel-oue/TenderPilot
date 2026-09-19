import { z } from 'zod';

// process.env is a boundary: parsed once, at import time, so a missing key fails
// on boot with a readable message instead of as `undefined` an hour later.
//
// The LLM keys keep the exact names the hackathon .env ships with, so the file
// can be dropped in unmodified. Two providers on purpose - see MODEL ROUTING.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.url().default('http://localhost:4100'),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  // min(1) only: Compose passes every key through, so an unset JWT_SECRET
  // arrives as '' rather than absent, and an empty HMAC key must not boot.
  // Length is the deployer's call - a public server wants `openssl rand -hex 32`.
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  LOG_LEVEL: z.enum(['silent', 'fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // --- MODEL ROUTING -------------------------------------------------------
  // Picking the right model per task is graded ("le bon modele au bon endroit"),
  // and the quota is shared across every team, so this is a cost control, not a
  // preference.
  //
  // Tier "reasoning" (gpt-5.5): orchestration, multi-step decisions, the verdict.
  // Azure's OpenAI-compatible /openai/v1 path, so the plain OpenAI client works.
  LLM_URL: z.url(),
  LLM_API_KEY: z.string().min(1),
  LLM_MODEL: z.string().min(1),

  // Embeddings live on the same endpoint as the reasoning model.
  EMBEDDING_MODEL: z.string().min(1),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive(),

  // Tier "volume" (gpt-4.1): extraction, classification, drafting, reformatting.
  // Classic Azure endpoint, so it needs an api-version and a deployment name.
  AZURE_OPENAI_API_KEY: z.string().min(1),
  AZURE_OPENAI_ENDPOINT: z.url(),
  AZURE_OPENAI_API_VERSION: z.string().min(1),
  AZURE_OPENAI_DEPLOYMENT_NAME: z.string().min(1),
  AZURE_OPENAI_MAX_TOKENS: z.coerce.number().int().positive().default(16384),

  // Optional. Absent means the web_search tool is not registered at all, so the
  // graph runs identically without it - never a runtime error, never a dead tool
  // the model can call and get an exception from.
  TAVILY_API_KEY: z.string().optional(),

  // Tesseract language packs, '+'-joined. Both are installed in the api image:
  // the dossiers are French, but annexes and standards quote English.
  OCR_LANG: z.string().min(2).default('fra+eng'),

  // Where uploaded PDFs land. Relative values resolve against the repo root
  // (see lib/uploads.js) so dev and container agree without a second variable.
  UPLOAD_DIR: z.string().min(1).default('uploads'),
  // Per-file ceiling. A dossier is a 60-100 page PDF; 25 MB is generous for that
  // and small enough that a mistyped upload cannot fill the disk.
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(25),

  // '1' stubs both providers at the LlmService boundary so E2E runs are
  // deterministic and burn no shared quota.
  STUB_LLM: z
    .string()
    .optional()
    .transform((v) => v === '1' || v === 'true'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => '  ' + i.path.join('.') + ': ' + i.message).join('\n');
  throw new Error('Invalid environment:\n' + issues);
}

export const env = parsed.data;
