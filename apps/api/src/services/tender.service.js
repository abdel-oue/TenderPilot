/**
 * Tender Service
 * All tender business logic. No SQL (repositories), no HTTP (controller).
 */
import { appError } from '../lib/errors.js';
import TenderRepository from '../repositories/tender.repository.js';
import DocumentRepository from '../repositories/document.repository.js';
import AnalysisRepository from '../repositories/analysis.repository.js';

export default class TenderService {
  /**
   * @param {object} [deps]
   * @param {TenderRepository} [deps.tenders]
   * @param {DocumentRepository} [deps.documents]
   * @param {AnalysisRepository} [deps.analyses]
   */
  constructor({ tenders, documents, analyses } = {}) {
    this.tenders = tenders ?? new TenderRepository();
    this.documents = documents ?? new DocumentRepository();
    this.analyses = analyses ?? new AnalysisRepository();
  }

  /**
   * The list the dashboard opens on. Each row carries its verdict when it has
   * one, so the list is useful without N follow-up requests.
   * @returns {Promise<object[]>}
   */
  async list() {
    const tenders = await this.tenders.findAll();
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
   * @param {string} id
   * @returns {Promise<object>} throws NOT_FOUND so the controller maps the status
   */
  async getById(id) {
    const tender = await this.tenders.findById(id);
    if (!tender) throw appError('Appel d offres introuvable.', 'TENDER_NOT_FOUND', 404);

    const documents = await this.documents.findByTender(id);
    return {
      ...tender,
      documents: documents.map((d) => ({
        id: d.id,
        kind: d.kind,
        pageCount: d.pageCount,
        extractionPath: d.extractionPath,
      })),
    };
  }

  /**
   * Registers a dossier. Deduped on the AO reference: uploading the same dossier
   * twice updates it rather than creating a second one.
   * @param {{ reference: string, title?: string|null }} input already validated
   * @returns {Promise<object>}
   */
  async create(input) {
    return this.tenders.upsert({
      reference: input.reference,
      title: input.title ?? null,
      status: 'pending',
    });
  }
}
