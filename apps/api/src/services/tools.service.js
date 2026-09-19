/**
 * Tools Service
 * The agent's tool belt, and the only place a tool is defined or dispatched.
 *
 * These are REAL tools: `definitions()` is handed to the provider, the model
 * chooses what to call, and `execute()` runs it. An earlier version declared a
 * belt nothing ever passed to a model - the prompt promised four tools the model
 * had no channel to call, which is decoration, not agency. If a tool is listed
 * here it is callable; if it is not callable it is not listed.
 *
 * The belt, after merging (see tools.md):
 *   search_documents         pgvector over the company corpus OR this dossier.
 *   get_company_facts        structured profil / references / equipe / historique.
 *   read_source_page         exact page text, with an OCR retry on an unread page.
 *   get_run_state            what this run has already done and already knows.
 *   check_dossier_checklist  required pieces vs pieces actually uploaded.
 *   compute_deadline         date arithmetic, which models get wrong confidently.
 *   calculate                money arithmetic, same reason.
 *   get_current_date         today. Without it the model uses its training date.
 *   simulate_score           replays the verdict under a hypothesis.
 *   web_search               Tavily. Registered ONLY when a key is configured.
 *   ask_human                asks the dirigeant and SUSPENDS the run on its answer.
 *
 * Two invariants:
 *   - every tool returns data or an explicit `{ error }`, never throws into the
 *     graph: a broken tool degrades one step, it does not kill a dossier. The
 *     one exception is the interrupt ask_human raises, which is not a failure -
 *     it is the graph parking on its checkpoint, and it must reach LangGraph
 *     rather than be caught here;
 *   - every tool that touches company or dossier data is scoped by ownerId taken
 *     from the RUN CONTEXT, never from a model-supplied argument.
 */
import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { interrupt, isGraphBubbleUp } from '@langchain/langgraph';
import { logger } from '../lib/logger.js';
import { publishRunEvent } from '../lib/runEvents.js';
import { observeTool } from '../lib/activity.js';
import { describeToolCall } from '../lib/narration.js';
import {
  ASK_HUMAN_BUDGET_SPENT,
  ASK_HUMAN_DESCRIPTION,
  ASK_HUMAN_OPTIONS,
  ASK_HUMAN_QUESTION,
} from '../prompts/askHuman.prompts.js';
import {
  businessDaysBetween,
  daysBetween,
  parseDate,
  parseTime,
  toIsoDate,
} from '../lib/dates.js';
import { calculate } from '../lib/calc.js';
import { ocrAvailable, ocrPages } from '../lib/ocr.js';
import AnalysisRepository from '../repositories/analysis.repository.js';
import CompanyRepository from '../repositories/company.repository.js';
import DocumentRepository from '../repositories/document.repository.js';
import RequirementRepository from '../repositories/requirement.repository.js';
import TenderRepository from '../repositories/tender.repository.js';
import UsageRepository from '../repositories/usage.repository.js';
import { coverageScore, findBlockers, verdict as computeVerdict } from './score.service.js';
import LlmService from './llm.service.js';
import TavilyService from './tavily.service.js';

const COMPANY_KINDS = ['memoire', 'attestation', 'profil'];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Bounded in code, never in a prompt - the same rule as MAX_REDRAFTS. A model
// told to "ask sparingly" will still ask eleven times on the one dossier being
// demoed, and every ask stops the run dead until a human notices.
export const MAX_HUMAN_ASKS = 3;

export default class ToolsService {
  /**
   * @param {object} [deps] every repository injectable, so a unit test needs no DB
   */
  constructor({ llm, tavily, documents, analyses, usage, company, requirements, tenders } = {}) {
    this.llm = llm ?? new LlmService();
    this.tavily = tavily ?? new TavilyService();
    this.documents = documents ?? new DocumentRepository();
    this.analyses = analyses ?? new AnalysisRepository();
    this.usage = usage ?? new UsageRepository();
    this.company = company ?? new CompanyRepository();
    this.requirements = requirements ?? new RequirementRepository();
    this.tenders = tenders ?? new TenderRepository();
  }

