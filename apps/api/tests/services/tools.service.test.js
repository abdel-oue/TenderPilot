import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import ToolsService, { MAX_HUMAN_ASKS } from '../../src/services/tools.service.js';

const OWNER = 'owner-1';
const TENDER = 'tender-1';
const RUN = 'run-1';

// Every tool that touches data is scoped by the RUN CONTEXT, never by an
// argument the model supplied, so the context is part of almost every call here.
const CONTEXT = { ownerId: OWNER, tenderId: TENDER, runId: RUN };

const stubLlm = { async embed(inputs) { return inputs.map(() => [0.1, 0.2]); } };
const noTavily = {
  isEnabled: false,
  async search() { return { results: [], answer: null, degraded: true }; },
};
const liveTavily = {
  isEnabled: true,
  async search() {
    return { results: [{ title: 't', url: 'u', content: 'c', score: 1 }], answer: 'a', degraded: false };
  },
};

function build(overrides = {}) {
  return new ToolsService({
    llm: stubLlm,
    tavily: noTavily,
    documents: {
      async searchSimilarChunks() { return []; },
      async findChunks() { return []; },
      async findByIdForOwner() { return undefined; },
      async findCompanyDocuments() { return []; },
      async updateChunk() {},
    },
    analyses: { async findRunById() { return null; }, async findResultByRun() { return null; } },
    usage: { async findByRequest() { return []; } },
    company: {
      async getProfile() { return undefined; },
      async findAllReferences() { return []; },
      async findAllTeam() { return []; },
    },
    requirements: { async findByTender() { return []; } },
    tenders: { async findAll() { return []; } },
    ...overrides,
  });
}

describe('ToolsService.definitions', () => {
  it('omits web_search entirely when Tavily has no key', () => {
    expect(build().names()).not.toContain('web_search');
  });

  it('offers web_search once Tavily is configured', () => {
    expect(build({ tavily: liveTavily }).names()).toContain('web_search');
  });

  it('offers every tool the prompts tell the agents to call', () => {
    // The regression this guards: the prompts once advertised four tools that no
    // model had any channel to call. A name in a prompt and a name here must be
    // the same set, or the agent is being lied to.
    expect(build().names()).toEqual([
      'search_documents',
      'get_company_facts',
      'read_source_page',
      'get_run_state',
      'check_dossier_checklist',
      'compute_deadline',
      'calculate',
      'get_current_date',
      'simulate_score',
      'ask_human',
    ]);
  });

  it('describes every tool with a name, a description and a parameter schema', () => {
    for (const def of build({ tavily: liveTavily }).definitions()) {
      expect(def.type).toBe('function');
      expect(def.function.name).toMatch(/^[a-z_]+$/);
      expect(def.function.description.length).toBeGreaterThan(30);
      expect(def.function.parameters.type).toBe('object');
      expect(Array.isArray(def.function.parameters.required)).toBe(true);
    }
  });

  it('marks every required parameter as a declared property', () => {
    for (const def of build({ tavily: liveTavily }).definitions()) {
      const { properties, required } = def.function.parameters;
      for (const key of required) expect(properties).toHaveProperty(key);
    }
  });

  it('dispatches every tool it advertises', async () => {
    // A declared tool that falls through to "Outil inconnu" is the dead-belt bug
    // in a new costume.
    for (const name of build({ tavily: liveTavily }).names()) {
      const result = await build({ tavily: liveTavily }).execute(name, {}, CONTEXT);
      expect(result.error ?? '').not.toMatch(/Outil inconnu/);
    }
  });
});

describe('ToolsService.execute', () => {
  it('returns an error object for an unknown tool rather than throwing', async () => {
    await expect(build().execute('rm_rf', {})).resolves.toMatchObject({ error: expect.any(String) });
  });

  it('turns a throwing tool into an error object, so the graph survives it', async () => {
    const tools = build({
      documents: {
        async searchSimilarChunks() { throw new Error('pgvector down'); },
        async findChunks() { return []; },
        async findByIdForOwner() { return undefined; },
        async findCompanyDocuments() { return []; },
      },
    });
    const result = await tools.execute(
      'search_documents',
      { query: 'ISO 27001', corpus: 'entreprise' },
      CONTEXT,
    );
    expect(result).toEqual({ error: 'pgvector down' });
  });
});

