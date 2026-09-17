// Seed entry point. Idempotent. Non-destructive. Run it five times, same rows.
//
// The corpus sits BESIDE this file in seed/data/ - gitignored, dropped in locally,
// mounted read-only into the container. Resolved from import.meta.dirname, never
// from cwd: the seed runs from the repo root in dev and from /app/apps/api in
// the container.
//
// NEVER: TRUNCATE, DROP, or an unfiltered DELETE. Destructive reset is db:reset.

import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { companySchema } from '@tenderpilot/shared';
import { closeDb } from '../client.js';
import { logger } from '../../lib/logger.js';
import { hashPassword } from '../../lib/password.js';
import CompanyRepository from '../../repositories/company.repository.js';
import DocumentRepository from '../../repositories/document.repository.js';
import TenderRepository from '../../repositories/tender.repository.js';
import UserRepository from '../../repositories/user.repository.js';

const companies = new CompanyRepository();
const documentsRepo = new DocumentRepository();
const tendersRepo = new TenderRepository();
const usersRepo = new UserRepository();

const DATA_DIR = join(import.meta.dirname, 'data');

// Local fixture only, and the corpus is gitignored, so this is not a committed
// credential. It exists because auth is out of scope but still gates the app.
const DEMO_USER = { email: 'demo@tenderpilot.local', name: 'Demo', password: 'demo1234' };

const tally = { created: 0, updated: 0, skipped: 0 };

/**
 * @param {string} path
 * @returns {Promise<string>} sha256 of the file bytes - the parse cache key
 */
async function hashFile(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

/** @returns {Promise<void>} */
async function seedDemoUser() {
  const row = await usersRepo.insert({
    email: DEMO_USER.email,
    name: DEMO_USER.name,
    passwordHash: await hashPassword(DEMO_USER.password),
  });
  if (row) {
    tally.created += 1;
    logger.info({ email: DEMO_USER.email }, 'seed: demo user created');
  } else {
    tally.skipped += 1;
  }
}

/**
 * profil-entreprise.json is an input boundary like any other: parsed before it
 * is inserted, never trusted because it shipped with the repo.
 * @returns {Promise<void>}
 */
async function seedCompany() {
  const raw = JSON.parse(await readFile(join(DATA_DIR, 'profil-entreprise.json'), 'utf8'));
  const parsed = companySchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => i.path.join('.') + ': ' + i.message).join('\n');
    throw new Error('profil-entreprise.json is invalid:\n' + issues);
  }
  const company = parsed.data;

  // references.csv and equipe.csv hold the same rows as the JSON - one source,
  // not three.
  await companies.upsertProfile({
    ice: company.ice,
    raisonSociale: company.raison_sociale,
    formeJuridique: company.forme_juridique,
    rc: company.rc,
    ifFiscal: company.if_fiscal,
    cnss: company.cnss,
    siege: company.siege,
    creation: company.creation,
    effectif: company.effectif,
    chiffreAffaires: company.chiffre_affaires_ht_mad,
    certifications: company.certifications,
    attestations: company.attestations_disponibles,
    secteurs: company.secteurs_couverts,
    updatedAt: new Date(),
  });

  await companies.upsertReferences(
    company.references.map((r) => ({
      id: r.id,
      client: r.client,
      secteur: r.secteur,
      objet: r.objet,
      montantHtMad: String(r.montant_ht_mad),
      anneeDebut: r.annee_debut,
      dureeMois: r.duree_mois,
      attestationBonneExecution: r.attestation_bonne_execution,
    })),
  );

  await companies.upsertTeamMembers(
    company.equipe.map((m) => ({
      id: m.id,
      initiales: m.initiales,
      poste: m.poste,
      anneesExperience: m.annees_experience,
      diplome: m.diplome,
      certifications: m.certifications,
      langues: m.langues,
    })),
  );

  tally.updated += 1 + company.references.length + company.equipe.length;
  logger.info(
    { references: company.references.length, team: company.equipe.length },
    'seed: company profile upserted',
  );
}

/**
 * Registers each dossier as a tender + its PDF as a document. Extraction does
 * NOT happen here - the ingest node owns that, and the content hash written
 * here is what lets it skip a file it has already read.
 * @returns {Promise<void>}
 */
async function seedTenders() {
  const files = (await readdir(join(DATA_DIR, 'avis'))).filter((f) => f.endsWith('.pdf')).sort();

  for (const file of files) {
    const reference = basename(file, '.pdf');
    const path = join(DATA_DIR, 'avis', file);
    const tender = await tendersRepo.upsert({ reference, title: null, status: 'pending' });
    await documentsRepo.upsert({
      tenderId: tender.id,
      kind: 'avis',
      filePath: path,
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
 * @returns {Promise<void>}
 */
async function seedCompanyDocuments() {
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
        tenderId: null,
        kind: group.kind,
        filePath: path,
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
  await seedDemoUser();
  await seedCompany();
  await seedTenders();
  await seedCompanyDocuments();
  // Silence is not a success report.
  logger.info(tally, 'seed: done');
}

try {
  await main();
} catch (error) {
  logger.error({ err: error.message }, 'seed failed');
  process.exitCode = 1;
} finally {
  await closeDb();
}
