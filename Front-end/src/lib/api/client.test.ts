import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "./client";
import { ApiError, NetworkError, ParseError, TimeoutError } from "./errors";

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
    const headers = init?.headers as Record<string, string>;
    expect(headers["X-NexoAula-CSRF"]).toBeUndefined();
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
    const headers = init?.headers as Record<string, string>;
    expect(headers["X-NexoAula-CSRF"]).toBe("1");
  });

  it("envia body JSON serializado e Content-Type correto", async () => {
    const loginBody = { email: "user@test.com", password: "secret" };
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "u1" }));

    await apiClient.post("/v1/auth/login", { body: loginBody });

    const [, init] = mockFetch.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
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
    const headers = init?.headers as Record<string, string>;
    expect(headers["X-NexoAula-CSRF"]).toBe("1");
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

    await expect(apiClient.get("/v1/auth/me")).rejects.toThrow(ApiError);

    try {
      await apiClient.get("/v1/auth/me");
    } catch (error) {
      // O mock já foi consumido, vamos verificar com o primeiro throw
    }

    // Verificação detalhada
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
    const headers = init?.headers as Record<string, string>;
    expect(headers["X-Custom"]).toBe("value");
    expect(headers["Accept"]).toBe("application/json");
  });
});
