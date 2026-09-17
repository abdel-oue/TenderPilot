import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The repository already has its rulebook in the root CLAUDE.md.
  agentRules: false,
  // Standalone output: docker/Dockerfile's `web` target copies only this bundle.
  output: "standalone",
  // The repo root is the workspace root, not apps/web — Next has to be told, or the
  // standalone trace misses packages/shared.
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
};

export default nextConfig;
