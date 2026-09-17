import { z } from 'zod';

// Validates profil-entreprise.json as it sits on disk. The seed's input is a
// boundary like any other, so the keys here are the FILE's keys — French,
// snake_case — not the shape we store. The seed does the mapping, once.

export const referenceSchema = z.object({
  id: z.string().regex(/^REF-\d{2}$/, 'reference id must look like REF-01'),
  client: z.string().min(1),
  secteur: z.string().min(1),
  objet: z.string().min(1),
  montant_ht_mad: z.number().nonnegative(),
  annee_debut: z.number().int().min(1990).max(2100),
  duree_mois: z.number().int().positive(),
  attestation_bonne_execution: z.boolean(),
});

export const teamMemberSchema = z.object({
  id: z.string().regex(/^CV-\d{2}$/, 'team member id must look like CV-01'),
  initiales: z.string().min(1),
  poste: z.string().min(1),
  annees_experience: z.number().int().nonnegative(),
  diplome: z.string().min(1),
  certifications: z.array(z.string()),
  langues: z.array(z.string()),
});

export const companySchema = z.object({
  raison_sociale: z.string().min(1),
  forme_juridique: z.string().min(1),
  ice: z.string().min(1),
  rc: z.string().min(1),
  if_fiscal: z.string().min(1),
  cnss: z.string().min(1),
  siege: z.string().min(1),
  creation: z.number().int(),
  effectif: z.number().int().positive(),
  // year -> revenue. Keys are years as strings in the file.
  chiffre_affaires_ht_mad: z.record(z.string(), z.number()),
  certifications: z.array(z.string()),
  attestations_disponibles: z.array(z.string()),
  secteurs_couverts: z.array(z.string()),
  references: z.array(referenceSchema).min(1),
  equipe: z.array(teamMemberSchema).min(1),
});

/** @typedef {import('zod').infer<typeof companySchema>} Company */
/** @typedef {import('zod').infer<typeof referenceSchema>} CompanyReference */
/** @typedef {import('zod').infer<typeof teamMemberSchema>} TeamMember */
