/**
 * Where an uploaded PDF goes, and the checks it passes on the way in.
 *
 * Layout:  uploads/<ownerId>/<tenderId | "company">/<sha256>.pdf
 *
 * Content addressed, so re-uploading the same file overwrites the same bytes
 * instead of piling up copies — and the hash is already the parse-cache key that
 * lets ingest skip a document it has read before.
 *
 * Owner-first, so one user's files are never in another user's directory. The
 * path is BUILT from a session id and a hash, never from anything the caller
 * typed, so there is nothing here to traverse with.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { hashFile } from './cache.js';
import { env } from './env.js';
import { appError } from './errors.js';

// Resolved from this module, never from process.cwd(): the api runs from the
// repo root in dev and from /app in the container.
const REPO_ROOT = resolve(import.meta.dirname, '../../../..');

export const UPLOADS_ROOT = isAbsolute(env.UPLOAD_DIR)
  ? env.UPLOAD_DIR
  : join(REPO_ROOT, env.UPLOAD_DIR);

export const MAX_UPLOAD_BYTES = env.MAX_UPLOAD_MB * 1024 * 1024;

// "%PDF" — the first four bytes of every PDF. A content-type header is whatever
// the client felt like sending; this is the file actually saying what it is.
const PDF_MAGIC = Buffer.from('%PDF');

/**
 * Rejects anything that is not really a PDF, before a byte is written.
 * @param {Buffer} buffer
 * @returns {void} throws AppError when the bytes are not a PDF
 */
export function assertPdf(buffer) {
  if (buffer.length === 0) {
    throw appError('Fichier vide.', 'UPLOAD_EMPTY', 400);
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw appError(
      `Fichier trop volumineux (max ${env.MAX_UPLOAD_MB} Mo).`,
      'UPLOAD_TOO_LARGE',
      413,
    );
  }
  if (!buffer.subarray(0, 4).equals(PDF_MAGIC)) {
    throw appError(
      "Seuls les fichiers PDF sont acceptes. Ce fichier n'en est pas un.",
      'UPLOAD_NOT_PDF',
      415,
    );
  }
}

/**
 * Validates, then writes the file under its owner's directory.
 *
 * @param {object} input
 * @param {Buffer} input.buffer the uploaded bytes
 * @param {string} input.ownerId the session user - never a value from the body
 * @param {string|null} [input.tenderId] null for a company document
 * @returns {Promise<{ filePath: string, contentHash: string }>}
 */
export async function saveUpload({ buffer, ownerId, tenderId = null }) {
  assertPdf(buffer);

  const contentHash = hashFile(buffer);
  const directory = join(UPLOADS_ROOT, ownerId, tenderId ?? 'company');
  await mkdir(directory, { recursive: true });

  const filePath = join(directory, contentHash + '.pdf');
  await writeFile(filePath, buffer);

  return { filePath, contentHash };
}
