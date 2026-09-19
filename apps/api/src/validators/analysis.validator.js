/**
 * zod parsing of analysis request bodies and params. Runs BEFORE the service,
 * always. An unvalidated string from outside the program is unvalidated whatever
 * its source.
 */
import { z } from 'zod';
import { humanAnswerSchema } from '@tenderpilot/shared';
import { appError } from '../lib/errors.js';

const tenderIdParamSchema = z.object({ id: z.uuid('identifiant invalide') });
const runIdParamSchema = z.object({ runId: z.uuid('identifiant de run invalide') });

const sectionEditSchema = z.object({
  sectionKey: z.string().min(1).max(64),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(50_000),
});

/**
 * @param {import('zod').ZodType} schema
 * @param {unknown} value
 * @returns {object}
 */
function parse(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) {
    const detail = result.error.issues
      .map((i) => i.path.join('.') + ': ' + i.message)
      .join('; ');
    throw appError('Requete invalide. ' + detail, 'VALIDATION_FAILED', 400);
  }
  return result.data;
}

/** @param {unknown} params @returns {{ id: string }} */
export function parseTenderIdParam(params) {
  return parse(tenderIdParamSchema, params);
}

/** @param {unknown} params @returns {{ runId: string }} */
export function parseRunIdParam(params) {
  return parse(runIdParamSchema, params);
}

/** @param {unknown} body @returns {{ sectionKey: string, title: string, content: string }} */
export function parseSectionEditBody(body) {
  return parse(sectionEditSchema, body);
}

/**
 * The human's reply to a question the agent asked. The shape is shared with the
 * web, because the screen that posts it and the service that resumes on it must
 * agree about what an answer is.
 * @param {unknown} body
 * @returns {import('@tenderpilot/shared').HumanAnswer}
 */
export function parseHumanAnswerBody(body) {
  return parse(humanAnswerSchema, body);
}