  /**
   * OpenAI-shaped tool definitions for the tools actually available right now.
   * web_search is omitted entirely when Tavily has no key, so the model is never
   * offered something that cannot work.
   * @returns {object[]}
   */
  definitions() {
    const defs = [
      fn(
        'search_documents',
        "Recherche semantique. corpus='entreprise' cherche dans les documents de " +
          "l'entreprise (memoires deja rendus, attestations, profil) pour appuyer une " +
          "exigence. corpus='dossier' cherche dans le dossier de consultation lui-meme " +
          'pour retrouver ou une clause est ecrite. Retourne des extraits reels avec ' +
          'leur document et leur page. Une liste vide est une reponse valide.',
        {
          query: { type: 'string', description: 'Ce que tu cherches, en francais' },
          corpus: { type: 'string', enum: ['entreprise', 'dossier'] },
          limit: { type: 'integer', description: 'Nombre max d extraits (defaut 5)' },
        },
        ['query', 'corpus'],
      ),
      fn(
        'get_company_facts',
        "Les donnees structurees de l'entreprise, exactes et non vectorielles. " +
          "Utilise-le pour tout chiffre : chiffre d'affaires, effectif, annee de " +
          'creation, montant ou secteur d une reference, annees d experience d un CV. ' +
          'Une recherche semantique ne repond pas correctement a "quel est le CA 2024".',
        {
          scope: { type: 'string', enum: ['profil', 'references', 'equipe', 'marches_passes'] },
          secteur: { type: 'string', description: 'Filtre references : secteur' },
          montantMin: { type: 'number', description: 'Filtre references : montant minimum en MAD' },
          anneeMin: { type: 'integer', description: 'Filtre references : annee minimum' },
        },
        ['scope'],
      ),
      fn(
        'read_source_page',
        "Relit le texte exact d'une page d'un document, pour verifier une citation " +
          'avant de la declarer eliminatoire. Si la page est un scan illisible, une ' +
          'passe OCR est tentee automatiquement et le resultat le dit.',
        { documentId: { type: 'string' }, page: { type: 'integer' } },
        ['documentId', 'page'],
      ),
      fn(
        'get_run_state',
        'Ce que cette analyse sait a cet instant : etapes deja executees, appels ' +
          'deja faits, exigences extraites, verdict courant. Consulte-le avant de ' +
          'relancer une recherche, pour ne pas repeter une requete qui a deja echoue.',
        {
          include: {
            type: 'array',
            items: { type: 'string', enum: ['etapes', 'appels', 'exigences', 'verdict'] },
            description: 'Defaut : etapes + appels',
          },
        },
        [],
      ),
      fn(
        'check_dossier_checklist',
        'Croise les pieces exigees par le marche avec les documents reellement ' +
          'deposes par l entreprise. Transforme "il manque peut-etre l attestation ' +
          'fiscale" en fait verifie. A utiliser avant d affirmer qu une piece manque.',
        {},
        [],
      ),
      fn(
        'compute_deadline',
        'Arithmetique de dates : jours calendaires et jours ouvres restants avant ' +
          'une echeance. Ne calcule JAMAIS une date de tete, appelle cet outil. ' +
          'Formats acceptes : 2026-03-12, 12/03/2026, "12 mars 2026", avec une ' +
          'heure facultative : "12/03/2026 a 09h30".',
        {
          deadline: {
            type: 'string',
            description:
              "La date d'echeance, telle qu'elle est ecrite dans le dossier. Garde " +
              "l'heure de depot si le CPS en donne une, ne la retire pas.",
          },
          from: { type: 'string', description: "Date de depart (defaut : aujourd'hui)" },
        },
        ['deadline'],
      ),
      fn(
        'calculate',
        'Arithmetique exacte : caution provisoire, TVA, penalites, HT vers TTC. ' +
          'Ne calcule JAMAIS un montant de tete. Operateurs + - * / ( ) et % postfixe ' +
          '(1.5% * 2400000 = 36000). Point decimal obligatoire, pas de virgule.',
        { expression: { type: 'string', description: 'Ex : 1.5% * 2400000' } },
        ['expression'],
      ),
      fn(
        'get_current_date',
        "La date du jour. Ton entrainement s'est arrete a une date passee : sans cet " +
          'outil tu te trompes sur "combien de temps reste-t-il" et sur la validite ' +
          "d'une attestation. Appelle-le des qu'une date compte.",
        {},
        [],
      ),
      fn(
        'simulate_score',
        'Rejoue le score et le verdict sous hypothese : "si on obtient la ' +
          'qualification 3.2, est-ce que ca repasse en go ?". Transforme un verdict ' +
          'en conseil actionnable. N ecrit rien, ne change pas le verdict reel.',
        {
          overrides: {
            type: 'array',
            description: 'Statuts hypothetiques a appliquer',
            items: {
              type: 'object',
              properties: {
                requirementId: { type: 'string' },
                status: { type: 'string', enum: ['met', 'partial', 'unmet', 'unknown'] },
              },
              required: ['requirementId', 'status'],
            },
          },
        },
        ['overrides'],
      ),
    ];

    if (this.tavily.isEnabled) {
      defs.push(
        fn(
          'web_search',
          'Recherche web : marches publics similaires deja attribues, contexte sur ' +
            "l'acheteur public, contenu reel d'une certification exigee. " +
            "N'invente jamais a partir de ces resultats : cite la source.",
          {
            query: { type: 'string' },
            maxResults: { type: 'integer' },
            fullContent: {
              type: 'boolean',
              description: 'Texte complet des pages plutot que des extraits',
            },
          },
          ['query'],
        ),
      );
    }

    defs.push(
      fn(
        'ask_human',
        ASK_HUMAN_DESCRIPTION,
        {
          question: { type: 'string', description: ASK_HUMAN_QUESTION },
          options: {
            type: 'array',
            description: ASK_HUMAN_OPTIONS,
            items: {
              type: 'object',
              properties: {
                value: { type: 'string' },
                label: { type: 'string' },
              },
              required: ['value', 'label'],
            },
          },
        },
        ['question', 'options'],
      ),
    );

    return defs;
  }

