/**
 * zod parsing of document request params.
 */
import { z } from 'zod';
import { appError } from '../lib/errors.js';

const idParamSchema = z.object({ id: z.uuid('identifiant invalide') });

/**
 * @param {unknown} params
 * @returns {{ id: string }}
 */
export function parseDocumentIdParam(params) {
  const result = idParamSchema.safeParse(params);
  if (!result.success) {
    throw appError('Identifiant de document invalide.', 'VALIDATION_FAILED', 400);
  }
  return result.data;
}
