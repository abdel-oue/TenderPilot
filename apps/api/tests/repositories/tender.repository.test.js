import { describe, expect, it } from 'vitest';
import TenderRepository from '../../src/repositories/tender.repository.js';

/**
 * Fake drizzle chain: every builder returns itself, the terminal call resolves.
 * The repository's job is to ask the right question, not to be Postgres.
 */
function fakeDb(rows = []) {
  const calls = { values: [], conflict: [], set: [], limit: [] };
  const chain = {
    calls,
    select(p) { calls.projection = p; return chain; },
    from() { return chain; },
    where(w) { calls.where = w; return chain; },
    orderBy() { return chain; },
    limit(n) { calls.limit.push(n); return Promise.resolve(rows); },
    insert() { return chain; },
    values(v) { calls.values.push(v); return chain; },
    onConflictDoUpdate(c) { calls.conflict.push(c); return chain; },
    update() { return chain; },
    set(v) { calls.set.push(v); return chain; },
    returning() { return Promise.resolve(rows); },
    then(resolve) { return Promise.resolve(rows).then(resolve); },
  };
  return chain;
}

describe('TenderRepository', () => {
  it('projects explicit columns rather than selecting the whole row', async () => {
    const db = fakeDb([]);
    await new TenderRepository(db).findAll();
    expect(db.calls.projection).toBeDefined();
    expect(Object.keys(db.calls.projection)).toContain('reference');
  });

  it('returns a single row, not an array, from findById', async () => {
    const db = fakeDb([{ id: 'a', reference: 'AO-2026-001' }]);
    const row = await new TenderRepository(db).findById('a');
    expect(row).toMatchObject({ reference: 'AO-2026-001' });
  });

  it('returns undefined when the reference does not exist', async () => {
    const row = await new TenderRepository(fakeDb([])).findByReference('AO-9999-999');
    expect(row).toBeUndefined();
  });

  it('upserts on the AO reference, which is what makes the seed idempotent', async () => {
    const db = fakeDb([{ id: 'a' }]);
    await new TenderRepository(db).upsert({ reference: 'AO-2026-001', title: 'x' });
    expect(db.calls.conflict[0].target).toBeDefined();
  });

  it('writes only the status on a status update', async () => {
    const db = fakeDb([]);
    await new TenderRepository(db).updateStatus('a', 'analyzing');
    expect(db.calls.set[0]).toEqual({ status: 'analyzing' });
  });
});
