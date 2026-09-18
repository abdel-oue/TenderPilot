// Seed entry point. Idempotent. Non-destructive. Run it five times, same rows.
//
// The corpus sits BESIDE this file in seed/data/ - gitignored, dropped in locally,
// mounted read-only into the container. Resolved from import.meta.dirname, never
// from cwd: the seed runs from the repo root in dev and from /app/apps/api in
// the container.
//
// ONE COMPANY PER USER, so everything the seed writes is owned by the demo user.
// A second user signing up gets an empty app and imports their own - they will
// not see a single row of this.
//
// NEVER: TRUNCATE, DROP, or an unfiltered DELETE. Destructive reset is db:reset.

import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { closeDb } from '../client.js';
import { logger } from '../../lib/logger.js';
import { hashPassword } from '../../lib/password.js';
import CompanyService from '../../services/company.service.js';
import DocumentRepository from '../../repositories/document.repository.js';
import TenderRepository from '../../repositories/tender.repository.js';
import UserRepository from '../../repositories/user.repository.js';

const company = new CompanyService();
const documentsRepo = new DocumentRepository();
const tendersRepo = new TenderRepository();
const usersRepo = new UserRepository();

const DATA_DIR = join(import.meta.dirname, 'data');

// Local fixture only, and the corpus is gitignored, so this is not a committed
// credential. It exists because the demo needs a company to belong to.
const DEMO_USER = { email: 'demo@tenderpilot.local', name: 'Demo', password: 'demo1234' };

const tally = { created: 0, updated: 0, skipped: 0 };

/**
 * @param {string} path
 * @returns {Promise<string>} sha256 of the file bytes - the parse cache key
 */
async function hashFile(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

/**
 * Creates the demo user if missing, and returns it either way. Everything else
 * the seed writes hangs off this id.
 * @returns {Promise<string>} the demo user's id
 */
async function seedDemoUser() {
  const created = await usersRepo.insert({
    email: DEMO_USER.email,
    name: DEMO_USER.name,
    passwordHash: await hashPassword(DEMO_USER.password),
  });

  if (created) {
    tally.created += 1;
    logger.info({ email: DEMO_USER.email }, 'seed: demo user created');
    return created.id;
  }

  tally.skipped += 1;
  const existing = await usersRepo.findByEmailWithHash(DEMO_USER.email);
  return existing.id;
}

/**
 * profil-entreprise.json is an input boundary like any other: parsed before it
 * is inserted, never trusted because it shipped with the repo. The parsing and
 * the mapping both live in CompanyService, which is also what the api's import
 * endpoint calls - one definition, not two.
 * @param {string} ownerId
 * @returns {Promise<void>}
 */
async function seedCompany(ownerId) {
  const raw = JSON.parse(await readFile(join(DATA_DIR, 'profil-entreprise.json'), 'utf8'));
  const summary = await company.importProfile(ownerId, raw);

  tally.updated += 1 + summary.references + summary.team;
  logger.info(summary, 'seed: company profile upserted');
}

/**
 * Registers each dossier as a tender + its PDF as a document. Extraction does
 * NOT happen here - the ingest node owns that, and the content hash written
 * here is what lets it skip a file it has already read.
 * @param {string} ownerId
 * @returns {Promise<void>}
 */
async function seedTenders(ownerId) {
  const files = (await readdir(join(DATA_DIR, 'avis'))).filter((f) => f.endsWith('.pdf')).sort();

  for (const file of files) {
    const reference = basename(file, '.pdf');
    const path = join(DATA_DIR, 'avis', file);
    const tender = await tendersRepo.upsert({ ownerId, reference, title: null, status: 'pending' });
    await documentsRepo.upsert({
      ownerId,
      tenderId: tender.id,
      kind: 'avis',
      filePath: path,
      originalName: file,
      contentHash: await hashFile(path),
      extractionPath: 'pending',
      pageCount: 0,
    });
    tally.updated += 1;
  }
  logger.info({ count: files.length }, 'seed: dossiers registered');
}

/**
 * The company's own supporting documents: attestations and the two past memos
 * the Writer is meant to cite. No tenderId - they belong to the company.
 *
 * Registered here, INDEXED by `npm run db:index`. Indexing means OCR plus
 * embeddings, which is real quota and real minutes; putting it in the seed would
 * mean every container restart paid for it again.
 * @param {string} ownerId
 * @returns {Promise<void>}
 */
async function seedCompanyDocuments(ownerId) {
  const groups = [
    { dir: 'attestations', kind: 'attestation' },
    { dir: 'offres-passees', kind: 'memoire' },
  ];

  for (const group of groups) {
    const files = (await readdir(join(DATA_DIR, group.dir)))
      .filter((f) => f.endsWith('.pdf'))
      .sort();
    for (const file of files) {
      const path = join(DATA_DIR, group.dir, file);
      await documentsRepo.upsert({
        ownerId,
        tenderId: null,
        kind: group.kind,
        filePath: path,
        originalName: file,
        contentHash: await hashFile(path),
        extractionPath: 'pending',
        pageCount: 0,
      });
      tally.updated += 1;
    }
    logger.info({ dir: group.dir, count: files.length }, 'seed: company documents registered');
  }
}

/** @returns {Promise<void>} */
async function main() {
  logger.info({ dataDir: DATA_DIR }, 'seed: starting');
  const ownerId = await seedDemoUser();
  await seedCompany(ownerId);
  await seedTenders(ownerId);
  await seedCompanyDocuments(ownerId);
  // Silence is not a success report.
  logger.info({ ...tally, ownerId }, 'seed: done');
}

try {
  await main();
} catch (error) {
  logger.error({ err: error.message }, 'seed failed');
  process.exitCode = 1;
} finally {
  await closeDb();
}
