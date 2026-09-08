import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "./client";
import {
  ApiError,
  NetworkError,
  ParseError,
  RequestAbortedError,
  TimeoutError,
} from "./errors";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type MockFetch = ReturnType<typeof vi.fn<typeof globalThis.fetch>>;

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    statusText: "OK",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function noContentResponse(): Response {
  return new Response(null, { status: 204, statusText: "No Content" });
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

let mockFetch: MockFetch;

beforeEach(() => {
  mockFetch = vi.fn<typeof globalThis.fetch>();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

describe("apiClient.get", () => {
  it("retorna dados parseados para uma resposta 200 com JSON", async () => {
    const payload = { id: "u1", name: "Lucas Andrade" };
    mockFetch.mockResolvedValueOnce(jsonResponse(payload));

    const { data, status } = await apiClient.get<typeof payload>("/v1/auth/me");

    expect(status).toBe(200);
    expect(data).toEqual(payload);
  });

  it("chama /api como prefixo de mesma origem", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}));

    await apiClient.get("/v1/auth/me");

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/v1/auth/me");
  });

  it("NÃO envia header CSRF em GET", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}));

    await apiClient.get("/v1/auth/me");

    const [, init] = mockFetch.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.has("X-NexoAula-CSRF")).toBe(false);
  });

  it("envia credentials: same-origin", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}));

    await apiClient.get("/v1/auth/me");

    const [, init] = mockFetch.mock.calls[0];
    expect(init?.credentials).toBe("same-origin");
  });
});

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

describe("apiClient.post", () => {
  it("envia header CSRF em mutações", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await apiClient.post("/v1/auth/login", {
      body: { email: "user@test.com", password: "secret" },
    });

    const [, init] = mockFetch.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.get("X-NexoAula-CSRF")).toBe("1");
  });

  it("envia body JSON serializado e Content-Type correto", async () => {
    const loginBody = { email: "user@test.com", password: "secret" };
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "u1" }));

    await apiClient.post("/v1/auth/login", { body: loginBody });

    const [, init] = mockFetch.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(init?.body).toBe(JSON.stringify(loginBody));
  });

  it("trata resposta 204 No Content (ex: logout)", async () => {
    mockFetch.mockResolvedValueOnce(noContentResponse());

    const { data, status } = await apiClient.post("/v1/auth/logout");

    expect(status).toBe(204);
    expect(data).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// PUT, PATCH, DELETE — CSRF
// ---------------------------------------------------------------------------

describe("métodos de mutação enviam CSRF", () => {
  it.each([
    ["put" as const, "PUT"],
    ["patch" as const, "PATCH"],
    ["del" as const, "DELETE"],
  ])("apiClient.%s envia X-NexoAula-CSRF: 1", async (method, httpMethod) => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await apiClient[method]("/v1/resource/1");

    const [, init] = mockFetch.mock.calls[0];
    expect(init?.method).toBe(httpMethod);
    const headers = new Headers(init?.headers);
    expect(headers.get("X-NexoAula-CSRF")).toBe("1");
  });
});

// ---------------------------------------------------------------------------
// Erros HTTP
// ---------------------------------------------------------------------------

describe("erros HTTP", () => {
  it("lança ApiError com status, statusText e body para 4xx", async () => {
    const errorBody = { detail: "Credenciais inválidas" };
    mockFetch.mockResolvedValueOnce(
      jsonResponse(errorBody, { status: 401, statusText: "Unauthorized" }),
    );

    try {
      await apiClient.get("/v1/auth/me");
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      const apiError = error as ApiError;
      expect(apiError.status).toBe(401);
      expect(apiError.statusText).toBe("Unauthorized");
      expect(apiError.body).toEqual(errorBody);
    }
  });

  it("lança ApiError com body null se resposta de erro não for JSON", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response("Internal Server Error", {
        status: 500,
        statusText: "Internal Server Error",
      }),
    );

    try {
      await apiClient.get("/v1/failing");
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      const apiError = error as ApiError;
      expect(apiError.status).toBe(500);
      expect(apiError.body).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// Network error
// ---------------------------------------------------------------------------

describe("NetworkError", () => {
  it("lança NetworkError quando fetch falha (offline/DNS)", async () => {
    mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    try {
      await apiClient.get("/v1/auth/me");
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(NetworkError);
      expect((error as NetworkError).message).toBe("Network request failed");
    }
  });
});

// ---------------------------------------------------------------------------
// Timeout
// ---------------------------------------------------------------------------

describe("TimeoutError", () => {
  it("lança TimeoutError quando a requisição excede o timeout", async () => {
    mockFetch.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          // Simula abort por timeout
          setTimeout(() => {
            const abortError = new DOMException("The operation was aborted.", "AbortError");
            reject(abortError);
          }, 10);
        }),
    );

    try {
      await apiClient.get("/v1/slow", { timeout: 5 });
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(TimeoutError);
      expect((error as TimeoutError).message).toContain("timed out");
    }
  });
});

describe("cancelamento externo", () => {
  it("não classifica um cancelamento do chamador como timeout", async () => {
    const controller = new AbortController();
    mockFetch.mockImplementationOnce((_input, init) => {
      return new Promise((_, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    });

    const request = apiClient.get("/v1/auth/me", {
      signal: controller.signal,
    });
    controller.abort();

    await expect(request).rejects.toBeInstanceOf(RequestAbortedError);
  });
});

// ---------------------------------------------------------------------------
// Parse error
// ---------------------------------------------------------------------------

describe("ParseError", () => {
  it("lança ParseError quando resposta 200 não é JSON válido", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response("<html>not json</html>", {
        status: 200,
        statusText: "OK",
        headers: { "Content-Type": "text/html" },
      }),
    );

    try {
      await apiClient.get("/v1/broken");
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ParseError);
      const parseError = error as ParseError;
      expect(parseError.status).toBe(200);
      expect(parseError.rawBody).toBe("<html>not json</html>");
    }
  });
});

// ---------------------------------------------------------------------------
// Headers extras
// ---------------------------------------------------------------------------

describe("headers customizados", () => {
  it("permite headers adicionais sem sobrescrever os obrigatórios", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}));

    await apiClient.get("/v1/data", {
      headers: { "X-Custom": "value" },
    });

    const [, init] = mockFetch.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.get("X-Custom")).toBe("value");
    expect(headers.get("Accept")).toBe("application/json");
  });

  it("impede sobrescrever headers obrigatórios", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}));

    await apiClient.post("/v1/auth/login", {
      body: {},
      headers: {
        Accept: "text/html",
        "Content-Type": "text/plain",
        "X-NexoAula-CSRF": "0",
      },
    });

    const [, init] = mockFetch.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.get("Accept")).toBe("application/json");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("X-NexoAula-CSRF")).toBe("1");
  });
});

describe("validação da requisição", () => {
  it.each(["v1/auth/me", "//example.com/escape"])(
    "rejeita caminho fora do prefixo interno: %s",
    async (path) => {
      await expect(apiClient.get(path)).rejects.toThrow(
        "API path must start with a single slash",
      );
      expect(mockFetch).not.toHaveBeenCalled();
    },
  );

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejeita timeout inválido: %s",
    async (timeout) => {
      await expect(apiClient.get("/v1/auth/me", { timeout })).rejects.toThrow(
        "Request timeout must be a positive number",
      );
      expect(mockFetch).not.toHaveBeenCalled();
    },
  );
});
