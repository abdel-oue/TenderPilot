// THE LLM client. One client, one baseURL, one key. Every call goes through here.
//
// TODO: complete({ system, user, schema }) - calls the model, safeParses the JSON
//       against the caller's zod schema, retries once with the zod issues fed back,
//       then throws SCHEMA_VALIDATION_FAILED
// TODO: honour STUB_LLM - return fixture responses instead of calling out,
//       so E2E runs are deterministic and burn no quota
// TODO: log tokens + latency per call with pino
//
// No second SDK. Never JSON.parse a model response. Never cast it with `as`.
