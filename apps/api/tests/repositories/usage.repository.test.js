import { describe, expect, it, vi } from 'vitest';
import UsageRepository from '../../src/repositories/usage.repository.js';

/**
 * A fake drizzle chain. Every builder method returns `this` so a query can be
 * chained in any order, and the terminal call resolves to `rows`. It records
 * what it was asked for, which is the only thing worth asserting here: the
 * repository's job is to ask the right question, not to be Postgres.
 */
function fakeDb(rows = []) {
  const calls = { insert: [], values: [], groupBy: [], limit: [], where: [] };
  const chain = {
    calls,
    insert(table) { calls.insert.push(table); return chain; },
    values(v) { calls.values.push(v); return Promise.resolve(); },
    select(projection) { calls.projection = projection; return chain; },
    from() { return chain; },
    where(w) { calls.where.push(w); return chain; },
    groupBy(...g) { calls.groupBy.push(g); return chain; },
    orderBy() { return chain; },
    limit(n) { calls.limit.push(n); return Promise.resolve(rows); },
    then(resolve) { return Promise.resolve(rows).then(resolve); },
  };
  return chain;
}

describe('UsageRepository.record', () => {
  it('inserts the call exactly as given', async () => {
    const db = fakeDb();
    const entry = {
      requestId: 'req-1',
      tier: 'volume',
      model: 'gpt-4.1',
      operation: 'extractor',
      promptTokens: 120,
      completionTokens: 40,
      totalTokens: 160,
      latencyMs: 900,
      status: 'ok',
    };
    await new UsageRepository(db).record(entry);
    expect(db.calls.values[0]).toEqual(entry);
  });
});

describe('UsageRepository.summarizeByRequest', () => {
  it('groups by requestId so one HTTP request is one row', async () => {
    const db = fakeDb([{ requestId: 'req-1', totalTokens: 160 }]);
    const rows = await new UsageRepository(db).summarizeByRequest();
    expect(rows).toHaveLength(1);
    // grouped by request AND run: a background graph run is still attributable.
    expect(db.calls.groupBy[0]).toHaveLength(2);
  });

  it('applies the requested limit', async () => {
    const db = fakeDb([]);
    await new UsageRepository(db).summarizeByRequest({ limit: 7 });
    expect(db.calls.limit).toContain(7);
  });

  it('defaults to a bounded page rather than the whole table', async () => {
    const db = fakeDb([]);
    await new UsageRepository(db).summarizeByRequest();
    expect(db.calls.limit[0]).toBe(50);
  });
});

describe('UsageRepository.summarizeByModel', () => {
  it('groups by tier and model, which is what shows misrouted spend', async () => {
    const db = fakeDb([]);
    await new UsageRepository(db).summarizeByModel();
    expect(db.calls.groupBy[0]).toHaveLength(2);
  });

  it('passes no where clause when no window is given', async () => {
    const db = fakeDb([]);
    await new UsageRepository(db).summarizeByModel();
    expect(db.calls.where[0]).toBeUndefined();
  });

  it('filters by the window when one is given', async () => {
    const db = fakeDb([]);
    await new UsageRepository(db).summarizeByModel({ since: new Date('2026-09-17') });
    expect(db.calls.where[0]).toBeDefined();
  });
});
