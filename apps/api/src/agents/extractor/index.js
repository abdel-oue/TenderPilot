// Extractor agent: finds every requirement in a chunk of a dossier.
// TODO: call through lib/llm.ts, parse the response with safeParse against schema.ts
// TODO: on zod failure - log the issues, retry ONCE with the issues fed back into
//       the prompt, then fail loud with SCHEMA_VALIDATION_FAILED
