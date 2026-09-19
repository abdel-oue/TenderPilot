import { normalizeQuote } from './provenance.js';

/** Build the evidence catalog exclusively from company records and company tool results.
 * @param {object} company @param {object[]} toolCalls @returns {Map<string, unknown>}
 */
export function evidenceCatalog(company, toolCalls = []) {
  const catalog = new Map();
  const add = (key, value) => catalog.set(normalizeQuote(key), value);
  const profile = company.profile ?? {};
  for (const row of [...(company.references ?? []), ...(company.team ?? [])]) add(row.id, row);
  for (const [key, value] of Object.entries(profile)) {
    if (value !== null && value !== undefined) add('profil.' + key, value);
  }
  for (const value of [...(profile.certifications ?? []), ...(profile.attestations ?? [])]) add(value, value);
  for (const call of toolCalls) {
    if (call.result?.error || call.tool !== 'search_documents' || (call.args?.corpus ?? 'entreprise') !== 'entreprise') continue;
    for (const extract of call.result?.extracts ?? []) {
      add(`${extract.documentId}:p${extract.page}`, extract);
    }
  }
  return catalog;
}

/** Resolve exact evidence keys; never accept an identifier merely mentioned in prose.
 * @param {object[]} requirements @param {object[]} matches @param {Map<string, unknown>} catalog
 * @returns {{ matches: object[], candidates: object[] }}
 */
export function validateMatchEvidence(requirements, matches, catalog) {
  const candidates = [];
  const validated = requirements.map((requirement) => {
    const found = matches.filter((match) => match.requirementId === requirement.id);
    const match = found[0] ?? { requirementId: requirement.id, status: 'unknown', confidence: 0, evidence: [], reason: 'Exigence non evaluee.' };
    const invalid = (match.evidence ?? []).filter((id) => !catalog.has(normalizeQuote(id)));
    const mustSupport = requirement.nature === 'capacite' && requirement.obligation === 'eliminatoire' && match.status === 'met';
    if (found.length !== 1 || invalid.length || (mustSupport && !match.evidence?.length)) {
      return { ...match, status: 'unknown', confidence: 0, evidenceValidated: false,
        reason: invalid.length ? `Preuves inconnues : ${invalid.join(', ')}. Verification humaine requise.`
          : 'Preuve absente ou evaluation ambigue : capacite non confirmee.' };
    }
    if (mustSupport) candidates.push({ requirement, match, evidence: match.evidence.map((id) => ({ id, value: catalog.get(normalizeQuote(id)) })) });
    return { ...match, evidenceValidated: !mustSupport };
  });
  return { matches: validated, candidates };
}