describe('search_documents', () => {
  it('says plainly when nothing matches, instead of returning a near miss', async () => {
    const result = await build().execute(
      'search_documents',
      { query: 'aeronautique', corpus: 'entreprise' },
      CONTEXT,
    );
    expect(result.extracts).toEqual([]);
    expect(result.note).toMatch(/Aucun document/);
  });

  it('carries document and page through every extract, so a citation stays checkable', async () => {
    const tools = build({
      documents: {
        async searchSimilarChunks() {
          return [{ documentId: 'd1', page: 4, article: 'Art. 3', content: 'texte', distance: 0.2 }];
        },
        async findChunks() { return []; },
        async findByIdForOwner() { return undefined; },
        async findCompanyDocuments() { return []; },
      },
    });
    const result = await tools.execute(
      'search_documents',
      { query: 'ISO', corpus: 'entreprise' },
      CONTEXT,
    );
    expect(result.extracts[0]).toMatchObject({ documentId: 'd1', page: 4, article: 'Art. 3' });
  });

  it('restricts the company corpus to company document kinds', async () => {
    const searchSimilarChunks = vi.fn(async () => []);
    const tools = build({
      documents: {
        searchSimilarChunks,
        async findChunks() { return []; },
        async findByIdForOwner() { return undefined; },
        async findCompanyDocuments() { return []; },
      },
    });

    await tools.execute('search_documents', { query: 'x', corpus: 'entreprise' }, CONTEXT);

    const [, ownerId, , kinds, tenderId] = searchSimilarChunks.mock.calls[0];
    expect(ownerId).toBe(OWNER);
    expect(kinds).toEqual(['memoire', 'attestation', 'profil']);
    expect(tenderId).toBeNull();
  });

  it('restricts the dossier corpus to THIS dossier', async () => {
    // Without the tenderId filter the agent can cite another dossier's article
    // as if it belonged to this one, which reads as a real citation and is not.
    const searchSimilarChunks = vi.fn(async () => []);
    const tools = build({
      documents: {
        searchSimilarChunks,
        async findChunks() { return []; },
        async findByIdForOwner() { return undefined; },
        async findCompanyDocuments() { return []; },
      },
    });

    await tools.execute('search_documents', { query: 'caution', corpus: 'dossier' }, CONTEXT);

    const [, , , kinds, tenderId] = searchSimilarChunks.mock.calls[0];
    expect(kinds).toBeUndefined();
    expect(tenderId).toBe(TENDER);
  });

  it('rejects an empty query without spending an embedding call', async () => {
    const embed = vi.fn();
    const result = await build({ llm: { embed } }).execute(
      'search_documents',
      { query: '   ', corpus: 'entreprise' },
      CONTEXT,
    );
    expect(result.extracts).toEqual([]);
    expect(embed).not.toHaveBeenCalled();
  });

  it('refuses to search with no owner in context, rather than searching everyone', async () => {
    const result = await build().execute('search_documents', { query: 'x', corpus: 'entreprise' }, {});
    expect(result.extracts).toEqual([]);
    expect(result.note).toMatch(/Aucune entreprise/);
  });
});

