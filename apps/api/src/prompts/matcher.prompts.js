// ALL Qualifier/matcher prompt text.

export const MATCHER_SYSTEM = `Tu es analyste d'appels d'offres pour une PME marocaine.

On te donne le PROFIL COMPLET de l'entreprise et une LISTE D'EXIGENCES extraites
d'un dossier de consultation. Pour chaque exigence, dis si l'entreprise y répond.

status :
- "met"     : le profil le prouve explicitement
- "partial" : partiellement couvert (ex. 8 ans d'expérience pour 10 demandés)
- "unmet"   : le profil montre que ce n'est PAS couvert
- "unknown" : le profil ne permet pas de trancher

Règles absolues :
- evidence ne contient QUE des identifiants réels du profil : REF-01, CV-03,
  une certification listée, une attestation listée. Jamais un identifiant inventé.
- Si rien dans le profil ne soutient l'exigence, evidence est un tableau VIDE et
  status vaut "unmet" ou "unknown". Ne fabrique jamais une référence.
- Une certification expirée ou absente de la liste n'est PAS détenue.
- "unknown" est une réponse honnête et acceptable. Préfère-la à une affirmation
  que le profil ne soutient pas.
- confidence : 0 à 1, ta certitude réelle. Sois sévère.
- reason : une phrase en français, citant l'élément du profil utilisé.

Réponds UNIQUEMENT en JSON : {"matches": [...]}, un objet par exigence, avec son
requirementId exact.`;

/**
 * @param {object} profile company_profile row
 * @param {object[]} references company_references rows
 * @param {object[]} team team_members rows
 * @returns {string}
 */
export function renderProfile(profile, references, team) {
  return [
    `ENTREPRISE : ${profile.raisonSociale} (${profile.formeJuridique})`,
    `Siège : ${profile.siege} · Création : ${profile.creation} · Effectif : ${profile.effectif}`,
    `Chiffre d'affaires HT (MAD) : ${JSON.stringify(profile.chiffreAffaires)}`,
    `Certifications détenues : ${(profile.certifications ?? []).join(', ') || 'aucune'}`,
    `Attestations disponibles : ${(profile.attestations ?? []).join(', ') || 'aucune'}`,
    `Secteurs couverts : ${(profile.secteurs ?? []).join(', ') || 'aucun'}`,
    '',
    'RÉFÉRENCES :',
    ...references.map(
      (r) =>
        `  ${r.id} | ${r.secteur} | ${r.client} | ${r.objet} | ${r.montantHtMad} MAD | ` +
        `${r.anneeDebut} | ${r.dureeMois} mois | attestation: ${r.attestationBonneExecution ? 'oui' : 'non'}`,
    ),
    '',
    'ÉQUIPE :',
    ...team.map(
      (m) =>
        `  ${m.id} | ${m.poste} | ${m.anneesExperience} ans | ${m.diplome} | ` +
        `certifs: ${(m.certifications ?? []).join('/') || 'aucune'} | langues: ${(m.langues ?? []).join('/')}`,
    ),
  ].join('\n');
}

/**
 * @param {{ id: string, text: string, category: string, obligation: string, sourcePage: number, sourceArticle: string|null }[]} requirements
 * @returns {string}
 */
export function renderRequirements(requirements) {
  return [
    'EXIGENCES :',
    ...requirements.map(
      (r) =>
        `  requirementId=${r.id} | ${r.obligation} | ${r.category} | ` +
        `${r.sourceArticle ?? 'article n/a'} p.${r.sourcePage} | ${r.text}`,
    ),
  ].join('\n');
}
