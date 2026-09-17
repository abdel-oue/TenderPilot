import path from "node:path";
import { startVitest } from "vitest/node";

// Use the shared runner without loading the root's unfinished placeholder config.
const runner = await startVitest("test", ["apps/web/tests/lib/landing"], {
  root: path.resolve(import.meta.dirname, "../../.."),
  config: false,
  watch: false,
});

if (!runner) {
  process.exitCode = 1;
} else {
  const files = runner.state.getFiles();
  const failed = files.length === 0 || files.some((file) => file.result?.state === "fail");
  if (failed || runner.state.getUnhandledErrors().length > 0) process.exitCode = 1;
  await runner.close();
}
