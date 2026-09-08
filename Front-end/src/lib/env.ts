/**
 * Validação de variáveis de ambiente do frontend.
 *
 * Em desenvolvimento, `NEXT_PUBLIC_API_URL` define para onde o proxy
 * de mesma origem encaminha as chamadas `/api`. Em produção, o rewrite
 * do Next.js ou a infraestrutura de deploy faz o encaminhamento.
 *
 * O frontend nunca usa essa URL diretamente no navegador; ela alimenta
 * apenas o rewrite server-side do Next.js.
 */

function requiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}. ` +
        `Check .env.example and create a .env.local with the correct value.`,
    );
  }
  return value;
}

/**
 * URL do backend para o rewrite do Next.js.
 *
 * Essa variável é usada **apenas no servidor** (next.config.ts / rewrites).
 * O navegador envia chamadas para `/api` na mesma origem e o Next.js
 * encaminha ao backend.
 *
 * Em desenvolvimento: `http://localhost:8000`
 * Em produção: configurado via variável de ambiente do deploy
 */
export function getApiBaseUrl(): string {
  return requiredEnv("NEXT_PUBLIC_API_URL");
}