  /** @returns {string[]} the names currently callable */
  names() {
    return this.definitions().map((d) => d.function.name);
  }

  /**
   * Dispatches one tool call. Never throws: an unknown or broken tool comes back
   * as `{ error }` so the model can react to it rather than the graph dying.
   *
   * @param {string} name
   * @param {object} args already-parsed arguments
   * @param {{ runId?: string|null, tenderId?: string|null, ownerId?: string|null }} [context]
   * @returns {Promise<object>}
   */
  async execute(name, args, context = {}) {
    const { raison, ...toolArgs } = args ?? {};
    try {
      return await observeTool(
        name,
        raison,
        () => this.dispatch(name, toolArgs, { ...context, raison: raison ?? null }),
        (result) => describeToolCall(name, args ?? {}, result ?? {}),
        context,
      );
    } catch (error) {
      if (isGraphBubbleUp(error)) throw error;
      logger.warn({ tool: name, err: error.message }, 'tool: failed');
      // The full error goes to the log; what comes back is read by a model and
      // rendered in the dirigeant's activity feed, and a dumped SQL statement
      // helps neither of them.
      return { error: sanitizeToolError(error) };
    }
  }

  /**
   * Asks the dirigeant and suspends the run until the answer arrives.
   *
   * Resuming re-executes the whole node - that is how LangGraph replays a task -
   * so the same question comes back around. It is answered from the trace the
   * second time instead of stopping the run again, which also means a model that
   * rephrases its question on the replay asks a genuinely new one rather than
   * silently inheriting an answer to something else.
   *
   * @param {{ question: string, options: object[] }} args
   * @param {{ runId?: string|null, node?: string, raison?: string|null }} context
   * @returns {Promise<object>} the answer, or `{ error }` when it cannot ask
   */
  async askHuman({ question, options }, context) {
    if (!context.runId) return { error: 'Aucune analyse en cours.' };
    if (!question || !Array.isArray(options) || options.length < 2) {
      return { error: 'Il faut une question et au moins deux reponses possibles.' };
    }

    const run = await this.analyses.findRunById(context.runId);
    if (!run) return { error: 'Analyse introuvable.' };
    const trace = run.nodeTrace ?? [];
    const askKey = createHash('sha256')
      .update((context.node ?? '') + '|' + question)
      .digest('hex')
      .slice(0, 16);

    const answered = trace.find((entry) => entry.status === 'human' && entry.askKey === askKey);
    if (answered) {
      return { reponse: answered.choice, instruction: answered.instruction ?? null, verdictOverride: answered.verdictOverride ?? null, dismissedBlockers: answered.dismissedBlockers ?? [] };
    }

    if (trace.filter((entry) => entry.status === 'human').length >= MAX_HUMAN_ASKS) {
      return { error: ASK_HUMAN_BUDGET_SPENT };
    }

    const pending = {
      askId: randomUUID(),
      askKey,
      node: context.node ?? 'inconnu',
      question,
      raison: context.raison ?? null,
      options: options.slice(0, 6).map((option) => ({
        value: String(option.value ?? option.label),
        label: String(option.label ?? option.value),
      })),
      askedAt: new Date().toISOString(),
    };

    // Persisted and published BEFORE the interrupt, because interrupt() throws:
    // nothing written after this line would ever run.
    await this.analyses.setPendingQuestion(context.runId, pending);
    await publishRunEvent(context.runId, { type: 'ask', question: pending });
    logger.info({ runId: context.runId, node: pending.node }, 'tool: asking the human');

    const answer = interrupt(pending);
    return { reponse: answer?.choice ?? null, instruction: answer?.instruction ?? null, verdictOverride: answer?.verdictOverride ?? null, dismissedBlockers: answer?.dismissedBlockers ?? [] };
  }

