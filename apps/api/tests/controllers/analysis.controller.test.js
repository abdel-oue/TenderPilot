import { describe, expect, it, vi } from 'vitest';
import AnalysisController from '../../src/controllers/analysis.controller.js';

const UUID = '4e3d9250-2caf-47da-afe6-32b1af32c4db';

/** Minimal fastify reply double: records the status and the payload. */
function fakeReply() {
  const reply = {
    statusCode: 200,
    payload: undefined,
    code(status) { reply.statusCode = status; return reply; },
    send(payload) { reply.payload = payload; return reply; },
  };
  return reply;
}

describe('AnalysisController.start', () => {
  it('answers 202, because the graph never runs inside the request', async () => {
    const service = { start: vi.fn(async () => ({ runId: 'r1', status: 'queued' })) };
    const reply = fakeReply();

    await new AnalysisController(service).start({ params: { id: UUID } }, reply);

    expect(reply.statusCode).toBe(202);
    expect(service.start).toHaveBeenCalledWith(UUID);
  });

  it('rejects a malformed id before reaching the service', async () => {
    const service = { start: vi.fn() };
    await expect(
      new AnalysisController(service).start({ params: { id: 'not-a-uuid' } }, fakeReply()),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED', status: 400 });

    expect(service.start).not.toHaveBeenCalled();
  });

  it('lets a service error through with its own status code', async () => {
    const service = {
      start: vi.fn(async () => { throw Object.assign(new Error('nope'), { code: 'TENDER_NOT_FOUND', status: 404 }); }),
    };
    await expect(
      new AnalysisController(service).start({ params: { id: UUID } }, fakeReply()),
    ).rejects.toMatchObject({ code: 'TENDER_NOT_FOUND' });
  });
});

describe('AnalysisController.get', () => {
  it('returns the run with its trace', async () => {
    const analysis = { runId: 'r1', status: 'running', nodeTrace: [{ node: 'ingest' }] };
    const reply = fakeReply();

    await new AnalysisController({ getByTender: async () => analysis }).get(
      { params: { id: UUID } },
      reply,
    );

    expect(reply.statusCode).toBe(200);
    expect(reply.payload.nodeTrace).toHaveLength(1);
  });
});

describe('AnalysisController.saveSection', () => {
  it('passes a validated correction to the service', async () => {
    const service = { saveSectionEdit: vi.fn(async () => ({ id: 's1' })) };
    const body = { sectionKey: 'team', title: 'Moyens humains', content: 'Texte corrige.' };

    await new AnalysisController(service).saveSection(
      { params: { runId: UUID }, body },
      fakeReply(),
    );

    expect(service.saveSectionEdit).toHaveBeenCalledWith(UUID, body);
  });

  it('rejects an empty correction rather than storing a blank section', async () => {
    const service = { saveSectionEdit: vi.fn() };
    await expect(
      new AnalysisController(service).saveSection(
        { params: { runId: UUID }, body: { sectionKey: 'team', title: 'T', content: '' } },
        fakeReply(),
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });

    expect(service.saveSectionEdit).not.toHaveBeenCalled();
  });

  it('rejects a body with no sectionKey', async () => {
    await expect(
      new AnalysisController({}).saveSection(
        { params: { runId: UUID }, body: { title: 'T', content: 'c' } },
        fakeReply(),
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });
});
