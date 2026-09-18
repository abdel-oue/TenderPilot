import { boolean, integer, jsonb, numeric, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './user.table.js';

// ONE COMPANY PER USER. `ownerId` is the primary key of the profile, not a
// column beside it: the schema itself makes a second profile for the same user
// impossible, so no service has to remember to check.
//
// References and team members keep their business key (REF-01, CV-01) but pair
// it with the owner: two users both importing a "REF-01" is normal, not a
// conflict, so the primary key is the PAIR. That is also what keeps the seed
// idempotent without a single TRUNCATE.
export const companyProfile = pgTable('company_profile', {
  ownerId: uuid('owner_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  ice: text('ice').notNull(),
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

export const companyReferences = pgTable(
  'company_references',
  {
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    id: text('id').notNull(), // REF-01..
    client: text('client').notNull(),
    secteur: text('secteur').notNull(),
    objet: text('objet').notNull(),
    montantHtMad: numeric('montant_ht_mad').notNull(),
    anneeDebut: integer('annee_debut').notNull(),
    dureeMois: integer('duree_mois').notNull(),
    attestationBonneExecution: boolean('attestation_bonne_execution').notNull(),
  },
  (table) => [primaryKey({ columns: [table.ownerId, table.id] })],
);

export const teamMembers = pgTable(
  'team_members',
  {
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    id: text('id').notNull(), // CV-01..
    initiales: text('initiales').notNull(),
    poste: text('poste').notNull(),
    anneesExperience: integer('annees_experience').notNull(),
    diplome: text('diplome').notNull(),
    certifications: jsonb('certifications').notNull().default([]),
    langues: jsonb('langues').notNull().default([]),
  },
  (table) => [primaryKey({ columns: [table.ownerId, table.id] })],
);