  /**
   * @param {string} name
   * @param {object} args
   * @param {object} context
   * @returns {Promise<object>}
   */
  async dispatch(name, args, context) {
    switch (name) {
      case 'search_documents':
        return this.searchDocuments(args, context);
      case 'get_company_facts':
        return this.getCompanyFacts(args, context);
      case 'read_source_page':
        return this.readSourcePage(args.documentId, args.page, context.ownerId);
      case 'get_run_state':
        return this.getRunState(args.include, context);
      case 'check_dossier_checklist':
        return this.checkDossierChecklist(context);
      case 'compute_deadline':
        return ToolsService.computeDeadline(args.deadline, args.from);
      case 'calculate':
        return calculate(args.expression);
      case 'get_current_date':
        return ToolsService.currentDate();
      case 'simulate_score':
        return this.simulateScore(args.overrides, context);
      case 'web_search':
        return this.webSearch(args.query, args.maxResults ?? 5, args.fullContent === true);
      case 'ask_human':
        return this.askHuman(args, context);
      default:
        return { error: 'Outil inconnu: ' + name };
    }
  }

  /**
   * Semantic search over one of the two corpora. Same implementation, one filter
   * apart - which is why they are one tool and not two.
   *
   * An empty result is a legitimate answer and is returned as such, with a note
   * saying so: the Writer must be able to conclude "nothing supports this" and
   * mark the section for a human rather than reaching for the nearest match.
   *
   * @param {{ query: string, corpus?: string, limit?: number }} args
   * @param {object} context
   * @returns {Promise<{ extracts: object[], note?: string }>}
   */
  async searchDocuments({ query, corpus = 'entreprise', limit = 5 }, context) {
    if (!query || !query.trim()) return { extracts: [], note: 'Requete vide.' };
    if (!context.ownerId) {
      return { extracts: [], note: 'Aucune entreprise associee a cette analyse.' };
    }

    const dossier = corpus === 'dossier';
    if (dossier && !context.tenderId) {
      return { extracts: [], note: 'Aucun dossier associe a cette analyse.' };
    }

    const [embedding] = await this.llm.embed([query], { name: 'tool:search_documents' });
    const rows = await this.documents.searchSimilarChunks(
      embedding,
      context.ownerId,
      limit,
      dossier ? undefined : COMPANY_KINDS,
      dossier ? context.tenderId : null,
    );

    const extracts = Array.from(rows ?? []).map((row) => ({
      documentId: row.documentId ?? row.document_id,
      page: row.page,
      article: row.article,
      excerpt: String(row.content ?? '').slice(0, 800),
      distance: Number(row.distance),
    }));

    return extracts.length === 0
      ? {
          extracts: [],
          note: dossier
            ? 'Aucun passage du dossier ne correspond a cette recherche.'
            : "Aucun document de l'entreprise ne correspond a cette recherche.",
        }
      : { extracts };
  }

