import { describe, expect, it, vi } from 'vitest';
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
      // A queued object is a tool-calling turn; a queued string is content.
      const toolCalls = typeof next === 'object' && next !== null ? next.toolCalls : [];
      const content = typeof next === 'string' ? next : (next?.content ?? '');
      return {
        content,
        toolCalls: toolCalls ?? [],
        message: { role: 'assistant', content, tool_calls: toolCalls },
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

/** One tool-calling turn, in the shape a provider returns it. */
function toolTurn(id, name, args) {
  return { toolCalls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(args) } }] };
}

describe('LlmService tool loop', () => {
  it('executes the tool the model asked for and feeds the result back', async () => {
    const provider = fakeProvider([
      toolTurn('c1', 'get_company_facts', { scope: 'profil' }),
      '{"answer":"oui"}',
    ]);
    const { service } = build(provider);
    const execute = vi.fn(async () => ({ profil: { ca2024: 12 } }));

    const result = await service.complete({
      name: 'writer',
      system: 's',
      user: 'u',
      schema,
      toolkit: { definitions: [{ type: 'function' }], execute },
    });

    expect(execute).toHaveBeenCalledWith('get_company_facts', { scope: 'profil' });
    expect(result).toEqual({ answer: 'oui' });

    // The tool result really reached the model, as a tool message tied to the
    // call id - a provider rejects anything else.
    const last = provider.calls.at(-1).messages;
    const toolMessage = last.find((m) => m.role === 'tool');
    expect(toolMessage.tool_call_id).toBe('c1');
    expect(toolMessage.content).toContain('12');
  });

  it('offers the tools instead of forcing a JSON response format', async () => {
    // Asking for json_object while offering tools lets the provider satisfy the
    // format instead of calling the tool, which silently disables the belt. The
    // zod schema is the real contract either way.
    const provider = fakeProvider([toolTurn('c1', 't', {}), '{"answer":"oui"}']);
    const { service } = build(provider);

    await service.complete({
      name: 'writer',
      system: 's',
      user: 'u',
      schema,
      toolkit: { definitions: [{ type: 'function' }], execute: async () => ({}) },
    });

    expect(provider.calls[0].tools).toHaveLength(1);
  });

  it('takes the answer from the turn that ended the loop, rather than asking again', async () => {
    // The model stops calling tools because it is ready to answer, and the
    // system prompt already asks for JSON. Spending another reasoning-tier call
    // to re-ask the same question is pure latency and cost, once per section.
    const provider = fakeProvider([toolTurn('c1', 't', {}), '{"answer":"oui"}']);
    const { service } = build(provider);

    const result = await service.complete({
      name: 'writer', system: 's', user: 'u', schema,
      toolkit: { definitions: [{}], execute: async () => ({}) },
    });

    expect(result).toEqual({ answer: 'oui' });
    expect(provider.calls).toHaveLength(2);
  });

  it('falls back to a proper schema turn when the loop ends on prose', async () => {
    const provider = fakeProvider(['Je vais maintenant rediger.', '{"answer":"oui"}']);
    const { service } = build(provider);

    const result = await service.complete({
      name: 'writer', system: 's', user: 'u', schema,
      toolkit: { definitions: [{}], execute: async () => ({}) },
    });

    expect(result).toEqual({ answer: 'oui' });
    expect(provider.calls).toHaveLength(2);
    // The recovery turn asks for the shape, so it carries the format constraint.
    expect(provider.calls.at(-1).tools).toBeUndefined();
  });

  it('keeps calling tools across several rounds', async () => {
    const provider = fakeProvider([
      toolTurn('c1', 'search_documents', { query: 'a' }),
      toolTurn('c2', 'search_documents', { query: 'b' }),
      '{"answer":"oui"}',
    ]);
    const { service } = build(provider);
    const execute = vi.fn(async () => ({ extracts: [] }));

    await service.complete({
      name: 'writer', system: 's', user: 'u', schema,
      toolkit: { definitions: [{}], execute },
    });

    expect(execute.mock.calls.map((c) => c[1].query)).toEqual(['a', 'b']);
  });

  it('bounds the loop, so a model that never stops calling tools cannot hang a worker', async () => {
    // A model that keeps calling tools forever must not pin a BullMQ worker.
    const payloads = Array.from({ length: 20 }, (_, i) => toolTurn('c' + i, 't', {}));
    payloads.push('{"answer":"oui"}');
    const provider = fakeProvider(payloads);
    const { service } = build(provider);
    const execute = vi.fn(async () => ({}));

    // The model never answers, so the call fails loud after its budget - it does
    // not keep going, and it does not quietly return a default.
    await expect(
      service.complete({
        name: 'writer', system: 's', user: 'u', schema,
        toolkit: { definitions: [{}], execute, maxRounds: 3 },
      }),
    ).rejects.toMatchObject({ code: 'SCHEMA_VALIDATION_FAILED' });

    expect(execute).toHaveBeenCalledTimes(3);
    // 3 tool rounds + 2 schema attempts. Not 21.
    expect(provider.calls).toHaveLength(5);
  });

  it('reports every tool call to the caller, so the trace can show them', async () => {
    const provider = fakeProvider([toolTurn('c1', 'calculate', { expression: '1+1' }), '{"answer":"oui"}']);
    const { service } = build(provider);
    const seen = [];

    await service.complete({
      name: 'writer', system: 's', user: 'u', schema,
      toolkit: { definitions: [{}], execute: async () => ({ value: 2 }), onToolCall: (c) => seen.push(c) },
    });

    expect(seen).toEqual([{ tool: 'calculate', args: { expression: '1+1' }, result: { value: 2 } }]);
  });

  it('answers anyway when the tool phase fails outright', async () => {
    // Evidence gathering is best-effort: losing it costs the answer its
    // citations, which the Writer already handles by flagging the section.
    const provider = fakeProvider([new Error('provider down'), '{"answer":"oui"}']);
    const { service } = build(provider);

    const result = await service.complete({
      name: 'writer', system: 's', user: 'u', schema,
      toolkit: { definitions: [{}], execute: async () => ({}) },
    });

    expect(result).toEqual({ answer: 'oui' });
  });

  it('records the tool rounds as their own usage rows', async () => {
    const provider = fakeProvider([toolTurn('c1', 't', {}), '{"answer":"oui"}']);
    const { service, usage } = build(provider);

    await service.complete({
      name: 'writer', system: 's', user: 'u', schema,
      toolkit: { definitions: [{}], execute: async () => ({}) },
    });

    // Both rounds are attributed, so the cost of the tool belt is visible in the
    // dashboard rather than hidden inside the agent's single line item.
    expect(usage.rows.map((r) => r.operation)).toEqual(['writer:tools', 'writer:tools']);
  });

  it('survives a model that sends malformed tool arguments', async () => {
    const provider = fakeProvider([
      { toolCalls: [{ id: 'c1', function: { name: 't', arguments: 'not json' } }] },
      '{"answer":"oui"}',
    ]);
    const { service } = build(provider);
    const execute = vi.fn(async () => ({}));

    await service.complete({
      name: 'writer', system: 's', user: 'u', schema,
      toolkit: { definitions: [{}], execute },
    });

    expect(execute).toHaveBeenCalledWith('t', {});
  });
});

