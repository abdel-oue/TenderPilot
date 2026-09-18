/**
 * Company Service
 * ONE COMPANY PER USER: reading it, and importing it from a profil-entreprise
 * JSON payload.
 *
 * The file's shape and the stored shape are not the same thing - the file is
 * French and snake_case, the table is camelCase - and the mapping between them
 * lives here, once. The seed imports through this same method rather than
 * carrying its own copy of the mapping.
 */
import { companySchema } from '@tenderpilot/shared';
import { appError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import CompanyRepository from '../repositories/company.repository.js';

export default class CompanyService {
  /** @param {CompanyRepository} [companies] injectable for tests */
  constructor(companies = new CompanyRepository()) {
    this.companies = companies;
  }

  /**
   * The whole company in one read - the UI shows profile, references and team
   * together, so splitting this into three endpoints would only mean three
   * round trips.
   *
   * `profile: null` for a user who has not imported one yet. That is a normal
   * first-login state, not an error.
   *
   * @param {string} ownerId
   * @returns {Promise<{ profile: object|null, references: object[], team: object[] }>}
   */
  async get(ownerId) {
    const [profile, references, team] = await Promise.all([
      this.companies.getProfile(ownerId),
      this.companies.findAllReferences(ownerId),
      this.companies.findAllTeam(ownerId),
    ]);
    return { profile: profile ?? null, references, team };
  }

  /**
   * Imports (or re-imports) a company profile for one user.
   *
   * Idempotent: every write is an upsert on a stable business key - the owner for
   * the profile, (owner, REF-xx) and (owner, CV-xx) for the rest - so importing
   * the same file twice leaves the same rows.
   *
   * @param {string} ownerId
   * @param {unknown} raw the parsed JSON, unvalidated
   * @returns {Promise<{ references: number, team: number }>}
   */
  async importProfile(ownerId, raw) {
    const parsed = companySchema.safeParse(raw);
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((issue) => issue.path.join('.') + ': ' + issue.message)
        .join('; ');
      throw appError('Profil entreprise invalide. ' + detail, 'VALIDATION_FAILED', 400);
    }
    const company = parsed.data;

    await this.companies.upsertProfile({
      ownerId,
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

    await this.companies.upsertReferences(
      company.references.map((reference) => ({
        ownerId,
        id: reference.id,
        client: reference.client,
        secteur: reference.secteur,
        objet: reference.objet,
        montantHtMad: String(reference.montant_ht_mad),
        anneeDebut: reference.annee_debut,
        dureeMois: reference.duree_mois,
        attestationBonneExecution: reference.attestation_bonne_execution,
      })),
    );

    await this.companies.upsertTeamMembers(
      company.equipe.map((member) => ({
        ownerId,
        id: member.id,
        initiales: member.initiales,
        poste: member.poste,
        anneesExperience: member.annees_experience,
        diplome: member.diplome,
        certifications: member.certifications,
        langues: member.langues,
      })),
    );

    const summary = { references: company.references.length, team: company.equipe.length };
    logger.info({ ownerId, ...summary }, 'company: profile imported');
    return summary;
  }
}
