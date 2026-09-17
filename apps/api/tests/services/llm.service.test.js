import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import LlmService, { TIERS } from '../../src/services/llm.service.js';

const schema = z.object({ answer: z.string() });

/** A fake provider that returns each queued payload in turn. */
function fakeProvider(payloads, model = 'fake-model') {
  const calls = [];
  return {
    model,
    calls,
    async chatJson(options) {
      calls.push(options);
      const next = payloads.shift();
      if (next instanceof Error) throw next;
      return {
        content: next,
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        latencyMs: 42,
        model,
      };
    },
    async embed(inputs) {
      calls.push({ embed: inputs });
      return {
        vectors: inputs.map(() => [0.1, 0.2]),
        usage: { promptTokens: 3, completionTokens: 0, totalTokens: 3 },
        latencyMs: 7,
        model,
      };
    },
  };
}

function fakeUsage() {
  return {
    rows: [],
    async record(entry) {
      this.rows.push(entry);
    },
  };
}

function build(provider, tier = TIERS.VOLUME) {
  const usage = fakeUsage();
  const service = new LlmService({
    stub: false,
    usageRepository: usage,
    reasoning: tier === TIERS.REASONING ? provider : fakeProvider([]),
    volume: tier === TIERS.VOLUME ? provider : fakeProvider([]),
  });
  return { service, usage };
}

describe('LlmService.complete', () => {
  it('returns the parsed value on a valid response', async () => {
    const { service } = build(fakeProvider(['{"answer":"oui"}']));
    const result = await service.complete({ name: 'test', system: 's', user: 'u', schema });
    expect(result).toEqual({ answer: 'oui' });
  });

  it('retries once with the zod issues fed back, then succeeds', async () => {
    const provider = fakeProvider(['{"answer":123}', '{"answer":"oui"}']);
    const { service } = build(provider);
    const result = await service.complete({ name: 'test', system: 's', user: 'u', schema });

    expect(result).toEqual({ answer: 'oui' });
    expect(provider.calls).toHaveLength(2);
    // The repair prompt must actually carry the failure, or the retry is a coin flip.
    expect(provider.calls[1].messages.at(-1).content).toContain('answer');
  });

  it('fails loud after the single repair attempt rather than retrying forever', async () => {
    const provider = fakeProvider(['{"answer":1}', '{"answer":2}', '{"answer":"never"}']);
    const { service } = build(provider);

    await expect(
      service.complete({ name: 'test', system: 's', user: 'u', schema }),
    ).rejects.toMatchObject({ code: 'SCHEMA_VALIDATION_FAILED' });
    expect(provider.calls).toHaveLength(2);
  });

  it('never returns unparsed output when the payload is not JSON at all', async () => {
    const { service } = build(fakeProvider(['not json', 'still not json']));
    await expect(
      service.complete({ name: 'test', system: 's', user: 'u', schema }),
    ).rejects.toMatchObject({ code: 'SCHEMA_VALIDATION_FAILED' });
  });
});

describe('LlmService model routing', () => {
  it('routes to the volume tier by default, so the expensive model is opt-in', async () => {
    const volume = fakeProvider(['{"answer":"cheap"}'], 'gpt-4.1');
    const reasoning = fakeProvider(['{"answer":"expensive"}'], 'gpt-5.5');
    const service = new LlmService({ stub: false, usageRepository: fakeUsage(), reasoning, volume });

    await service.complete({ name: 'test', system: 's', user: 'u', schema });
    expect(volume.calls).toHaveLength(1);
    expect(reasoning.calls).toHaveLength(0);
  });

  it('routes to the reasoning tier only when explicitly asked', async () => {
    const volume = fakeProvider(['{"answer":"cheap"}'], 'gpt-4.1');
    const reasoning = fakeProvider(['{"answer":"expensive"}'], 'gpt-5.5');
    const service = new LlmService({ stub: false, usageRepository: fakeUsage(), reasoning, volume });

    await service.complete({ name: 't', system: 's', user: 'u', schema, tier: TIERS.REASONING });
    expect(reasoning.calls).toHaveLength(1);
    expect(volume.calls).toHaveLength(0);
  });

  it('rejects an unknown tier instead of silently picking one', async () => {
    const { service } = build(fakeProvider([]));
    await expect(
      service.complete({ name: 't', system: 's', user: 'u', schema, tier: 'premium' }),
    ).rejects.toMatchObject({ code: 'UNKNOWN_TIER' });
  });
});

