import { z } from 'zod';

// process.env is a boundary: parsed once, at import time, so a missing key fails
// on boot with a readable message instead of as `undefined` an hour later.
//
// The LLM keys keep the exact names the hackathon .env ships with, so the file
// can be dropped in unmodified. Two providers on purpose - see MODEL ROUTING.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  WEB_ORIGIN: z.url().default('http://localhost:3100'),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars: openssl rand -hex 32'),
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

  OCR_LANG: z.string().min(2).default('fra'),

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