  /**
   * Structured company data. Four reads behind one enum rather than four tools:
   * same owner check, same return shape, and a model choosing between four
   * near-identical names picks wrong more often than it picks a scope.
   *
   * Deliberately NOT merged with search_documents: these facts have no page
   * behind them, and ComplianceAgent.checkCitations rejects a section citing an
   * identifier no document returned. Keeping the two shapes under one name would
   * make "cite a fact as if it came from a document" the easy path.
   *
   * @param {{ scope: string, secteur?: string, montantMin?: number, anneeMin?: number }} args
   * @param {object} context
   * @returns {Promise<object>}
   */
  async getCompanyFacts({ scope, secteur, montantMin, anneeMin }, context) {
    if (!context.ownerId) return { error: 'Aucune entreprise associee a cette analyse.' };

    switch (scope) {
      case 'profil': {
        const profile = await this.company.getProfile(context.ownerId);
        return profile
          ? { scope, profil: profile }
          : { scope, profil: null, note: "Aucun profil d'entreprise n'a encore ete importe." };
      }

      case 'references': {
        let rows = await this.company.findAllReferences(context.ownerId);
        if (secteur) {
          // The model writes "education" as often as "éducation"; an accent must not
          // silently empty the list and turn a held reference into a blocker.
          const wanted = normalize(secteur);
          rows = rows.filter((r) => normalize(r.secteur).includes(wanted));
        }
        if (typeof montantMin === 'number') {
          rows = rows.filter((r) => Number(r.montantHtMad) >= montantMin);
        }
        if (typeof anneeMin === 'number') {
          rows = rows.filter((r) => r.anneeDebut >= anneeMin);
        }
        return rows.length
          ? { scope, references: rows, count: rows.length }
          : {
              scope,
              references: [],
              count: 0,
              note: 'Aucune reference ne correspond a ces criteres.',
            };
      }

      case 'equipe': {
        const team = await this.company.findAllTeam(context.ownerId);
        return team.length
          ? { scope, equipe: team, count: team.length }
          : { scope, equipe: [], count: 0, note: "Aucun CV n'a encore ete importe." };
      }

      case 'marches_passes': {
        const rows = await this.tenders.findAll(context.ownerId);
        const past = rows.filter((t) => t.id !== context.tenderId);
        return past.length
          ? {
              scope,
              marches: past.map((t) => ({
                reference: t.reference,
                title: t.title,
                buyer: t.buyer,
                status: t.status,
              })),
              count: past.length,
            }
          : { scope, marches: [], count: 0, note: 'Aucun autre marche traite pour le moment.' };
      }

      default:
        return { error: 'scope inconnu: ' + scope };
    }
  }

  /**
   * The documentId comes from the model, and the model has read a PDF an outsider
   * supplied - so it is checked against the owner like any other untrusted input,
   * not trusted because it came from our own agent.
   *
   * An unread page gets ONE OCR attempt here rather than being a second tool the
   * model has to remember to call. The fallback belongs inside the read: a model
   * just told "page illisible" reaches for its own guess far more readily than it
   * reaches for another tool.
   *
   * @param {string} documentId
   * @param {number} page
   * @param {string} ownerId
   * @returns {Promise<object>}
   */
  async readSourcePage(documentId, page, ownerId) {
    if (!ownerId) return { error: 'Aucune entreprise associee a cette analyse.' };

    // The model used to pass the literal "dossier" here, borrowed from the corpus
    // enum of search_documents. Postgres rejects a non-uuid, and the raw query
    // text came back as the tool result. Say what a documentId is instead.
    if (!UUID.test(String(documentId ?? ''))) {
      return {
        error:
          "documentId invalide : attendu l'identifiant du document (uuid) imprime " +
          "sur l'exigence (documentId=...), et non le nom d'un corpus.",
      };
    }

    const document = await this.documents.findByIdForOwner(documentId, ownerId);
    if (!document) return { error: 'Document introuvable dans ce dossier.' };

    const chunks = await this.documents.findChunks(documentId);
    const match = chunks.find((c) => c.page === Number(page));

    if (!match) return { error: 'Page ' + page + ' introuvable dans ce document.' };

    if (match.extraction !== 'unread') {
      return {
        documentId,
        page: match.page,
        article: match.article,
        readable: true,
        text: match.content,
      };
    }

    const repaired = await this.retryOcr(document, match);
    if (repaired) {
      return { documentId, page: match.page, readable: true, text: repaired, extraction: 'ocr' };
    }

    // EX-07: an unreadable page says so. It never comes back as empty text that
    // the model could mistake for "this page contains nothing".
    return {
      documentId,
      page: match.page,
      readable: false,
      note:
        "Cette page n'a pas pu etre lue, meme apres une tentative d'OCR (scan " +
        "illisible). N'en deduis aucune exigence et signale-la comme non lue.",
    };
  }

