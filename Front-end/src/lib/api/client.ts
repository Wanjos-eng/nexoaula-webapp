/**
 * Cliente HTTP central do nexoAula.
 *
 * Todas as chamadas à API passam por esse módulo. Nenhuma página ou
 * componente chama `fetch` diretamente.
 *
 * Contrato de segurança (ADR-0002):
 * - Chamadas são feitas para `/api` na mesma origem (proxy via Next.js rewrites)
 * - Cookies HttpOnly são transportados automaticamente pelo navegador
 * - Mutações (POST, PUT, PATCH, DELETE) enviam `X-NexoAula-CSRF: 1`
 * - O frontend não lê token, não monta `Authorization` e não persiste credenciais
 */

import { ApiError, NetworkError, ParseError, TimeoutError } from "./errors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Métodos HTTP suportados pelo cliente. */
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** Opções aceitas por cada chamada do cliente. */
export interface RequestOptions {
  /** Body serializado como JSON (ignorado em GET). */
  body?: unknown;
  /** Headers adicionais (nunca sobrescreve os obrigatórios). */
  headers?: Record<string, string>;
  /** Timeout em milissegundos. Default: 10 000 (10s). */
  timeout?: number;
  /** Sinal de abort externo (combinado com o timeout interno). */
  signal?: AbortSignal;
}

/** Resposta tipada do cliente. */
export interface ApiResponse<T> {
  data: T;
  status: number;
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 10_000;
const API_PREFIX = "/api";
const CSRF_HEADER = "X-NexoAula-CSRF";
const CSRF_VALUE = "1";
const MUTATING_METHODS: ReadonlySet<HttpMethod> = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

async function request<T>(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
  const { body, headers: extraHeaders, timeout = DEFAULT_TIMEOUT_MS, signal: externalSignal } = options;

  const url = `${API_PREFIX}${path}`;

  // Timeout via AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  // Combina sinais: timeout + externo (se fornecido)
  const signals = [controller.signal];
  if (externalSignal) signals.push(externalSignal);

  const combinedSignal = signals.length === 1
    ? signals[0]
    : AbortSignal.any(signals);

  // Headers base
  const requestHeaders: Record<string, string> = {
    Accept: "application/json",
    ...extraHeaders,
  };

  // CSRF header para mutações (ADR-0002)
  if (MUTATING_METHODS.has(method)) {
    requestHeaders[CSRF_HEADER] = CSRF_VALUE;
  }

  // Content-Type para requests com body
  if (body !== undefined) {
    requestHeaders["Content-Type"] = "application/json";
  }

  let response: Response;

  try {
    response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
      signal: combinedSignal,
    });
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new TimeoutError(timeout);
    }

    throw new NetworkError(error);
  } finally {
    clearTimeout(timeoutId);
  }

  // Erros HTTP
  if (!response.ok) {
    let errorBody: unknown;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = null;
    }
    throw new ApiError(response.status, response.statusText, errorBody);
  }

  // 204 No Content (ex: logout)
  if (response.status === 204) {
    return { data: undefined as T, status: 204 };
  }

  // Parse JSON
  let data: T;
  try {
    data = await response.json() as T;
  } catch (cause) {
    const raw = await response.text().catch(() => "");
    throw new ParseError(response.status, raw, cause);
  }

  return { data, status: response.status };
}

// ---------------------------------------------------------------------------
// Métodos públicos
// ---------------------------------------------------------------------------

/** GET — leitura, sem CSRF. */
export function get<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
  return request<T>("GET", path, options);
}

/** POST — mutação, envia CSRF. */
export function post<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
  return request<T>("POST", path, options);
}

/** PUT — mutação, envia CSRF. */
export function put<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
  return request<T>("PUT", path, options);
}

/** PATCH — mutação, envia CSRF. */
export function patch<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
  return request<T>("PATCH", path, options);
}

/** DELETE — mutação, envia CSRF. */
export function del<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
  return request<T>("DELETE", path, options);
}

/**
 * Objeto de conveniência que agrupa todos os métodos.
 *
 * @example
 * ```ts
 * import { apiClient } from "@/lib/api";
 *
 * const { data } = await apiClient.get<User>("/v1/auth/me");
 * await apiClient.post("/v1/auth/logout");
 * ```
 */
export const apiClient = { get, post, put, patch, del } as const;
