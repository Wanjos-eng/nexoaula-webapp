/**
 * Validação de variáveis de ambiente do frontend.
 *
 * Em desenvolvimento, `API_BASE_URL` define para onde o proxy
 * de mesma origem encaminha as chamadas `/api`. Em produção, o rewrite
 * do Next.js ou a infraestrutura de deploy faz o encaminhamento.
 *
 * O frontend nunca usa essa URL diretamente no navegador; ela alimenta
 * apenas o rewrite server-side do Next.js.
 */

const DEFAULT_API_BASE_URL = "http://localhost:8000";

/**
 * URL do backend para o rewrite do Next.js. Usa localhost:8000 por padrão.
 *
 * Essa variável é usada **apenas no servidor** (next.config.ts / rewrites).
 * O navegador envia chamadas para `/api` na mesma origem e o Next.js
 * encaminha ao backend.
 *
 * Em desenvolvimento: `http://localhost:8000`
 * Em produção: configurado via variável de ambiente do deploy
 */
export function getApiBaseUrl(): string {
  const configuredValue = process.env.API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;

  let url: URL;
  try {
    url = new URL(configuredValue);
  } catch {
    throw new Error("API_BASE_URL must be a valid absolute URL");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("API_BASE_URL must use http or https");
  }

  if (url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("API_BASE_URL must contain only the backend origin");
  }

  return url.origin;
}