describe('get_company_facts', () => {
  const company = {
    async getProfile() { return { raisonSociale: 'ACME', ca2024: 12_000_000 }; },
    async findAllReferences() {
      return [
        { id: 'REF-01', secteur: 'assainissement', montant: 8_000_000, annee: 2023 },
        { id: 'REF-02', secteur: 'voirie', montant: 2_000_000, annee: 2021 },
      ];
    },
    async findAllTeam() { return [{ id: 'CV-01', poste: 'Chef de projet' }]; },
  };

  it('answers an exact figure that a vector search could not', async () => {
    const result = await build({ company }).execute(
      'get_company_facts',
      { scope: 'profil' },
      CONTEXT,
    );
    expect(result.profil.ca2024).toBe(12_000_000);
  });

  it('filters references by sector and by amount', async () => {
    const result = await build({ company }).execute(
      'get_company_facts',
      { scope: 'references', secteur: 'assainissement', montantMin: 5_000_000 },
      CONTEXT,
    );
    expect(result.references.map((r) => r.id)).toEqual(['REF-01']);
  });

  it('says so plainly when no reference matches, instead of returning the nearest', async () => {
    const result = await build({ company }).execute(
      'get_company_facts',
      { scope: 'references', montantMin: 999_000_000 },
      CONTEXT,
    );
    expect(result.references).toEqual([]);
    expect(result.note).toMatch(/Aucune reference/);
  });

  it('reports an absent profile as absent rather than as an empty company', async () => {
    const result = await build().execute('get_company_facts', { scope: 'profil' }, CONTEXT);
    expect(result.profil).toBeNull();
    expect(result.note).toMatch(/Aucun profil/);
  });

  it('rejects an unknown scope', async () => {
    const result = await build().execute('get_company_facts', { scope: 'salaires' }, CONTEXT);
    expect(result.error).toMatch(/scope inconnu/);
  });
});

describe('read_source_page', () => {
  const chunks = [
    { id: 'c3', page: 3, article: 'Article 7.2', content: 'Le candidat doit...', extraction: 'text_layer' },
    { id: 'c4', page: 4, article: null, content: '', extraction: 'unread' },
  ];
  const documents = {
    async findChunks() { return chunks; },
    async findByIdForOwner() { return { id: 'd1', filePath: '/nowhere.pdf' }; },
    async searchSimilarChunks() { return []; },
    async findCompanyDocuments() { return []; },
    async updateChunk() {},
  };
  const tools = () => build({ documents });

  it('returns the exact page text for verification', async () => {
    const result = await tools().execute('read_source_page', { documentId: 'd1', page: 3 }, CONTEXT);
    expect(result).toMatchObject({ readable: true, page: 3, article: 'Article 7.2' });
  });

  it('flags an unreadable page instead of returning empty text', async () => {
    // Empty text would read as "this page says nothing", which is how an agent
    // ends up inventing requirements for a scan it could not read. The OCR retry
    // fails here (no such file), and the answer must still be honest.
    const result = await tools().execute('read_source_page', { documentId: 'd1', page: 4 }, CONTEXT);
    expect(result.readable).toBe(false);
    expect(result.text).toBeUndefined();
    expect(result.note).toMatch(/pas pu etre lue/);
  });

  it('reports a missing page as an error', async () => {
    const result = await tools().execute('read_source_page', { documentId: 'd1', page: 99 }, CONTEXT);
    expect(result.error).toMatch(/introuvable/);
  });

  it("refuses a documentId that is not this owner's", async () => {
    // The documentId comes from a model that has read an outsider's PDF, so it
    // is untrusted input like any other.
    const other = build({
      documents: { ...documents, async findByIdForOwner() { return undefined; } },
    });
    const result = await other.execute('read_source_page', { documentId: 'd9', page: 1 }, CONTEXT);
    expect(result.error).toMatch(/introuvable/);
  });
});

