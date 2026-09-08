import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoginForm, RegisterForm } from "@/modules/auth";
import { authService } from "@/modules/auth/services/auth.service";

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
  let registerSpy: ReturnType<typeof vi.spyOn>;
  let loginSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    push.mockReset();
    registerSpy = vi.spyOn(authService, "register").mockResolvedValue({ status: 201, data: null });
    loginSpy = vi.spyOn(authService, "login").mockResolvedValue({ status: 200, data: null });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    registerSpy.mockRestore();
    loginSpy.mockRestore();
  });

  it.each(["login", "register"] as const)(
    "%s não redireciona depois de sair da tela",
    async (kind) => {
      const { form, unmount } = renderValidForm(kind);
      fireEvent.submit(form);
      unmount();
      
      await act(async () => {
        await Promise.resolve();
      });
      act(() => {
        vi.advanceTimersByTime(600);
      });
      
      expect(push).not.toHaveBeenCalled();
    },
  );

  it.each(["login", "register"] as const)(
    "%s ignora submissões concorrentes",
    async (kind) => {
      const { form } = renderValidForm(kind);
      fireEvent.submit(form);
      fireEvent.submit(form);
      
      await act(async () => {
        await Promise.resolve();
      });
      act(() => {
        vi.advanceTimersByTime(2100);
      });
      
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

  it("não mantém sucesso antigo quando o cadastro passa a ser inválido", async () => {
    const { form } = renderValidForm("register");
    fireEvent.submit(form);
    
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });
    
    fireEvent.change(screen.getByLabelText("Nome completo"), {
      target: { value: "" },
    });
    fireEvent.submit(form);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByText(/Informe seu nome completo/)).toBeDefined();
  });
});
