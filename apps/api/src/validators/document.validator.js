/**
 * zod parsing of document request params and uploads.
 *
 * A multipart upload is a boundary like any other: the kind, the filename and
 * the declared content type all arrive from the client and are all parsed here,
 * before a service sees them. The bytes themselves are checked in lib/uploads.js,
 * which looks at what the file actually is rather than what it claims to be.
 */
import { z } from 'zod';
import { COMPANY_DOCUMENT_KINDS, TENDER_DOCUMENT_KINDS } from '@tenderpilot/shared';
import { appError } from '../lib/errors.js';

const idParamSchema = z.object({ id: z.uuid('identifiant invalide') });

// The name is only ever displayed, never used to build a path - lib/uploads.js
// names the file after its own hash. Stripping the directory part anyway, so a
// "../../etc/passwd" filename cannot even reach the UI as text.
const originalNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .transform((name) => name.split(/[\/]/).pop());

const uploadSchema = z.object({
  kind: z.string(),
  originalName: originalNameSchema,
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

/**
 * @param {unknown} params
 * @returns {{ id: string }}
 */
export function parseDocumentIdParam(params) {
  return parse(idParamSchema, params);
}

/**
 * @param {unknown} input { kind, originalName } pulled off the multipart body
 * @param {'tender'|'company'} target which enum of kinds is legal here
 * @returns {{ kind: string, originalName: string }}
 */
export function parseUpload(input, target) {
  const kinds = target === 'tender' ? TENDER_DOCUMENT_KINDS : COMPANY_DOCUMENT_KINDS;
  return parse(uploadSchema.extend({ kind: z.enum(kinds) }), input);
}
