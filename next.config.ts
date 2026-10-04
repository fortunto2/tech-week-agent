import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // Fly.io Dockerfile
  serverExternalPackages: ["@mastra/*", "@onkernel/sdk", "playwright-core", "life2film-engine", "agentmail", "@neondatabase/serverless"],
};

export default nextConfig;