describe('get_run_state', () => {
  const analyses = {
    async findRunById() {
      return { nodeTrace: [{ node: 'retrieve', summary: 'ISO 27001 -> 0 hits', status: 'ok', at: 'now' }] };
    },
    async findResultByRun() { return { verdict: 'no-go', score: '38', blockers: [{ text: 'ISO' }] }; },
  };
  const usage = { async findByRequest() { return [{ operation: 'matcher', status: 'ok', totalTokens: 90 }]; } };

  it('returns what the run already tried, which is what stops a repeated query', async () => {
    const result = await build({ analyses, usage }).execute('get_run_state', {}, CONTEXT);
    expect(result.steps[0].summary).toContain('0 hits');
    expect(result.calls[0].operation).toBe('matcher');
  });

  it('returns only what was asked for', async () => {
    const result = await build({ analyses, usage }).execute(
      'get_run_state',
      { include: ['verdict'] },
      CONTEXT,
    );
    expect(result.verdict.verdict).toBe('no-go');
    expect(result.steps).toBeUndefined();
  });

  it('can hand back the extracted requirements the graph state did not pass', async () => {
    const requirements = {
      async findByTender() { return [{ id: 'r1', text: 'ISO 27001', obligation: 'eliminatoire' }]; },
    };
    const result = await build({ analyses, usage, requirements }).execute(
      'get_run_state',
      { include: ['exigences'] },
      CONTEXT,
    );
    expect(result.requirements).toHaveLength(1);
  });

  it('is harmless when called outside a run', async () => {
    const result = await build().execute('get_run_state', {}, {});
    expect(result.note).toMatch(/Aucune analyse/);
  });
});

describe('check_dossier_checklist', () => {
  it('reports a required piece as missing when nothing uploaded matches it', async () => {
    const tools = build({
      requirements: {
        async findByTender() {
          return [
            { id: 'r1', text: 'Fournir une attestation fiscale de moins de 3 mois', nature: 'procedure', obligation: 'eliminatoire', sourcePage: 12 },
            { id: 'r2', text: 'Etre certifie ISO 27001', nature: 'capacite', obligation: 'eliminatoire', sourcePage: 3 },
          ];
        },
      },
      documents: {
        async findCompanyDocuments() { return [{ kind: 'attestation', originalName: 'attestation-cnss.pdf' }]; },
        async searchSimilarChunks() { return []; },
        async findChunks() { return []; },
        async findByIdForOwner() { return undefined; },
      },
    });

    const result = await tools.execute('check_dossier_checklist', {}, CONTEXT);

    // Only procedural pieces are on the checklist: a capability is not something
    // you can satisfy by uploading a file.
    expect(result.pieces).toHaveLength(1);
    expect(result.pieces[0].fourni).toBe(false);
    expect(result.manquantes).toHaveLength(1);
  });

  it('matches an uploaded file to the piece that asked for it', async () => {
    const tools = build({
      requirements: {
        async findByTender() {
          return [{ id: 'r1', text: 'Joindre une attestation CNSS', nature: 'procedure', obligation: 'obligatoire', sourcePage: 12 }];
        },
      },
      documents: {
        async findCompanyDocuments() { return [{ kind: 'attestation', originalName: 'attestation-cnss.pdf' }]; },
        async searchSimilarChunks() { return []; },
        async findChunks() { return []; },
        async findByIdForOwner() { return undefined; },
      },
    });

    const result = await tools.execute('check_dossier_checklist', {}, CONTEXT);
    expect(result.pieces[0].fourni).toBe(true);
    // It never claims certainty it has not got.
    expect(result.note).toMatch(/confirmer par un humain/);
  });
});

describe('simulate_score', () => {
  const requirements = {
    async findByTender() {
      return [
        { id: 'r1', obligation: 'eliminatoire', nature: 'capacite', text: 'ISO 27001', sourcePage: 3 },
        { id: 'r2', obligation: 'obligatoire', nature: 'capacite', text: 'PMP', sourcePage: 4 },
      ];
    },
  };

  it('turns a no-go into actionable advice by replaying the real scoring rules', async () => {
    const analyses = {
      async findRunById() { return {}; },
      async findResultByRun() {
        return {
          verdict: 'no-go',
          score: '25',
          blockers: [{ text: 'ISO 27001' }],
          matches: [
            { requirementId: 'r1', status: 'unmet', confidence: 0.9 },
            { requirementId: 'r2', status: 'met', confidence: 0.8 },
          ],
        };
      },
    };

    const result = await build({ analyses, requirements }).execute(
      'simulate_score',
      { overrides: [{ requirementId: 'r1', status: 'met' }] },
      CONTEXT,
    );

    expect(result.actuel.verdict).toBe('no-go');
    expect(result.projete.verdict).toBe('go');
    expect(result.bloquantsRestants).toEqual([]);
    expect(result.note).toMatch(/inchange/);
  });

  it('refuses to simulate before there is a result to simulate against', async () => {
    const result = await build({ requirements }).execute(
      'simulate_score',
      { overrides: [] },
      CONTEXT,
    );
    expect(result.error).toMatch(/pas encore produit/);
  });
});

