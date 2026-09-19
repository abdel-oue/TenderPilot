import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';

const subscribe = vi.hoisted(() => vi.fn());
vi.mock('../../src/lib/runEvents.js', () => ({ subscribeRunEvents: subscribe, publishRunEvent: vi.fn() }));
import AnalysisController from '../../src/controllers/analysis.controller.js';

describe('analysis SSE transport', () => {
  it('keeps CORS headers and streams until the RESPONSE closes', async () => {
    const unsubscribe = vi.fn();
    let publish;
    subscribe.mockImplementation(async (_runId, send) => { publish = send; return unsubscribe; });
    const raw = Object.assign(new EventEmitter(), { writeHead: vi.fn(), write: vi.fn(), writableEnded: false });
    const request = { params: { id: '4e3d9250-2caf-47da-afe6-32b1af32c4db' }, user: { id: 'owner' }, raw: new EventEmitter() };
    const reply = { raw, hijack: vi.fn(), getHeaders: () => ({ 'access-control-allow-origin': 'http://localhost:4100', 'access-control-allow-credentials': 'true' }) };
    try {
      await new AnalysisController({ getByTender: async () => ({ runId: 'run1', status: 'running' }) }).stream(request, reply);
      expect(reply.hijack).toHaveBeenCalled();
      expect(raw.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({ 'access-control-allow-origin': 'http://localhost:4100', 'x-accel-buffering': 'no' }));
      request.raw.emit('close');
      expect(unsubscribe).not.toHaveBeenCalled();
      publish({ type: 'tool', name: 'ocr' });
      expect(raw.write).toHaveBeenLastCalledWith('data: {"type":"tool","name":"ocr"}\n\n');
    } finally { raw.emit('close'); }
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
