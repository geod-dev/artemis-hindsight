import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // In the monorepo, file tracing must start at the repo root so workspace packages are included.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  transpilePackages: ["@artemis/contracts"],
  // The Docker image ships only .next/standalone: the server and the node_modules files it actually uses, not the
  // whole install. A smaller image is much faster to export and unpack on each deploy.
  output: "standalone",
  // The prompts are read with fs at runtime (process.cwd()/prompts), which the tracer may not follow.
  outputFileTracingIncludes: { "/*": ["./prompts/**/*"] },
  // Type checking runs in CI (.github/workflows/ci.yml: npm run typecheck), not in `next build`, where it added
  // ~45 s to every deploy.
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
