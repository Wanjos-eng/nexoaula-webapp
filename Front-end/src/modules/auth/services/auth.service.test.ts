import { afterEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api";

import { authService } from "./auth.service";

afterEach(() => vi.restoreAllMocks());

describe("authService.register", () => {
  it("envia somente o contrato público de cadastro pelo cliente compartilhado", async () => {
    const response = {
      status: 201,
      data: {
        id: "user-1",
        email: "lucas@example.com",
        fullName: "Lucas Almeida",
        createdAt: "2026-09-08T12:00:00Z",
      },
    };
    const post = vi.spyOn(apiClient, "post").mockResolvedValue(response);
    const controller = new AbortController();
    const payload = {
      fullName: "Lucas Almeida",
      email: "lucas@example.com",
      password: "senha-segura",
    };

    await expect(authService.register(payload, controller.signal)).resolves.toEqual(response);
    expect(post).toHaveBeenCalledWith("/v1/auth/register", {
      body: payload,
      signal: controller.signal,
    });
  });
});

describe("sessão autenticada", () => {
  const response = {
    status: 200,
    data: {
      id: "user-1",
      email: "lucas@example.com",
      fullName: "Lucas Almeida",
      createdAt: "2026-09-08T12:00:00Z",
    },
  };

  it("envia login pelo cliente compartilhado e transporta o sinal", async () => {
    const post = vi.spyOn(apiClient, "post").mockResolvedValue(response);
    const controller = new AbortController();
    const credentials = { email: "lucas@example.com", password: "senha-segura" };

    await expect(authService.login(credentials, controller.signal)).resolves.toEqual(response);
    expect(post).toHaveBeenCalledWith("/v1/auth/login", {
      body: credentials,
      signal: controller.signal,
    });
  });

  it("restaura somente o usuário público pelo endpoint /me", async () => {
    const get = vi.spyOn(apiClient, "get").mockResolvedValue(response);
    const controller = new AbortController();

    await expect(authService.me(controller.signal)).resolves.toEqual(response);
    expect(get).toHaveBeenCalledWith("/v1/auth/me", { signal: controller.signal });
  });
});
