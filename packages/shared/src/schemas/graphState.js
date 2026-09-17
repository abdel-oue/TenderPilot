// zod schema for the LangGraph state object.
//
// Every node reads and writes this. It is the one place drift happens, so it is
// schema'd and validated at node boundaries in dev.
//
// TODO: graphStateSchema - tenderId, documents[], pages[], requirements[],
//       classifications[], rubric[], score, verdict, errors[], nodeTrace[]
// TODO: /** @typedef {import('zod').infer<typeof graphStateSchema>} GraphState */
