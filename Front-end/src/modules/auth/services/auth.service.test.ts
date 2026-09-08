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
