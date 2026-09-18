/**
 * Tender Service
 * All tender business logic. No SQL (repositories), no HTTP (controller).
 */
import { appError } from '../lib/errors.js';
import TenderRepository from '../repositories/tender.repository.js';
import DocumentRepository from '../repositories/document.repository.js';
import AnalysisRepository from '../repositories/analysis.repository.js';
import RequirementRepository from '../repositories/requirement.repository.js';

export default class TenderService {
  /**
   * @param {object} [deps]
   * @param {TenderRepository} [deps.tenders]
   * @param {DocumentRepository} [deps.documents]
   * @param {AnalysisRepository} [deps.analyses]
   * @param {RequirementRepository} [deps.requirements]
   */
  constructor({ tenders, documents, analyses, requirements } = {}) {
    this.tenders = tenders ?? new TenderRepository();
    this.documents = documents ?? new DocumentRepository();
    this.analyses = analyses ?? new AnalysisRepository();
    this.requirements = requirements ?? new RequirementRepository();
  }

  /**
   * The list the dashboard opens on. Each row carries its verdict when it has
   * one, so the list is useful without N follow-up requests.
   * @param {string} ownerId
   * @returns {Promise<object[]>}
   */
  async list(ownerId) {
    const tenders = await this.tenders.findAll(ownerId);
    return Promise.all(
      tenders.map(async (tender) => {
        const run = await this.analyses.findLatestRun(tender.id);
        const result = run ? await this.analyses.findResultByRun(run.id) : null;
        return {
          ...tender,
          analysis: result
            ? {
                runId: run.id,
                status: run.status,
                verdict: result.verdict,
                score: result.score,
                blockers: (result.blockers ?? []).length,
              }
            : run
              ? { runId: run.id, status: run.status }
              : null,
        };
      }),
    );
  }

  /**
   * Another user's tender comes back as NOT_FOUND, not FORBIDDEN: "not yours" and
   * "not there" are the same answer from outside, and the second one does not
   * confirm the id exists.
   * @param {string} id
   * @param {string} ownerId
   * @returns {Promise<object>} throws NOT_FOUND so the controller maps the status
   */
  async getById(id, ownerId) {
    const tender = await this.tenders.findById(id, ownerId);
    if (!tender) throw appError('Appel d offres introuvable.', 'TENDER_NOT_FOUND', 404);

    const documents = await this.documents.findByTender(id);
    return {
      ...tender,
      documents: documents.map((d) => ({
        id: d.id,
        kind: d.kind,
        originalName: d.originalName,
        pageCount: d.pageCount,
        extractionPath: d.extractionPath,
      })),
    };
  }

  /**
   * Registers a dossier. Deduped on (owner, AO reference): uploading the same
   * dossier twice updates it rather than creating a second one, and two users may
   * each hold their own AO-2026-004.
   * @param {{ reference: string, title?: string|null }} input already validated
   * @param {string} ownerId
   * @returns {Promise<object>}
   */
  async create(input, ownerId) {
    return this.tenders.upsert({
      ownerId,
      reference: input.reference,
      title: input.title ?? null,
      status: 'pending',
    });
  }

  /**
   * EX-02 + EX-03: the compliance matrix.
   *
   * Every requirement, typed (obligatoire / optionnelle / eliminatoire), in page
   * order, each carrying the document and page it came from so the UI can link
   * straight to it. Where an analysis has run, the profile match is merged in, so
   * one request answers both "what does this dossier demand" and "do we have it".
   *
   * @param {string} id
   * @param {string} ownerId
   * @returns {Promise<{ requirements: object[], rubric: object[] }>}
   */
  async getRequirements(id, ownerId) {
    const tender = await this.tenders.findById(id, ownerId);
    if (!tender) throw appError('Appel d offres introuvable.', 'TENDER_NOT_FOUND', 404);

    const [rows, rubric, run] = await Promise.all([
      this.requirements.findByTender(id),
      this.requirements.findRubricByTender(id),
      this.analyses.findLatestRun(id),
    ]);

    const result = run ? await this.analyses.findResultByRun(run.id) : null;
    const byRequirement = new Map(
      (result?.matches ?? []).map((match) => [match.requirementId, match]),
    );

    return {
      requirements: rows.map((row) => ({
        ...row,
        // null, not a fabricated "unknown": no analysis has run yet, which is a
        // different statement from "we looked and could not tell".
        match: byRequirement.get(row.id) ?? null,
      })),
      rubric,
    };
  }
}
