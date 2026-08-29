import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Vercel applies its own Next.js output tracing. Self-hosted and Docker
  // builds still produce the minimal standalone runtime consumed by the image.
  output: process.env.VERCEL === "1" ? undefined : "standalone",
};

export default nextConfig;
