/**
 * Erros normalizados para o cliente HTTP.
 *
 * Todas as classes estendem `Error` e são identificáveis via `instanceof`.
 * Nenhuma mensagem expõe detalhes internos da API ao domínio; isso é
 * responsabilidade da camada de serviço ou UI que trata o erro.
 */

/**
 * Erro HTTP retornado pela API (4xx, 5xx).
 *
 * `body` contém o JSON parseado do corpo da resposta quando disponível,
 * permitindo à camada superior inspecionar contratos de erro do backend
 * sem acoplar o cliente ao formato.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly body: unknown;

  constructor(status: number, statusText: string, body: unknown) {
    super(`HTTP ${status} ${statusText}`);
    this.name = "ApiError";
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

/** Falha de rede: offline, DNS, conexão recusada, etc. */
export class NetworkError extends Error {
  constructor(cause?: unknown) {
    super("Network request failed");
    this.name = "NetworkError";
    this.cause = cause;
  }
}

/** A requisição excedeu o timeout configurado. */
export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Request timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

/** A resposta não pôde ser parseada como JSON. */
export class ParseError extends Error {
  readonly status: number;
  readonly rawBody: string;

  constructor(status: number, rawBody: string, cause?: unknown) {
    super(`Expected JSON response but received unparseable body (HTTP ${status})`);
    this.name = "ParseError";
    this.status = status;
    this.rawBody = rawBody;
    this.cause = cause;
  }
}
