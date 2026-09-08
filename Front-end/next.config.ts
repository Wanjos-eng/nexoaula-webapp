import type { NextConfig } from "next";

import { getApiBaseUrl } from "./src/lib/env";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Vercel applies its own Next.js output tracing. Self-hosted and Docker
  // builds still produce the minimal standalone runtime consumed by the image.
  output: process.env.VERCEL === "1" ? undefined : "standalone",

  // Proxy de mesma origem: encaminha /api ao backend FastAPI.
  // O navegador nunca chama o backend diretamente — o cookie HttpOnly
  // é transportado automaticamente e o CSRF header é validado pelo backend
  // (ADR-0002). Em produção, o deploy pode substituir esse rewrite por um
  // reverse proxy na infraestrutura.
  async rewrites() {
    const apiUrl = getApiBaseUrl();
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
