import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // Fly.io Dockerfile
  serverExternalPackages: ["@mastra/*", "@onkernel/sdk", "playwright-core", "life2film-engine"],
};

export default nextConfig;
