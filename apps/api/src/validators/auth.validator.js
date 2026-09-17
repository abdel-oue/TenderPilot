import { loginSchema, signupSchema } from '@tenderpilot/shared';
import { appError } from '../lib/errors.js';

/**
 * @param {import('zod').ZodType} schema
 * @param {unknown} body
 * @returns {unknown} the parsed body
 */
function parse(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) {
    const detail = result.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join(', ');
    throw appError(`Requête invalide — ${detail}`, 'VALIDATION_FAILED', 400);
  }
  return result.data;
}

/**
 * @param {unknown} body
 * @returns {{ email: string, name: string, password: string }}
 */
export function parseSignupBody(body) {
  return parse(signupSchema, body);
}

/**
 * @param {unknown} body
 * @returns {{ email: string, password: string }}
 */
export function parseLoginBody(body) {
  return parse(loginSchema, body);
}