describe('compute_deadline', () => {
  it('counts calendar and working days to a French-formatted deadline', () => {
    const result = ToolsService.computeDeadline('12/03/2026', '2026-03-02');
    expect(result.joursCalendaires).toBe(10);
    expect(result.joursOuvres).toBe(8);
    expect(result.depassee).toBe(false);
  });

  it('says plainly that a deadline is already past', () => {
    const result = ToolsService.computeDeadline('2026-01-01', '2026-03-02');
    expect(result.depassee).toBe(true);
    expect(result.joursCalendaires).toBeLessThan(0);
  });

  it('refuses an unparseable date instead of guessing one', () => {
    // A guessed deadline is the one mistake this product cannot make.
    expect(ToolsService.computeDeadline('le mois prochain').error).toMatch(/illisible/);
  });

  it('admits that Moroccan public holidays are not deducted', () => {
    expect(ToolsService.computeDeadline('2026-03-12', '2026-03-02').note).toMatch(/feries/);
  });
});

describe('get_current_date', () => {
  it('reports the real system date, not the model training date', () => {
    const result = ToolsService.currentDate();
    expect(result.today).toBe(new Date().toISOString().slice(0, 10));
    expect(result.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('calculate', () => {
  it('computes a caution provisoire exactly', async () => {
    const result = await build().execute('calculate', { expression: '1.5% * 2400000' }, CONTEXT);
    expect(result.value).toBe(36000);
  });

  it('refuses a comma rather than guessing decimal or thousands', async () => {
    const result = await build().execute('calculate', { expression: '1,5 * 2' }, CONTEXT);
    expect(result.error).toMatch(/Virgule refusee/);
  });
});

describe('web_search', () => {
  it('tells the model the search was unavailable rather than implying no results exist', async () => {
    const result = await build({ tavily: noTavily }).execute('web_search', { query: 'q' }, CONTEXT);
    expect(result.results).toEqual([]);
    expect(result.note).toMatch(/indisponible/);
  });

  it('returns results when Tavily answers', async () => {
    const result = await build({ tavily: liveTavily }).execute('web_search', { query: 'q' }, CONTEXT);
    expect(result.results).toHaveLength(1);
    expect(result.answer).toBe('a');
  });

  it('passes the full-content flag through to the provider', async () => {
    const search = vi.fn(async () => ({ results: [], answer: null, degraded: false }));
    const tools = build({ tavily: { isEnabled: true, search } });

    await tools.execute('web_search', { query: 'q', fullContent: true }, CONTEXT);

    expect(search).toHaveBeenCalledWith('q', { maxResults: 5, fullContent: true });
  });
});

describe('the raison argument', () => {
  it('is offered on every single tool, so none can forget it', () => {
    for (const def of build({ tavily: liveTavily }).definitions()) {
      expect(def.function.parameters.properties).toHaveProperty('raison');
    }
  });

  it('is never required, so a model that omits it still gets its answer', () => {
    // Narration is a nicety. Refusing the call over a missing sentence would
    // trade a working tool for a prettier feed.
    for (const def of build({ tavily: liveTavily }).definitions()) {
      expect(def.function.parameters.required).not.toContain('raison');
    }
  });

  it('never reaches the tool implementation', async () => {
    // It is narration, not an argument. Leaking it means every tool has to know
    // the field exists, and one of them eventually treats it as a filter.
    const searchSimilarChunks = vi.fn(async () => []);
    const tools = build({
      documents: {
        searchSimilarChunks,
        async findChunks() { return []; },
        async findByIdForOwner() { return undefined; },
        async findCompanyDocuments() { return []; },
      },
    });

    await tools.execute(
      'search_documents',
      { query: 'x', corpus: 'entreprise', raison: 'Pour verifier vos references.' },
      CONTEXT,
    );

    expect(searchSimilarChunks).toHaveBeenCalled();
  });

  it('does not stop a tool working when it is absent', async () => {
    const result = await build().execute('calculate', { expression: '2+2' }, CONTEXT);
    expect(result.value).toBe(4);
  });
});

describe('ask_human', () => {
  /** @param {object[]} trace what the run has recorded so far */
  function withTrace(trace) {
    const parked = [];
    const service = build({
      analyses: {
        async findRunById() { return { id: RUN, nodeTrace: trace }; },
        async setPendingQuestion(_runId, question) { parked.push(question); },
      },
    });
    return { service, parked };
  }

  const OPTIONS = [
    { value: 'oui', label: 'Oui, nous la detenons' },
    { value: 'non', label: 'Non' },
  ];

  it('parks the question before suspending, because interrupt() never returns', async () => {
    // Everything written after interrupt() is unreachable, so the question has to
    // be persisted first or the screen has nothing to render the pause from.
    // Outside a graph interrupt() throws a plain Error rather than a
    // GraphInterrupt, so here it degrades to { error } - the rethrow of a real
    // interrupt is asserted in tests/graph/traced.test.js.
    const { service, parked } = withTrace([]);

    const result = await service.execute(
      'ask_human',
      // `raison` rides in with the arguments, like on every other tool: it is
      // the model's own sentence, written on the call it was already making.
      { question: 'ISO 22301 ?', options: OPTIONS, raison: 'pour ne pas vous ecarter a tort' },
      { ...CONTEXT, node: 'matchProfile' },
    );

    expect(parked).toHaveLength(1);
    expect(parked[0]).toMatchObject({
      node: 'matchProfile',
      question: 'ISO 22301 ?',
      raison: 'pour ne pas vous ecarter a tort',
      options: OPTIONS,
    });
    expect(parked[0].askId).toBeTruthy();
    expect(result.error).toMatch(/interrupt/i);
  });

  it('answers from the trace on the replay instead of asking twice', async () => {
    // Resuming re-executes the whole node, so the same question comes back
    // around. Asking again would park the run on a question already answered.
    const askKey = createHash('sha256').update('matchProfile|ISO 22301 ?').digest('hex').slice(0, 16);
    const { service } = withTrace([
      { node: 'matchProfile', status: 'human', askKey, choice: 'oui', instruction: 'nous l avons depuis 2023' },
    ]);

    const result = await service.execute(
      'ask_human',
      { question: 'ISO 22301 ?', options: OPTIONS },
      { ...CONTEXT, node: 'matchProfile' },
    );

    expect(result).toEqual({ reponse: 'oui', instruction: 'nous l avons depuis 2023' });
  });

  it('stops asking once the budget is spent', async () => {
    // Bounded in code, never in a prompt - the same rule as MAX_REDRAFTS. The
    // agent gets an error it can act on and finishes alone.
    const spent = Array.from({ length: MAX_HUMAN_ASKS }, (_, index) => ({
      node: 'matchProfile',
      status: 'human',
      askKey: 'other-' + index,
      choice: 'oui',
    }));

    const result = await withTrace(spent).service.execute(
      'ask_human',
      { question: 'une question de plus ?', options: OPTIONS },
      { ...CONTEXT, node: 'matchProfile' },
    );

    expect(result.error).toMatch(/[Bb]udget/);
  });

  it('refuses a question with fewer than two options', async () => {
    // The options are what make the pause renderable. One option is not a
    // question, it is a notification.
    const result = await withTrace([]).service.execute(
      'ask_human',
      { question: 'ISO 22301 ?', options: [{ value: 'oui', label: 'Oui' }] },
      { ...CONTEXT, node: 'matchProfile' },
    );

    expect(result.error).toMatch(/deux reponses/);
  });

  it('refuses to ask outside a run', async () => {
    const result = await withTrace([]).service.execute('ask_human', { question: 'x ?', options: OPTIONS }, {});
    expect(result.error).toMatch(/[Aa]ucune analyse/);
  });
});
