// Real graph and agents; model/repository boundaries are deterministic doubles.
// These tests establish orchestration, not the model's recall on an unseen CPS.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemorySaver } from '@langchain/langgraph';
import { buildGraph } from '../../src/graph/index.js';
import LlmService from '../../src/services/llm.service.js';
import RequirementRepository from '../../src/repositories/requirement.repository.js';
import CompanyRepository from '../../src/repositories/company.repository.js';
import AnalysisRepository from '../../src/repositories/analysis.repository.js';

vi.mock('../../src/graph/nodes/ingest.node.js', () => ({
  ingest: async () => ({ pages: Array.from({ length: 80 }, (_, i) => ({ documentId: 'd1', page: i + 1, extraction: 'text_layer', text: i === 46 ? 'Trois references ferroviaires sous peine de rejet.' : 'Conditions generales du marche.' })) }),
}));
vi.mock('../../src/lib/runEvents.js', () => ({ publishRunEvent: async () => {} }));

let calls, sections, matchStatus, failExtraction, omitFirstPass, incompleteAudit;
beforeEach(() => {
  calls = []; sections = []; matchStatus = 'met'; failExtraction = false; omitFirstPass = false; incompleteAudit = false;
  for (const method of ['deleteByTender', 'updateObligation', 'deleteRubricByTender', 'insertRubric']) vi.spyOn(RequirementRepository.prototype, method).mockResolvedValue();
  vi.spyOn(RequirementRepository.prototype, 'insertMany').mockImplementation(async (rows) => rows.map((r, i) => ({ ...r, id: 'r' + i })));
  vi.spyOn(CompanyRepository.prototype, 'getProfile').mockResolvedValue({ raisonSociale: 'Test SME' });
  vi.spyOn(CompanyRepository.prototype, 'findAllReferences').mockResolvedValue([{ id: 'REF-01', secteur: 'ferroviaire' }]);
  vi.spyOn(CompanyRepository.prototype, 'findAllTeam').mockResolvedValue([]);
  vi.spyOn(AnalysisRepository.prototype, 'findHumanEditsForTender').mockResolvedValue([]);
  vi.spyOn(AnalysisRepository.prototype, 'upsertSection').mockImplementation(async (s) => { sections.push(s); return s; });
  vi.spyOn(LlmService.prototype, 'complete').mockImplementation(async (options) => {
    calls.push(options);
    let output;
    switch (options.name) {
      case 'extractor':
        if (failExtraction) throw new Error('Model timed out');
        output = { requirements: [{ text: 'Trois references ferroviaires', category: 'technical', nature: 'capacite', obligation: 'eliminatoire', sourcePage: 47, sourceArticle: null, quote: 'Trois references ferroviaires sous peine de rejet.' }] };
        if (omitFirstPass) output.requirements = [];
        break;
      case 'classifier': output = { obligation: 'eliminatoire', confidence: 1, reason: 'Rejet explicite' }; break;
      case 'extractionAudit': {
        const pages = [...options.user.matchAll(/--- PAGE (\d+) ---/g)].map((m) => Number(m[1]));
        output = { requirements: pages.includes(47) ? [{ text: 'Trois references ferroviaires', category: 'technical', nature: 'capacite', obligation: 'eliminatoire', sourcePage: 47, sourceArticle: null, quote: 'Trois references ferroviaires sous peine de rejet.' }] : [], reviewedPages: pages };
        if (incompleteAudit) output.reviewedPages = pages.slice(1);
        break;
      }
      case 'evidenceAudit': output = { reviews: [{ requirementId: 'r0', supported: true, reason: 'Supported test fixture' }] }; break;
      case 'rubric': output = { criteria: [] }; break;
      case 'matcher':
        // Exercise the actual tool dispatch/repository path and record its result.
        options.toolkit.onToolCall({ tool: 'get_company_facts', args: { scope: 'references' }, result: await options.toolkit.execute('get_company_facts', { scope: 'references' }) });
        output = { matches: [{ requirementId: 'r0', status: matchStatus, confidence: 0.95, reason: 'Comparison', evidence: ['REF-01'] }] };
        break;
      case 'writer': output = calls.filter((c) => c.name === 'writer').length === 1
        ? { title: 'Solution', content: 'Experience ferroviaire REF-99', citations: ['REF-99'], needsHuman: false }
        : { title: 'Solution', content: "[A COMPLETER PAR L'HUMAIN] Ajouter une reference ferroviaire verifiee.", citations: [], needsHuman: true }; break;
      case 'compliance': output = { approved: true, reasons: [], instructions: '' }; break;
      default: throw new Error('Unexpected model operation: ' + options.name);
    }
    return options.schema.parse(output);
  });
});
afterEach(() => vi.restoreAllMocks());

async function run() {
  const graph = await buildGraph({ checkpointer: new MemorySaver(), analyses: { appendTrace: async () => {}, updateTrace: async () => {} } });
  const config = { configurable: { thread_id: 'test' }, recursionLimit: 25 };
  const state = await graph.invoke({ tenderId: 't', runId: 'r', ownerId: 'o' }, config);
  return { state, checkpoint: await graph.getState(config) };
}

describe('agent workflow', () => {
  it('recovers an omitted blocker in the independent page audit', async () => {
    omitFirstPass = true; matchStatus = 'unmet';
    const { state } = await run();
    expect(state.extractionAudit).toMatchObject({ auditedPages: 80, recoveredRequirements: 1 });
    expect(state.blockers[0].sourcePage).toBe(47);
    expect(state.verdict).toBe('no-go');
  });
  it('refuses GO if the audit skips even one readable page', async () => {
    incompleteAudit = true;
    const { state } = await run();
    expect(state.verdict).toBe('no-go');
    expect(state.errors.some((e) => e.message.includes('audit incomplet'))).toBe(true);
  });
  it('rejects fabricated evidence, loops back to Writer, and checkpoints the correction', async () => {
    const { state, checkpoint } = await run();
    expect(calls.find((c) => c.name === 'extractor').user).toContain('--- PAGE 80 ---');
    expect(state.nodeTrace.filter((e) => e.node === 'draft')).toHaveLength(2);
    expect(calls.filter((c) => c.name === 'writer')[1].user).toContain('REF-99');
    expect(state.toolCalls[0].tool).toBe('get_company_facts');
    expect(sections.at(-1)).toMatchObject({ needsHuman: true, content: expect.stringContaining('A COMPLETER') });
    expect(checkpoint.values.sections).toEqual(state.sections);
    expect(checkpoint.next).toEqual([]);
  });
  it('stops at a verified page-47 blocker before any drafting', async () => {
    matchStatus = 'unmet';
    const { state } = await run();
    expect(state.verdict).toBe('no-go');
    expect(state.blockers[0].sourcePage).toBe(47);
    expect(calls.some((c) => c.name === 'writer')).toBe(false);
  });
  it('finishes with visible errors and no GO when extraction fails', async () => {
    failExtraction = true;
    const { state } = await run();
    expect(state).toMatchObject({ verdict: 'no-go', needsHuman: true });
    expect(state.nodeTrace.find((e) => e.node === 'extractRequirements').status).toBe('error');
    expect(calls.some((c) => c.name === 'writer')).toBe(false);
  });
});
