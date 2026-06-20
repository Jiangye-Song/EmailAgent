import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Alibaba Cloud Function Compute Docker deployment
  output: "standalone",

  // Turbopack config lives at top-level in Next.js 16 (no longer under experimental)
  turbopack: {},

  images: {
    // Use remotePatterns — images.domains is deprecated in v16
    remotePatterns: [],
  },
};

export default nextConfig;
