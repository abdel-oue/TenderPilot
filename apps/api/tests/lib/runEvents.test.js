import { describe, expect, it } from 'vitest';
import { publishRunEvent } from '../../src/lib/runEvents.js';
import { runEventSchema } from '@tenderpilot/shared';

// The suite's REDIS_URL points at a dead port (tests/setup.js), which is exactly
// the condition worth asserting: this is called from inside the tool dispatch on
// every tool call, so it must fail instantly and silently rather than hold up
// the agent. ioredis buffers commands issued while disconnected by default, and
// that default would hang every analysis the moment Redis went away.

describe('publishRunEvent', () => {
  it('does nothing at all without a run id', async () => {
    await expect(publishRunEvent(null, { type: 'status', status: 'running' })).resolves.toBeUndefined();
    await expect(publishRunEvent(undefined, { type: 'status', status: 'done' })).resolves.toBeUndefined();
  });

  it('resolves rather than throwing when Redis is unreachable', async () => {
    await expect(
      publishRunEvent('run-1', { type: 'status', status: 'running' }),
    ).resolves.toBeUndefined();
  });

  it('returns promptly instead of queueing against a dead connection', async () => {
    const startedAt = Date.now();
    await publishRunEvent('run-1', { type: 'status', status: 'running' });
    expect(Date.now() - startedAt).toBeLessThan(1000);
  });
});

describe('runEventSchema', () => {
  it('accepts each of the four frames the stream sends', () => {
    const frames = [
      { type: 'node', node: 'ingest', status: 'ok', summary: '7 pages lues', ms: 153, at: '2026-09-19T09:58:20.000Z' },
      { type: 'tool', node: 'matchProfile', name: 'search_documents', raison: 'je cherche une reference', outcome: '3 extraits', at: '2026-09-19T09:58:21.000Z' },
      {
        type: 'ask',
        question: {
          askId: 'a1',
          node: 'matchProfile',
          question: 'ISO 22301 ?',
          raison: null,
          options: [{ value: 'oui', label: 'Oui' }, { value: 'non', label: 'Non' }],
          askedAt: '2026-09-19T09:58:22.000Z',
        },
      },
      { type: 'status', status: 'awaiting_human' },
    ];

    for (const frame of frames) expect(runEventSchema.safeParse(frame).success).toBe(true);
  });

  it('rejects a malformed frame', () => {
    // A frame the web cannot render is worse than no frame: the feed would show
    // a blank row where a step should be.
    expect(runEventSchema.safeParse({ type: 'node' }).success).toBe(false);
    expect(runEventSchema.safeParse({ type: 'inconnu' }).success).toBe(false);
    expect(runEventSchema.safeParse({ type: 'status', status: 'en-cours' }).success).toBe(false);
    // A question with one option is a notification, not a question.
    expect(
      runEventSchema.safeParse({
        type: 'ask',
        question: {
          askId: 'a1',
          node: 'draft',
          question: 'x ?',
          raison: null,
          options: [{ value: 'oui', label: 'Oui' }],
          askedAt: '2026-09-19T09:58:22.000Z',
        },
      }).success,
    ).toBe(false);
  });
});
