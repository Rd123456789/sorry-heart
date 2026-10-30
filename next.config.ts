import type { NextConfig } from "next";

// Static export: deploys as a Render Static Site (free, no cold start).
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
