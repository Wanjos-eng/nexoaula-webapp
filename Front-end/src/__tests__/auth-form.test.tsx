import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthForm } from "@/components/auth/AuthForm";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("AuthForm", () => {
  beforeEach(() => {
    push.mockReset();
  });

  it("alterna a visibilidade da senha com um controle rotulado", () => {
    render(<AuthForm mode="login" />);

    const password = screen.getByLabelText("Senha") as HTMLInputElement;
    fireEvent.click(screen.getByRole("button", { name: "Mostrar senha" }));

    expect(password.type).toBe("text");
    expect(screen.getByRole("button", { name: "Ocultar senha" })).toBeDefined();
  });

  it("navega para o início ao enviar credenciais simuladas válidas", () => {
    render(<AuthForm mode="login" />);

    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "lucas@exemplo.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "senha-segura" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(push).toHaveBeenCalledWith("/inicio");
  });

  it("expõe erros de cadastro sem navegar", () => {
    render(<AuthForm mode="signup" />);

    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));

    expect(screen.getByText("Informe seu nome completo.")).toBeDefined();
    expect(screen.getByText("Informe um e-mail válido.")).toBeDefined();
    expect(push).not.toHaveBeenCalled();
  });
});
