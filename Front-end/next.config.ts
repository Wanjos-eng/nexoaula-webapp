import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Produces the minimal runtime bundle consumed by the frontend Docker image.
  output: "standalone",
};

export default nextConfig;
