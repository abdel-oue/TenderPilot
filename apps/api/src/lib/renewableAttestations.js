// Administrative renewals do not establish a missing company capability.
// Keep this narrow: professional certifications and execution references remain
// capabilities even when the model calls their supporting document an attestation.
export function isRenewableAttestation(requirement) {
  const text = (requirement.text ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’‘]/g, "'").toLowerCase();
  return /\battestations?\b/.test(text)
    && /\b(fiscale?s?|cnss|regularite fiscale|regularite sociale)\b/.test(text)
    && !/\b(certifications?|iso|references?|chiffre d'affaires|experiences?|chef de projet)\b/.test(text);
}