describe('LlmService stub mode with a tool belt', () => {
  const stubbed = () => new LlmService({ stub: true, usageRepository: fakeUsage() });

  it('still fires the declared probe, so the belt cannot rot untested', async () => {
    // Offline, the tool still runs against the real repositories - owner
    // scoping, pgvector, the trace. A stub that skipped the tools is exactly how
    // the previous belt rotted into dead code without a single test failing.
    const execute = vi.fn(async () => ({ extracts: [] }));

    const result = await stubbed().complete({
      name: 'writer', system: 's', user: 'u', schema,
      stub: { answer: 'oui' },
      toolkit: {
        definitions: [{ type: 'function' }],
        execute,
        stubCall: () => ({ tool: 'search_documents', args: { query: 'q', corpus: 'entreprise' } }),
      },
    });

    expect(execute).toHaveBeenCalledWith('search_documents', { query: 'q', corpus: 'entreprise' });
    expect(result).toEqual({ answer: 'oui' });
  });

  it('reports the stubbed tool call, so the trace looks the same offline', async () => {
    const seen = [];
    await stubbed().complete({
      name: 'writer', system: 's', user: 'u', schema,
      stub: { answer: 'oui' },
      toolkit: {
        definitions: [{}],
        execute: async () => ({ ok: true }),
        onToolCall: (c) => seen.push(c.tool),
        stubCall: () => ({ tool: 'get_company_facts', args: { scope: 'profil' } }),
      },
    });

    expect(seen).toEqual(['get_company_facts']);
  });

  it('skips the probe when the agent declared no tools', async () => {
    const execute = vi.fn();
    await stubbed().complete({
      name: 'extractor', system: 's', user: 'u', schema,
      stub: { answer: 'oui' },
      toolkit: { definitions: [], execute, stubCall: () => ({ tool: 't', args: {} }) },
    });
    expect(execute).not.toHaveBeenCalled();
  });
});
