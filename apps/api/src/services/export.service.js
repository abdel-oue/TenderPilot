/**
 * Export Service
 * EX-05: the drafted memoire technique as a DOCX the user can open and finish.
 *
 * Deliberately NOT a clean document. The [A COMPLETER PAR L'HUMAIN] markers the
 * Writer left are copied through verbatim, and the verdict page states the
 * blockers up front. An export that quietly tidied those away would hand back a
 * file that looks finished and is not - which is the failure this product exists
 * to prevent, reintroduced at the last step.
 */
import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { appError } from '../lib/errors.js';
import AnalysisRepository from '../repositories/analysis.repository.js';
import AnalysisService from './analysis.service.js';
import TenderRepository from '../repositories/tender.repository.js';

// Section order in the document. Sections are keyed by requirement category, and
// a memoire that opens with "pieces administratives" reads backwards.
const SECTION_ORDER = ['technical', 'team', 'schedule', 'financial', 'administrative'];

export default class ExportService {
  /**
   * @param {object} [deps]
   * @param {AnalysisRepository} [deps.analyses]
   * @param {TenderRepository} [deps.tenders]
   * @param {AnalysisService} [deps.analysisService]
   */
  constructor({ analyses, tenders, analysisService } = {}) {
    this.analyses = analyses ?? new AnalysisRepository();
    this.tenders = tenders ?? new TenderRepository();
    // Reused rather than reimplemented: the ownership check for a run already
    // lives in one place.
    this.analysisService = analysisService ?? new AnalysisService({ analyses, tenders });
  }

  /**
   * @param {string} runId
   * @param {string} ownerId
   * @returns {Promise<{ buffer: Buffer, filename: string }>}
   */
  async exportDocx(runId, ownerId) {
    const run = await this.analysisService.findOwnedRun(runId, ownerId);
    const [tender, result, sections] = await Promise.all([
      this.tenders.findById(run.tenderId, ownerId),
      this.analyses.findResultByRun(runId),
      this.analyses.findSections(runId),
    ]);

    if (sections.length === 0) {
      throw appError(
        "Aucune section redigee pour cette analyse. Un dossier en no-go n'est pas redige.",
        'NOTHING_TO_EXPORT',
        409,
      );
    }

    const document = new Document({
      sections: [
        { children: [...this.coverPage(tender, result), ...this.bodyPages(sections)] },
      ],
    });

    return {
      buffer: await Packer.toBuffer(document),
      filename: `memoire-technique-${tender.reference}.docx`,
    };
  }

  /**
   * Title, verdict, and the blockers - in that order, because the blockers are
   * what the reader has to decide about before reading a word of the draft.
   * @param {object} tender
   * @param {object|null} result
   * @returns {Paragraph[]}
   */
  coverPage(tender, result) {
    const children = [
      new Paragraph({
        text: 'Memoire technique',
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({ text: `${tender.reference}${tender.title ? ' - ' + tender.title : ''}` }),
      new Paragraph({ text: '' }),
      new Paragraph({ text: 'Synthese', heading: HeadingLevel.HEADING_1 }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Verdict : ', bold: true }),
          new TextRun({ text: (result?.verdict ?? 'indetermine').toUpperCase() }),
          new TextRun({ text: result?.score ? `  -  score ${result.score}/100` : '' }),
        ],
      }),
      new Paragraph({ text: result?.justification ?? '' }),
    ];

    const blockers = result?.blockers ?? [];
    children.push(
      new Paragraph({
        text: `Points bloquants (${blockers.length})`,
        heading: HeadingLevel.HEADING_2,
      }),
    );

    if (blockers.length === 0) {
      children.push(new Paragraph({ text: 'Aucun point bloquant identifie.' }));
    } else {
      for (const blocker of blockers) {
        children.push(
          new Paragraph({
            // Provenance travels into the export too. A blocker the reader cannot
            // trace back to a page is one they cannot check.
            text: `${blocker.text} — ${blocker.reason}` +
              (blocker.sourcePage ? ` (p. ${blocker.sourcePage})` : ''),
            bullet: { level: 0 },
          }),
        );
      }
    }

    return children;
  }

  /**
   * One heading + body per section, in reading order, with human rewrites clearly
   * marked as such.
   * @param {object[]} sections
   * @returns {Paragraph[]}
   */
  bodyPages(sections) {
    const ordered = [...sections].sort(
      (a, b) => rank(a.sectionKey) - rank(b.sectionKey),
    );

    return ordered.flatMap((section) => [
      new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_1 }),
      ...(section.editedByHuman
        ? [
            new Paragraph({
              children: [new TextRun({ text: 'Section revue et corrigee.', italics: true })],
            }),
          ]
        : []),
      // Blank lines in the draft become real paragraph breaks rather than one
      // unreadable block. The [A COMPLETER] markers pass through untouched.
      ...section.content.split(/\n{2,}/).map((block) => new Paragraph({ text: block.trim() })),
      new Paragraph({ text: '' }),
    ]);
  }
}

/**
 * @param {string} key
 * @returns {number} position in SECTION_ORDER, unknown keys last
 */
function rank(key) {
  const position = SECTION_ORDER.indexOf(key);
  return position === -1 ? SECTION_ORDER.length : position;
}
