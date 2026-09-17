import { describe, expect, it, vi } from 'vitest';
import TavilyService from '../../src/services/tavily.service.js';

const ok = (payload) => ({ ok: true, status: 200, json: async () => payload });

describe('TavilyService.isEnabled', () => {
  it('is disabled without a key, so the tool is never offered', () => {
    expect(new TavilyService({ apiKey: undefined }).isEnabled).toBe(false);
  });

  it('is enabled with a key', () => {
    expect(new TavilyService({ apiKey: 'tvly-x' }).isEnabled).toBe(true);
  });

  it('returns a degraded empty result instead of throwing when disabled', async () => {
    const service = new TavilyService({ apiKey: undefined });
    await expect(service.search('marches publics maroc')).resolves.toEqual({
      results: [],
      answer: null,
      degraded: true,
    });
  });
});

describe('TavilyService.search', () => {
  it('maps the provider payload to a stable shape', async () => {
    const fetchImpl = vi.fn(async () =>
      ok({
        answer: 'Trois marches similaires.',
        results: [{ title: 'AO 2025', url: 'https://x.ma/a', content: 'texte', score: 0.8 }],
      }),
    );
    const service = new TavilyService({ apiKey: 'tvly-x', fetchImpl });
    const result = await service.search('marches attribues');

    expect(result.degraded).toBe(false);
    expect(result.answer).toBe('Trois marches similaires.');
    expect(result.results[0]).toEqual({
      title: 'AO 2025', url: 'https://x.ma/a', content: 'texte', score: 0.8,
    });
  });

  it('degrades rather than throwing when the provider errors', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 429, json: async () => ({}) }));
    const service = new TavilyService({ apiKey: 'tvly-x', fetchImpl });
    await expect(service.search('q')).resolves.toMatchObject({ degraded: true, results: [] });
  });

  it('degrades rather than throwing when the network is unreachable', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('ENOTFOUND'); });
    const service = new TavilyService({ apiKey: 'tvly-x', fetchImpl });
    await expect(service.search('q')).resolves.toMatchObject({ degraded: true });
  });

  it('asks the same question only once', async () => {
    const fetchImpl = vi.fn(async () => ok({ results: [], answer: null }));
    const service = new TavilyService({ apiKey: 'tvly-x', fetchImpl });

    await service.search('meme question');
    await service.search('meme question');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not cache a degraded result, so a blip is retried later', async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      return calls === 1 ? { ok: false, status: 500, json: async () => ({}) } : ok({ results: [] });
    });
    const service = new TavilyService({ apiKey: 'tvly-x', fetchImpl });

    await service.search('q');
    const second = await service.search('q');
    expect(second.degraded).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('sends the key as a bearer token and bounds the call with a timeout', async () => {
    const fetchImpl = vi.fn(async () => ok({ results: [] }));
    await new TavilyService({ apiKey: 'tvly-secret', fetchImpl }).search('q');

    const [, init] = fetchImpl.mock.calls[0];
    expect(init.headers.authorization).toBe('Bearer tvly-secret');
    expect(init.signal).toBeDefined();
  });
});
