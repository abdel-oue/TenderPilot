import { describe, expect, it } from 'vitest';
import DemoRepository from '../../src/repositories/demo.repository.js';
import {
  companyProfile,
  companyReferences,
  documents,
  teamMembers,
  tenders,
} from '../../src/db/schema/index.js';

/**
 * A fake drizzle transaction. `rows` maps a table to what a select from it
 * returns; every insert is recorded with the table it targeted, and each one
 * gets a fresh id back, which is the whole point of the test: the copy has to
 * point at the NEW ids, not the source's.
 */
function fakeDb(rows) {
  const inserts = [];
  const executed = [];
  let nextId = 0;

  const tx = {
    inserts,
    executed,
    select() { return tx; },
    from(table) { tx.table = table; return tx; },
    where() { return Promise.resolve(rows.get(tx.table) ?? []); },
    insert(table) { tx.target = table; return tx; },
    values(value) {
      const list = Array.isArray(value) ? value : [value];
      const written = list.map(() => ({ id: `new-${(nextId += 1)}` }));
      inserts.push({ table: tx.target, values: list });
      const result = Promise.resolve(written);
      result.returning = () => Promise.resolve(written);
      return result;
    },
    async execute(statement) { executed.push(statement); return { count: 3 }; },
  };

  return { tx, transaction: async (callback) => callback(tx) };
}

/** Everything a seeded owner holds, in miniature. */
function seededRows() {
  return new Map([
    [companyProfile, [{ ownerId: 'seed', raisonSociale: 'BTP SARL' }]],
    [companyReferences, [{ ownerId: 'seed', id: 'REF-01' }]],
    [teamMembers, [{ ownerId: 'seed', id: 'CV-01' }]],
    [
      tenders,
      [{ id: 'tender-seed', ownerId: 'seed', reference: 'AO-2026-004', status: 'analyzed', createdAt: new Date() }],
    ],
    [
      documents,
      [{ id: 'doc-seed', ownerId: 'seed', tenderId: 'tender-seed', kind: 'avis', createdAt: new Date() }],
    ],
  ]);
}

/** @returns {Promise<{ inserts: object[], executed: object[], tally: object }>} */
async function clone(rows = seededRows()) {
  const db = fakeDb(rows);
  const tally = await new DemoRepository(db).cloneWorkspace('seed', 'visitor');
  return { inserts: db.tx.inserts, executed: db.tx.executed, tally };
}

/** @param {object[]} inserts @param {object} table @returns {object[]} */
function written(inserts, table) {
  return inserts.filter((row) => row.table === table).flatMap((row) => row.values);
}

describe('DemoRepository.cloneWorkspace', () => {
  it('re-owns every copied row, never carrying the source owner across', async () => {
    const { inserts } = await clone();

    for (const table of [companyProfile, companyReferences, teamMembers, tenders, documents]) {
      for (const row of written(inserts, table)) expect(row.ownerId).toBe('visitor');
    }
  });

  it('points a copied document at the copied tender, not the original', async () => {
    const { inserts } = await clone();
    const tender = written(inserts, tenders)[0];
    const document = written(inserts, documents)[0];

    // The uuid primary keys are regenerated, so a document that kept the source
    // tenderId would belong to somebody else's dossier.
    expect(document.tenderId).not.toBe('tender-seed');
    expect(document.tenderId).toBe('new-4');
    expect(tender).not.toHaveProperty('id');
  });

  it('keeps a company document unattached instead of inventing a dossier for it', async () => {
    const rows = seededRows();
    rows.set(documents, [{ id: 'doc-seed', ownerId: 'seed', tenderId: null, kind: 'attestation' }]);
    const { inserts } = await clone(rows);

    expect(written(inserts, documents)[0].tenderId).toBeNull();
  });

  it('resets a copied dossier to pending, since its runs are not copied', async () => {
    const { inserts } = await clone();

    // 'analyzed' with no run behind it is a dossier whose detail screen 404s.
    expect(written(inserts, tenders)[0].status).toBe('pending');
  });

  it('copies the chunks of each document, vectors included', async () => {
    const { executed, tally } = await clone();

    expect(executed).toHaveLength(1);
    expect(tally.chunks).toBe(3);
  });

  it('reports what it copied rather than succeeding silently', async () => {
    const { tally } = await clone();

    expect(tally).toMatchObject({ references: 1, team: 1, tenders: 1, documents: 1 });
  });
});
