import { afterEach, describe, expect, it, vi } from 'vitest';
import ComplianceAgent from '../../src/agents/compliance.agent.js';
import WriterAgent from '../../src/agents/writer.agent.js';
import AnalysisRepository from '../../src/repositories/analysis.repository.js';
import { reviewSections } from '../../src/graph/nodes/compliance.node.js';
import { draft } from '../../src/graph/nodes/draft.node.js';
import { decide } from '../../src/graph/nodes/decide.node.js';
import { traced } from '../../src/graph/index.js';
import { renderComplianceTask, renderWriterTask } from '../../src/prompts/writer.prompts.js';

afterEach(() => vi.restoreAllMocks());
const requirement = { id: 'r47', category: 'technical', nature: 'capacite', obligation: 'eliminatoire', text: 'Trois references ferroviaires', sourcePage: 47, quoteVerified: true };
const section = { key: 'technical', title: 'Solution', content: 'Une affirmation sans preuve.', citations: [], toolCalls: [] };

describe('jury failure regressions', () => {
  it('does not issue GO when nothing was extracted', async () => {
    expect(await decide({ requirements: [], matches: [], errors: [{ node: 'ingest', message: 'PDF illisible' }] }))
      .toMatchObject({ verdict: 'no-go', confidence: 0, needsHuman: true });
  });

  it('blocks two references where three are eliminatory', async () => {
    const result = await decide({ requirements: [requirement], matches: [{ requirementId: 'r47', status: 'partial', confidence: 0.95, reason: 'Deux sur trois' }], score: 50 });
    expect(result.verdict).toBe('no-go');
    expect(result.blockers[0]).toMatchObject({ sourcePage: 47, status: 'partial' });
  });

  it.each(['unread', 'stage failure', 'unverified quote', 'missing match'])('does not issue GO with %s', async (failure) => {
    const result = await decide({
      requirements: [{ ...requirement, quoteVerified: failure !== 'unverified quote' }],
      matches: failure === 'missing match' ? [] : [{ requirementId: 'r47', status: 'met', confidence: 1 }],
      pages: failure === 'unread' ? [{ documentId: 'd1', page: 47, extraction: 'unread' }] : [],
      errors: failure === 'stage failure' ? [{ node: 'extractRequirements', message: 'Timeout document 2' }] : [],
    });
    expect(result).toMatchObject({ verdict: 'no-go', needsHuman: true });
  });

  it('rejects a reference invented in both prose and citations', () => {
    expect(ComplianceAgent.checkCitations({ ...section, content: 'REF-999', citations: ['REF-999'] }).approved).toBe(false);
  });

  it('does not launder a citation through the dossier or the run history', () => {
    const toolCalls = [
      { tool: 'search_documents', args: { corpus: 'dossier' }, result: { excerpt: 'REF-99' } },
      { tool: 'get_run_state', result: { content: 'REF-99' } },
    ];
    expect(ComplianceAgent.checkCitations({ ...section, content: 'REF-99', citations: ['REF-99'], toolCalls }).approved).toBe(false);
  });

  it('provides requirements and actual facts to the reviewer', () => {
    const prompt = renderComplianceTask(section, { requirements: [requirement], evidence: [{ references: [{ client: 'ONCF', montant: 125000 }] }] });
    expect(prompt).toContain('Trois references ferroviaires');
    expect(prompt).toContain('125000');
    expect(prompt).toContain('ONCF');
  });

  it('persists a reviewer outage as a warning rather than approving it', async () => {
    vi.spyOn(ComplianceAgent.prototype, 'review').mockRejectedValue(new Error('Reviewer unavailable'));
    const save = vi.spyOn(AnalysisRepository.prototype, 'upsertSection').mockResolvedValue({});
    const result = await reviewSections({ runId: 'run1', sections: [{ ...section }], requirements: [requirement] });
    expect(result.sections[0]).toMatchObject({ needsHuman: true, complianceWarnings: [expect.stringContaining('Reviewer unavailable')] });
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ needsHuman: true, complianceWarnings: [expect.any(String)] }));
    expect(result.errors).toHaveLength(1);
  });

  it('retains unresolved objections after the revision budget is spent', async () => {
    vi.spyOn(ComplianceAgent.prototype, 'review').mockResolvedValue({ approved: false, reasons: ['Reference absente'], instructions: 'Corriger' });
    const save = vi.spyOn(AnalysisRepository.prototype, 'upsertSection').mockResolvedValue({});
    await reviewSections({ runId: 'run1', sections: [{ ...section }], redraftCount: { technical: 2 } });
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ complianceWarnings: ['Reference absente'], needsHuman: true }));
  });

  it('does not label a returned node error as a successful step', async () => {
    const patch = await traced('ingest', async () => ({ pages: [], errors: [{ node: 'ingest', message: 'Unreadable document' }] }), {})({});
    expect(patch.nodeTrace[0]).toMatchObject({ status: 'error', summary: expect.stringContaining('Unreadable document') });
  });

  it('reuses the complete human edit and preserves its text on a new run', async () => {
    const content = 'Introduction. '.repeat(60) + 'NE PAS CITER REF-99.';
    const human = { sectionKey: 'technical', title: 'Correction', content, runId: 'old', validatedByHuman: true };
    vi.spyOn(AnalysisRepository.prototype, 'findHumanEditsForTender').mockResolvedValue([human]);
    const writer = vi.spyOn(WriterAgent.prototype, 'draft');
    const result = await draft({ tenderId: 't1', runId: 'new', requirements: [requirement] });
    expect(result.sections[0]).toMatchObject({ content, editedByHuman: true, needsHuman: true, validatedByHuman: false });
    expect(writer).not.toHaveBeenCalled();
    expect(renderWriterTask({ title: 'Team', requirements: [], humanEdits: [human] })).toContain(content);
  });

  it('redrafts only the rejected section, retaining previously accepted text', async () => {
    const accepted = { ...section, key: 'team', content: 'Already checked' };
    const writer = vi.spyOn(WriterAgent.prototype, 'draft').mockResolvedValue({ ...section, toolCalls: [], needsHuman: false });
    const result = await draft({ requirements: [requirement, { ...requirement, category: 'team' }], sections: [accepted], rejected: [{ key: 'technical' }], redraftInstructions: { technical: 'Remove invention' } });
    expect(writer).toHaveBeenCalledTimes(1);
    expect(result.sections).toContain(accepted);
    expect(writer.mock.calls[0][0].instructions).toBe('Remove invention');
  });
});
