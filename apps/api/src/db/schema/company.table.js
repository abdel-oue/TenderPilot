import { boolean, integer, jsonb, numeric, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

// The text primary keys ARE the seed's business keys. That is what makes the
// seed idempotent without a single TRUNCATE.

// Single row, keyed on the ICE so the upsert has something stable to conflict on.
export const companyProfile = pgTable('company_profile', {
  ice: text('ice').primaryKey(),
  raisonSociale: text('raison_sociale').notNull(),
  formeJuridique: text('forme_juridique').notNull(),
  rc: text('rc').notNull(),
  ifFiscal: text('if_fiscal').notNull(),
  cnss: text('cnss').notNull(),
  siege: text('siege').notNull(),
  creation: integer('creation').notNull(),
  effectif: integer('effectif').notNull(),
  chiffreAffaires: jsonb('chiffre_affaires').notNull().default({}),
  certifications: jsonb('certifications').notNull().default([]),
  attestations: jsonb('attestations').notNull().default([]),
  secteurs: jsonb('secteurs').notNull().default([]),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const companyReferences = pgTable('company_references', {
  id: text('id').primaryKey(), // REF-01..
  client: text('client').notNull(),
  secteur: text('secteur').notNull(),
  objet: text('objet').notNull(),
  montantHtMad: numeric('montant_ht_mad').notNull(),
  anneeDebut: integer('annee_debut').notNull(),
  dureeMois: integer('duree_mois').notNull(),
  attestationBonneExecution: boolean('attestation_bonne_execution').notNull(),
});

export const teamMembers = pgTable('team_members', {
  id: text('id').primaryKey(), // CV-01..
  initiales: text('initiales').notNull(),
  poste: text('poste').notNull(),
  anneesExperience: integer('annees_experience').notNull(),
  diplome: text('diplome').notNull(),
  certifications: jsonb('certifications').notNull().default([]),
  langues: jsonb('langues').notNull().default([]),
});
