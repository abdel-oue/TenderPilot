/**
 * zod parsing of tender request bodies. Runs BEFORE the service, always.
 */
import { z } from 'zod';
import { appError } from '../lib/errors.js';

const idParamSchema = z.object({ id: z.uuid('identifiant invalide') });

const createSchema = z.object({
  // AO-2026-001. Constrained because it is a business key, not free text.
  reference: z
    .string()
    .trim()
    .min(3)
    .max(64)
    .regex(/^[A-Za-z0-9._\-\/]+$/, 'reference invalide'),
  title: z.string().trim().max(300).nullish(),
});

/**
 * @param {import('zod').ZodType} schema
 * @param {unknown} value
 * @returns {object}
 */
function parse(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) {
    const detail = result.error.issues.map((i) => i.path.join('.') + ': ' + i.message).join('; ');
    throw appError('Requete invalide. ' + detail, 'VALIDATION_FAILED', 400);
  }
  return result.data;
}

/** @param {unknown} params @returns {{ id: string }} */
export function parseTenderIdParam(params) {
  return parse(idParamSchema, params);
}

/** @param {unknown} body @returns {{ reference: string, title?: string|null }} */
export function parseCreateTenderBody(body) {
  return parse(createSchema, body);
}
