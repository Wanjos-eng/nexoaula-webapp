import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoginForm, RegisterForm } from "@/modules/auth";

const push = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

function renderValidForm(kind: "login" | "register") {
  const result = render(kind === "login" ? <LoginForm /> : <RegisterForm />);
  fireEvent.change(screen.getByLabelText("E-mail"), {
    target: { value: "estudante@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Senha"), {
    target: { value: "senha-demonstrativa" },
  });
  if (kind === "register") {
    fireEvent.change(screen.getByLabelText("Nome completo"), {
      target: { value: "Estudante Exemplo" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar senha"), {
      target: { value: "senha-demonstrativa" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
  }
  const submit = screen.getByRole("button", {
    name: kind === "login" ? "Entrar" : "Criar conta",
  });
  const form = submit.closest("form")!;
  return { ...result, form };
}

describe("ciclo de vida da submissão demonstrativa", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    push.mockReset();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it.each(["login", "register"] as const)(
    "%s não redireciona depois de sair da tela",
    (kind) => {
      const { form, unmount } = renderValidForm(kind);
      fireEvent.submit(form);
      unmount();
      act(() => vi.advanceTimersByTime(600));
      expect(push).not.toHaveBeenCalled();
    },
  );

  it.each(["login", "register"] as const)(
    "%s ignora submissões concorrentes",
    (kind) => {
      const { form } = renderValidForm(kind);
      fireEvent.submit(form);
      fireEvent.submit(form);
      act(() => vi.advanceTimersByTime(600));
      expect(push).toHaveBeenCalledTimes(1);
      expect(screen.queryByText("Informe um e-mail válido.")).toBeNull();
    },
  );

  it("limpa o aviso de recuperação ao submeter login inválido", () => {
    render(<LoginForm />);
    fireEvent.click(screen.getByRole("button", { name: "Esqueci minha senha" }));
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByText("Informe um e-mail válido.")).toBeDefined();
  });

  it("não mantém sucesso antigo quando o cadastro passa a ser inválido", () => {
    const { form } = renderValidForm("register");
    fireEvent.submit(form);
    act(() => vi.advanceTimersByTime(600));
    fireEvent.change(screen.getByLabelText("Nome completo"), {
      target: { value: "" },
    });
    fireEvent.submit(form);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByText(/Informe seu nome completo/)).toBeDefined();
  });
});
