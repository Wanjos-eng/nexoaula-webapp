import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import InicioPage from "@/app/(app)/inicio/page";

vi.mock("@/modules/auth", () => ({
  useAuthSession: () => ({
    user: { id: "ana", fullName: "Ana Silva" },
  }),
}));

vi.mock("@/modules/groups/useRemote", () => ({
  useRemote: () => ({
    data: {
      groups: [],
      events: [],
      tutoring: [],
    },
    error: undefined,
    loading: false,
    reload: vi.fn(),
  }),
}));

describe("InicioPage", () => {
  it("apresenta um resumo real sem preencher a conta com dados fictícios", () => {
    render(<InicioPage />);

    expect(
      screen.getByRole("heading", { name: "Olá, Ana" }),
    ).toBeDefined();
    expect(
      screen.getByRole("heading", { name: "Próximo compromisso" }),
    ).toBeDefined();
    expect(
      screen.getByText("Sua agenda está livre"),
    ).toBeDefined();
    expect(
      screen.getByText("Nenhuma comunidade ainda"),
    ).toBeDefined();
    expect(
      screen.getByText("Nenhuma tutoria reservada"),
    ).toBeDefined();

    expect(screen.queryByText(/Modelagem e Simulação Discreta/)).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
});
