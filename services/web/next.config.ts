import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // In the monorepo, file tracing must start at the repo root so workspace packages are included.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  transpilePackages: ["@artemis/contracts"],
};

export default nextConfig;
