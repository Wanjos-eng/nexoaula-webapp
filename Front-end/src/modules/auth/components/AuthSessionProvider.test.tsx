import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, NetworkError } from "@/lib/api";
import { authService } from "../services/auth.service";
import { AuthSessionProvider, useAuthSession } from "./AuthSessionProvider";

const replace = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const sessionResponse = {
  status: 200,
  data: {
    id: "user-1",
    email: "lucas@example.com",
    fullName: "Lucas Almeida",
    createdAt: "2026-09-08T12:00:00Z",
  },
};

function SessionConsumer() {
  const { user } = useAuthSession();
  return <p>Sessão de {user.email}</p>;
}

describe("AuthSessionProvider", () => {
  beforeEach(() => replace.mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("mantém a área interna bloqueada até restaurar o usuário público", async () => {
    let resolveRequest: (value: typeof sessionResponse) => void = () => undefined;
    vi.spyOn(authService, "me").mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    render(
      <AuthSessionProvider>
        <SessionConsumer />
      </AuthSessionProvider>,
    );

    expect(screen.getByText("Verificando sua sessão…")).toBeDefined();
    expect(screen.queryByText(/Sessão de/)).toBeNull();
    resolveRequest(sessionResponse);

    expect(await screen.findByText("Sessão de lucas@example.com")).toBeDefined();
  });

  it("redireciona sessão ausente ou expirada ao login", async () => {
    vi.spyOn(authService, "me").mockRejectedValueOnce(
      new ApiError(401, "Unauthorized", {}),
    );

    render(<AuthSessionProvider><p>Área interna</p></AuthSessionProvider>);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(screen.queryByText("Área interna")).toBeNull();
  });

  it("oferece nova tentativa após uma falha recuperável", async () => {
    const me = vi.spyOn(authService, "me")
      .mockRejectedValueOnce(new NetworkError())
      .mockResolvedValueOnce(sessionResponse);

    render(
      <AuthSessionProvider>
        <SessionConsumer />
      </AuthSessionProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByText("Sessão de lucas@example.com")).toBeDefined();
    expect(me).toHaveBeenCalledTimes(2);
  });
});
