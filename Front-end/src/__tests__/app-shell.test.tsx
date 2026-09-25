import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/layout/AppShell";

vi.mock("@/modules/auth/components/AuthSessionProvider", () => ({
  useAuthSession: () => ({
    logout: vi.fn(async () => undefined),
    user: { id: "ana", fullName: "Ana Silva" },
  }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/inicio",
}));

describe("AppShell", () => {
  it("marca o item atual e mantém a navegação rotulada", () => {
    render(
      <AppShell>
        <p>Conteúdo</p>
      </AppShell>,
    );

    expect(screen.getByLabelText("Navegação principal")).toBeDefined();
    expect(screen.getByText("Ana Silva")).toBeDefined();
    expect(screen.getByText("Olá, Ana")).toBeDefined();
    expect(screen.getByRole("link", { name: "Início" }).getAttribute("aria-current")).toBe(
      "page",
    );
  });

  it("abre e fecha o menu com Escape devolvendo o foco", () => {
    render(
      <AppShell>
        <p>Conteúdo</p>
      </AppShell>,
    );

    const trigger = screen.getByRole("button", { name: "Abrir menu de navegação" });
    fireEvent.click(trigger);

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Fechar menu" }));

    fireEvent.keyDown(document, { key: "Escape" });

    expect(document.activeElement).toBe(trigger);
  });

  it("mantém Tab e Shift+Tab dentro do drawer aberto", () => {
    render(
      <AppShell>
        <p>Conteúdo</p>
      </AppShell>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Abrir menu de navegação" }),
    );

    const first = screen.getByRole("button", { name: "Fechar menu" });
    const last = screen.getByRole("button", { name: "Sair" });

    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });
});
