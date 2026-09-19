/** @param {object} schema @returns {string} */
export function renderOutputContract(schema) {
  return '\n\nCONTRAT JSON DE LA REPONSE FINALE (tous les champs required sont obligatoires, y compris apres correction) :\n' +
    JSON.stringify(schema) + '\nRespecte les noms exacts des champs. Les appels d outils restent autorises avant cette reponse finale.';
}