  /**
   * One OCR attempt on a single page, persisted so the next call is free.
   * Returns null on any failure - a repair that did not work must look exactly
   * like a page that was never repaired.
   *
   * @param {object} document
   * @param {object} chunk
   * @returns {Promise<string|null>}
   */
  async retryOcr(document, chunk) {
    try {
      if (!(await ocrAvailable())) return null;
      const buffer = await readFile(document.filePath);
      const [result] = await ocrPages(buffer, [chunk.page]);
      const text = result?.text?.trim();
      if (!text) return null;

      await this.documents.updateChunk(chunk.id, { content: text, extraction: 'ocr' });
      logger.info({ documentId: document.id, page: chunk.page }, 'tool: page repaired by OCR');
      return text;
    } catch (error) {
      logger.warn({ page: chunk.page, err: error.message }, 'tool: OCR retry failed');
      return null;
    }
  }

  /**
   * What this run already did AND already knows. The "memoriser" half of the
   * agentic loop: a retry reads this first so it cannot fire the same failed
   * query twice, and the Writer can read the extracted requirements rather than
   * only the slice the graph state handed it.
   *
   * @param {string[]} [include]
   * @param {object} context
   * @returns {Promise<object>}
   */
  async getRunState(include, context) {
    if (!context.runId) return { note: 'Aucune analyse en cours.' };
    const want = new Set(include?.length ? include : ['etapes', 'appels']);

    const run = await this.analyses.findRunById(context.runId);
    const state = {};

    if (want.has('etapes')) {
      state.steps = (run?.nodeTrace ?? []).map((entry) => ({
        node: entry.node,
        summary: entry.summary,
        status: entry.status,
        at: entry.at,
      }));
    }

    if (want.has('appels')) {
      const calls = await this.usage.findByRequest(context.runId).catch(() => []);
      state.calls = calls.map((call) => ({
        operation: call.operation,
        status: call.status,
        totalTokens: call.totalTokens,
      }));
    }

    if (want.has('exigences') && context.tenderId) {
      const rows = await this.requirements.findByTender(context.tenderId);
      state.requirements = rows.map((r) => ({
        id: r.id,
        text: r.text,
        obligation: r.obligation,
        nature: r.nature,
        sourcePage: r.sourcePage,
        sourceArticle: r.sourceArticle,
      }));
    }

    if (want.has('verdict')) {
      const result = await this.analyses.findResultByRun(context.runId).catch(() => null);
      state.verdict = result
        ? { verdict: result.verdict, score: result.score, blockers: result.blockers }
        : null;
    }

    return state;
  }

  /**
   * Required pieces vs pieces actually uploaded. The join IS the value, which is
   * why it is its own tool and not a scope of something else.
   *
   * Matching is by keyword against the uploaded filenames, and the result says
   * so: this is a shortlist for a human to confirm, not a compliance certificate.
   *
   * @param {object} context
   * @returns {Promise<object>}
   */
  async checkDossierChecklist(context) {
    if (!context.ownerId || !context.tenderId) {
      return { error: 'Analyse sans entreprise ou sans dossier associe.' };
    }

    const [required, companyDocs] = await Promise.all([
      this.requirements.findByTender(context.tenderId),
      this.documents.findCompanyDocuments(context.ownerId),
    ]);

    const pieces = required.filter((r) => r.nature === 'procedure');
    const haystack = normalize(
      companyDocs.map((d) => d.originalName + ' ' + d.kind).join(' | '),
    );

    const rows = pieces.map((piece) => {
      const hit = keywordsOf(piece.text).find((word) => haystack.includes(word));
      return {
        requirementId: piece.id,
        text: piece.text,
        obligation: piece.obligation,
        sourcePage: piece.sourcePage,
        fourni: Boolean(hit),
        indice: hit ?? null,
      };
    });

    return {
      pieces: rows,
      manquantes: rows.filter((r) => !r.fourni).map((r) => r.text),
      documentsDeposes: companyDocs.map((d) => ({ kind: d.kind, nom: d.originalName })),
      note:
        'Rapprochement par mots-cles sur le nom des fichiers deposes. Une piece ' +
        'marquee fournie reste a confirmer par un humain.',
    };
  }

