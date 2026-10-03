import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  // Make sure the native addon (and its loader helpers) land in .next/standalone.
  outputFileTracingIncludes: {
    "/**": [
      // better-sqlite3 13 ships prebuilt binaries under prebuilds/ (no build/Release).
      "./node_modules/better-sqlite3/prebuilds/**/*.node",
      "./node_modules/better-sqlite3/lib/**/*",
    ],
  },
};

export default nextConfig;
