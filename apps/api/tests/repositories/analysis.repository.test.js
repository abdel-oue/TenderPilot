import { describe, expect, it } from 'vitest';
import AnalysisRepository from '../../src/repositories/analysis.repository.js';

/**
 * Fake drizzle chain. The repository's job is to ask the right question and to
 * refuse the wrong write, not to be Postgres.
 */
function fakeDb(rows = []) {
  const calls = { inserted: [], updated: [], where: [] };
  const chain = {
    calls,
    select() { return chain; },
    from() { return chain; },
    innerJoin() { return chain; },
    where(w) { calls.where.push(w); return chain; },
    orderBy() { return Promise.resolve(rows); },
    limit() { return Promise.resolve(rows); },
    insert() { return chain; },
    values(v) { calls.inserted.push(v); return chain; },
    update() { return chain; },
    set(v) { calls.updated.push(v); return chain; },
    returning() { return Promise.resolve([{ id: 'written' }]); },
    then(resolve) { return Promise.resolve(rows).then(resolve); },
  };
  return chain;
}

/** A repository whose findSections returns exactly these rows. */
function repositoryWithSections(sections) {
  const db = fakeDb([]);
  const repository = new AnalysisRepository(db);
  repository.findSections = async () => sections;
  return { repository, db };
}

describe('AnalysisRepository.upsertSection (EX-06)', () => {
  it('inserts a section that does not exist yet', async () => {
    const { repository, db } = repositoryWithSections([]);

    await repository.upsertSection({
      runId: 'run-1',
      sectionKey: 'team',
      title: 'Moyens humains',
      content: 'Brouillon agent.',
      editedByHuman: false,
    });

    expect(db.calls.inserted).toHaveLength(1);
  });

  it('lets an agent redraft replace an earlier agent draft', async () => {
    const { repository, db } = repositoryWithSections([
      { id: 's1', sectionKey: 'team', editedByHuman: false },
    ]);

    await repository.upsertSection({
      runId: 'run-1',
      sectionKey: 'team',
      title: 'Moyens humains',
      content: 'Deuxieme brouillon.',
      editedByHuman: false,
    });

    expect(db.calls.updated[0].content).toBe('Deuxieme brouillon.');
  });

  it('REFUSES to let an agent draft overwrite a human correction', async () => {
    // The jury scenario: a human rewrites a section, the graph runs again, and
    // the correction must still be there. The previous version overwrote it on
    // the very next compliance pass and reset the flag with it.
    const human = {
      id: 's1',
      sectionKey: 'team',
      content: 'Texte reecrit par le dirigeant.',
      editedByHuman: true,
    };
    const { repository, db } = repositoryWithSections([human]);

    const result = await repository.upsertSection({
      runId: 'run-1',
      sectionKey: 'team',
      title: 'Moyens humains',
      content: "Brouillon de l'agent, qui ne doit pas gagner.",
      editedByHuman: false,
    });

    expect(db.calls.updated).toHaveLength(0);
    expect(result).toBe(human);
  });

  it('lets a human correction replace an earlier human correction', async () => {
    // Only a human overrides a human.
    const { repository, db } = repositoryWithSections([
      { id: 's1', sectionKey: 'team', editedByHuman: true },
    ]);

    await repository.upsertSection({
      runId: 'run-1',
      sectionKey: 'team',
      title: 'Moyens humains',
      content: 'Seconde correction humaine.',
      editedByHuman: true,
    });

    expect(db.calls.updated[0].content).toBe('Seconde correction humaine.');
    expect(db.calls.updated[0].editedByHuman).toBe(true);
  });
});

describe('AnalysisRepository.findHumanEditsForTender', () => {
  it('uses only the newest correction for each section', async () => {
    const latest = { sectionKey: 'team', content: 'Latest', runId: 'new' };
    const repository = new AnalysisRepository(fakeDb([latest, { sectionKey: 'team', content: 'Obsolete', runId: 'old' }]));
    expect(await repository.findHumanEditsForTender('tender-1')).toEqual([latest]);
  });
  it('reads corrections across every run of the tender, not just the current one', async () => {
    // Each start() mints a new runId, so a lookup scoped to one run cannot see
    // the correction a human made during the previous analysis - which is what
    // "la correction est reprise" has to mean to be worth anything.
    const rows = [{ sectionKey: 'team', content: 'Correction de lundi.', runId: 'run-0' }];
    const repository = new AnalysisRepository(fakeDb(rows));

    const edits = await repository.findHumanEditsForTender('tender-1');

    expect(edits).toEqual(rows);
  });
});