  /**
   * Replays the real scoring functions under hypothetical statuses. It reads the
   * persisted result and returns a projection - it never writes, so a what-if can
   * never become the verdict by accident.
   *
   * @param {{ requirementId: string, status: string }[]} overrides
   * @param {object} context
   * @returns {Promise<object>}
   */
  async simulateScore(overrides, context) {
    if (!context.runId || !context.tenderId) return { error: 'Aucune analyse en cours.' };

    const result = await this.analyses.findResultByRun(context.runId);
    if (!result) return { error: "L'analyse n'a pas encore produit de resultat." };

    const requirements = await this.requirements.findByTender(context.tenderId);
    const patched = new Map((result.matches ?? []).map((m) => [m.requirementId, { ...m }]));

    for (const override of overrides ?? []) {
      const existing = patched.get(override.requirementId) ?? {
        requirementId: override.requirementId,
        confidence: 0.5,
      };
      patched.set(override.requirementId, {
        ...existing,
        status: override.status,
        reason: 'Hypothese simulee.',
      });
    }

    const matches = [...patched.values()];
    const score = coverageScore(requirements, matches);
    const blockers = findBlockers(requirements, matches);
    const projected = computeVerdict(score, blockers, matches);

    return {
      hypothese: overrides,
      actuel: {
        verdict: result.verdict,
        score: Number(result.score),
        blockers: (result.blockers ?? []).length,
      },
      projete: { verdict: projected.verdict, score, blockers: blockers.length },
      bloquantsRestants: blockers.map((b) => b.text),
      note: 'Projection. Le verdict enregistre est inchange.',
    };
  }

  /**
   * @param {string} query
   * @param {number} maxResults
   * @param {boolean} fullContent
   * @returns {Promise<object>}
   */
  async webSearch(query, maxResults, fullContent) {
    const result = await this.tavily.search(query, { maxResults, fullContent });
    if (result.degraded) {
      // Explicit, so the model reports "pas de verification externe" instead of
      // silently treating an empty result as evidence of absence.
      return {
        results: [],
        note: 'Recherche web indisponible. Poursuis sans verification externe et ne conclus rien de cette absence.',
      };
    }
    return { results: result.results, answer: result.answer };
  }

  /**
   * Today, from the system clock.
   *
   * Small, and the single highest-value tool on the belt: without it the model
   * answers "il reste combien de jours" from its training cutoff, which is months
   * or years off, and does it with complete confidence.
   *
   * @returns {{ today: string, weekday: string, note: string }}
   */
  static currentDate() {
    const now = new Date();
    return {
      today: toIsoDate(now),
      weekday: now.toLocaleDateString('fr-FR', { weekday: 'long', timeZone: 'UTC' }),
      note: "Date reelle du systeme. Utilise-la, pas ta date d'entrainement.",
    };
  }

