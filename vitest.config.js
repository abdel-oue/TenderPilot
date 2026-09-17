// One runner for both workspaces: the api's .js and the web's .ts.
//
// TODO: defineConfig with projects for apps/api and apps/web
// TODO: include only the workspace tests/ folders — specs are never colocated
// TODO: apps/web/e2e is EXCLUDED here; Playwright owns it
// TODO: setupFiles that mock lib/llm.js at the module boundary by default,
//       so no unit test can reach the real endpoint by forgetting to mock