describe('LlmService usage accounting', () => {
  it('records one row per provider call, including the retry', async () => {
    const { service, usage } = build(fakeProvider(['{"answer":1}', '{"answer":"ok"}']));
    await service.complete({ name: 'extractor', system: 's', user: 'u', schema });

    expect(usage.rows).toHaveLength(2);
    expect(usage.rows[0]).toMatchObject({
      operation: 'extractor',
      tier: TIERS.VOLUME,
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
      status: 'ok',
    });
  });

  it('records a failed provider call, so errors show up in the dashboard', async () => {
    const { service, usage } = build(fakeProvider([new Error('429 rate limited')]));
    await expect(
      service.complete({ name: 'extractor', system: 's', user: 'u', schema }),
    ).rejects.toMatchObject({ code: 'LLM_REQUEST_FAILED' });

    expect(usage.rows).toHaveLength(1);
    expect(usage.rows[0]).toMatchObject({ status: 'error' });
    expect(usage.rows[0].error).toContain('429');
  });

  it('does not fail the request when the usage row cannot be written', async () => {
    const broken = {
      async record() {
        throw new Error('db down');
      },
    };
    const service = new LlmService({
      stub: false,
      usageRepository: broken,
      volume: fakeProvider(['{"answer":"oui"}']),
      reasoning: fakeProvider([]),
    });

    await expect(
      service.complete({ name: 'test', system: 's', user: 'u', schema }),
    ).resolves.toEqual({ answer: 'oui' });
  });

  it('attributes every call to the request that caused it', async () => {
    const { service, usage } = build(fakeProvider(['{"answer":"oui"}']));
    const { runWithContext } = await import('../../src/lib/requestContext.js');

    await runWithContext({ requestId: 'req-abc' }, () =>
      service.complete({ name: 'test', system: 's', user: 'u', schema }),
    );
    expect(usage.rows[0].requestId).toBe('req-abc');
  });
});

describe('LlmService stub mode', () => {
  it('returns the stub without calling any provider', async () => {
    const volume = fakeProvider([]);
    const service = new LlmService({ stub: true, usageRepository: fakeUsage(), volume });
    const result = await service.complete({
      name: 'test',
      system: 's',
      user: 'u',
      schema,
      stub: { answer: 'stubbed' },
    });

    expect(result).toEqual({ answer: 'stubbed' });
    expect(volume.calls).toHaveLength(0);
  });

  it('rejects a stub that does not satisfy its own schema', async () => {
    const service = new LlmService({ stub: true, usageRepository: fakeUsage() });
    await expect(
      service.complete({ name: 'test', system: 's', user: 'u', schema, stub: { wrong: 1 } }),
    ).rejects.toMatchObject({ code: 'INVALID_STUB' });
  });

  it('refuses to silently pass when an agent forgot its stub', async () => {
    const service = new LlmService({ stub: true, usageRepository: fakeUsage() });
    await expect(
      service.complete({ name: 'test', system: 's', user: 'u', schema }),
    ).rejects.toMatchObject({ code: 'MISSING_STUB' });
  });

  it('produces correctly sized embedding vectors offline', async () => {
    const service = new LlmService({ stub: true, usageRepository: fakeUsage() });
    const [vector] = await service.embed(['bonjour']);
    expect(vector).toHaveLength(512);
  });
});
