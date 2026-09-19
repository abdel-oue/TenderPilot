import { describe, expect, it, vi } from 'vitest';
import AnalysisService from '../../src/services/analysis.service.js';

function setup(state = {}) {
  const analyses = {
    findRunById: vi.fn(async () => ({ id: 'run', tenderId: 'tender' })),
    findSections: vi.fn(async () => [{ sectionKey: 'technical', needsHuman: true, complianceWarnings: ['Missing evidence'] }]),
    upsertSection: vi.fn(async (row) => row),
    updateRun: vi.fn(), saveResult: vi.fn(), setPendingQuestion: vi.fn(),
  };
  const graph = { invoke: vi.fn(async () => state), getState: vi.fn(async () => ({ next: [] })) };
  const service = new AnalysisService({ analyses, tenders: { findById: async () => ({ id: 'tender' }), updateStatus: vi.fn() }, queue: {}, graphFactory: async () => graph });
  return { service, analyses, graph };
}

describe('analysis persistence and recovery', () => {
  it('sends persisted human decisions into the checkpoint resume command', async () => {
    const { service, graph, analyses } = setup({ verdict: 'no-go' });
    const decision = { status: 'human', verdictOverride: 'no-go', dismissedBlockers: ['r1'], instruction: 'Suspendre le dossier.' };
    analyses.findRunById.mockResolvedValue({ id: 'run', tenderId: 'tender', nodeTrace: [decision] });
    await service.execute('run', 'tender', 'owner', { choice: 'stop' });
    expect(graph.invoke.mock.calls[0][0].update).toEqual({ humanDecisions: [decision] });
  });
  it('stores stage errors and flags late compliance failures', async () => {
    const errors = [{ node: 'compliance', message: 'Reviewer timeout' }];
    const { service, analyses } = setup({ verdict: 'go', errors, sections: [{ needsHuman: true }] });
    await service.execute('run', 'tender', 'owner');
    expect(analyses.saveResult).toHaveBeenCalledWith('run', expect.objectContaining({ stageErrors: errors, needsHuman: true }));
  });
  it('resumes pending checkpoint work without reinjecting the graph input', async () => {
    const { service, graph } = setup({ verdict: 'no-go' });
    graph.getState.mockResolvedValue({ next: ['matchProfile'] });
    await service.execute('run', 'tender', 'owner');
    expect(graph.invoke).toHaveBeenCalledWith(null, expect.objectContaining({ configurable: expect.objectContaining({ thread_id: expect.stringContaining('run') }) }));
  });
  it('does not clear objections on an ordinary save', async () => {
    const { service, analyses } = setup();
    await service.saveSectionEdit('run', { sectionKey: 'technical', title: 'Title', content: 'Edited' }, 'owner');
    expect(analyses.upsertSection).toHaveBeenCalledWith(expect.objectContaining({ needsHuman: true, complianceWarnings: ['Missing evidence'], validatedByHuman: false }));
  });
  it('persists a completed checkpoint on retry without re-running the model', async () => {
    const { service, graph, analyses } = setup();
    graph.getState.mockResolvedValue({ next: [], values: { runId: 'run', verdict: 'no-go', needsHuman: true } });
    await service.execute('run', 'tender', 'owner');
    expect(graph.invoke).not.toHaveBeenCalled();
    expect(analyses.saveResult).toHaveBeenCalledWith('run', expect.objectContaining({ verdict: 'no-go', needsHuman: true }));
  });
  it('records explicit human validation independently of editing', async () => {
    const { service, analyses } = setup();
    await service.saveSectionEdit('run', { sectionKey: 'technical', title: 'Title', content: 'Unchanged', validatedByHuman: true }, 'owner');
    expect(analyses.upsertSection).toHaveBeenCalledWith(expect.objectContaining({ needsHuman: false, complianceWarnings: [], validatedByHuman: true }));
  });
});