  /**
   * @param {string} deadline
   * @param {string} [from]
   * @returns {object}
   */
  static computeDeadline(deadline, from) {
    const target = parseDate(deadline);
    if (!target) {
      return {
        error:
          'Date illisible : "' +
          deadline +
          '". Formats acceptes : 2026-03-12, 12/03/2026, "12 mars 2026", ' +
          'avec une heure facultative : "12/03/2026 a 09h30".',
      };
    }

    const start = from ? parseDate(from) : parseDate(toIsoDate(new Date()));
    if (!start) return { error: 'Date de depart illisible : "' + from + '".' };

    const calendar = daysBetween(start, target);
    const heureLimite = parseTime(deadline);

    return {
      deadline: toIsoDate(target),
      heureLimite,
      from: toIsoDate(start),
      joursCalendaires: calendar,
      joursOuvres: businessDaysBetween(start, target),
      depassee: calendar < 0,
      note:
        'Jours ouvres = hors samedi et dimanche. Les jours feries marocains ne sont ' +
        'PAS deduits (plusieurs suivent le calendrier lunaire) : traite ce chiffre ' +
        'comme un maximum et dis-le.' +
        (heureLimite
          ? ' Le dernier jour n est pas un jour entier : le depot ferme a ' +
            heureLimite + '.'
          : ''),
    };
  }
}

/**
 * Builds one OpenAI function definition. Ten inline literals of the same shape is
 * where a typo in `parameters` hides.
 *
 * @param {string} name
 * @param {string} description
 * @param {object} properties
 * @param {string[]} required
 * @returns {object}
 */
/**
 * @param {Error} error
 * @returns {string} safe for a model and for the activity feed
 */
function sanitizeToolError(error) {
  const message = String(error?.message ?? '');
  return /failed query|select |insert |update |delete /i.test(message)
    ? "Erreur technique pendant l'appel de l'outil. Le detail est dans les logs."
    : message;
}

function fn(name, description, properties, required) {
  return {
    type: 'function',
    function: {
      name,
      description,
      parameters: {
        type: 'object',
        properties: {
          ...properties,
          // EVERY tool carries this, added in one place so no tool can forget it.
          //
          // It is how the agent's reasoning reaches the screen without costing a
          // second model call: the model writes why it is reaching for the tool
          // as part of the call it was already making. The dirigeant reads this
          // sentence; `lib/narration.js` supplies what actually came back, which
          // is the half the model is not allowed to narrate.
          raison: {
            type: 'string',
            description:
              "Pourquoi tu appelles cet outil, en UNE phrase courte adressee au " +
              "dirigeant de la PME, sans jargon technique et sans nommer l'outil. " +
              'Ex : "Pour verifier si un de vos CV couvre les 10 ans exiges".',
          },
        },
        required,
      },
    },
  };
}

/**
 * The DISCRIMINATING words in a requirement - the ones that would tell two
 * uploaded files apart.
 *
 * The document-class nouns are stop words, and that is the whole point: matching
 * on "attestation" marks "attestation fiscale" as satisfied by a file named
 * attestation-cnss.pdf, which is a different document and a false all-clear on a
 * piece that can disqualify the bid. Only "fiscale" or "cnss" may carry a match.
 *
 * @param {string} text
 * @returns {string[]}
 */
function keywordsOf(text) {
  return normalize(text)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4 && !STOP.has(word))
    .map(stem);
}

/** Generic words that appear in every requirement or every filename. */
const STOP = new Set([
  // procedural boilerplate
  'candidat', 'candidats', 'doit', 'doivent', 'devra', 'fournir', 'joindre',
  'produire', 'presenter', 'presente', 'remettre', 'sous', 'peine', 'rejet',
  'ainsi', 'que', 'les', 'des', 'une', 'aux', 'dans', 'pour', 'avec', 'par',
  'moins', 'plus', 'mois', 'jours', 'date', 'datee', 'validite', 'cours',
  // document-class nouns: present in nearly every filename, so they discriminate
  // nothing and a match on one is a false positive by construction
  'document', 'documents', 'piece', 'pieces', 'copie', 'copies', 'original',
  'originaux', 'dossier', 'attestation', 'attestations', 'certificat',
  'certificats', 'memoire', 'memoires', 'profil', 'justificatif', 'justificatifs',
]);

/**
 * Drops a trailing plural/feminine mark so "fiscale" matches "fiscal", but only
 * when enough word survives to still mean something - "cnss" must not become
 * "cns".
 *
 * @param {string} word
 * @returns {string}
 */
function stem(word) {
  const shorter = word.replace(/[es]$/, '');
  return shorter.length >= 5 ? shorter : word;
}

/**
 * @param {string} text
 * @returns {string} lowercased, accent-stripped
 */
function normalize(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}
