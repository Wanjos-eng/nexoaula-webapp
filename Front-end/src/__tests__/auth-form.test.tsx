import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoginForm, RegisterForm, validateLoginForm, validateRegisterForm } from "@/modules/auth";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("LoginForm", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    push.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("alterna a visibilidade da senha com um controle rotulado", () => {
    render(<LoginForm />);

    const password = screen.getByLabelText("Senha") as HTMLInputElement;
    fireEvent.click(screen.getByRole("button", { name: "Mostrar senha" }));

    expect(password.type).toBe("text");
    expect(screen.getByRole("button", { name: "Ocultar senha" })).toBeDefined();
  });

  it("exibe erros de validação ao tentar submeter formulário em branco", () => {
    render(<LoginForm />);

    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(screen.getByText("Informe um e-mail válido.")).toBeDefined();
    expect(screen.getByText("Informe sua senha.")).toBeDefined();
    expect(push).not.toHaveBeenCalled();
  });

  it("exibe aviso informativo ao clicar em esqueci minha senha", () => {
    render(<LoginForm />);

    fireEvent.click(screen.getByRole("button", { name: "Esqueci minha senha" }));

    expect(
      screen.getByText(/Recuperação de senha: a funcionalidade será integrada/i),
    ).toBeDefined();
  });

  it("simula loading, sucesso e navega para /inicio com credenciais preenchidas", () => {
    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "lucas@exemplo.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "senha-segura" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(screen.getByRole("button", { name: "Entrando..." })).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(
      screen.getByText(/Acesso demonstrativo confirmado/i),
    ).toBeDefined();
    expect(push).toHaveBeenCalledWith("/inicio");
  });

  it("possui link para navegação para a página de cadastro", () => {
    render(<LoginForm />);

    const signupLink = screen.getByRole("link", { name: "Criar conta" });
    expect(signupLink.getAttribute("href")).toBe("/cadastro");
  });
});

describe("RegisterForm", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    push.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("exibe erros de campos obrigatórios ao submeter em branco", () => {
    render(<RegisterForm />);

    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));

    expect(screen.getByText(/Informe seu nome completo/i)).toBeDefined();
    expect(screen.getByText("Informe um e-mail válido.")).toBeDefined();
    expect(screen.getByText("A senha deve ter pelo menos 8 caracteres.")).toBeDefined();
    expect(push).not.toHaveBeenCalled();
  });

  it("valida senhas não coincidentes", () => {
    render(<RegisterForm />);

    fireEvent.change(screen.getByLabelText("Nome completo"), {
      target: { value: "Lucas Silva" },
    });
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "lucas@exemplo.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "senha1234" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar senha"), {
      target: { value: "senha5678" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));

    expect(screen.getByText("As senhas não coincidem.")).toBeDefined();
    expect(push).not.toHaveBeenCalled();
  });

  it("simula criação de conta com sucesso e navega para /inicio", () => {
    render(<RegisterForm />);

    fireEvent.change(screen.getByLabelText("Nome completo"), {
      target: { value: "Lucas Silva" },
    });
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "lucas@exemplo.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "senha1234" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar senha"), {
      target: { value: "senha1234" },
    });
    fireEvent.click(screen.getByRole("checkbox"));

    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));

    expect(screen.getByRole("button", { name: "Criando conta..." })).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(
      screen.getByText(/Conta demonstrativa criada com sucesso/i),
    ).toBeDefined();
    expect(push).toHaveBeenCalledWith("/inicio");
  });

  it("possui link para navegação para a página de login", () => {
    render(<RegisterForm />);

    const loginLink = screen.getByRole("link", { name: "Entrar" });
    expect(loginLink.getAttribute("href")).toBe("/login");
  });
});

describe("authSchemas", () => {
  it("valida dados de login corretamente", () => {
    const validData = new FormData();
    validData.set("email", "estudante@ufba.br");
    validData.set("password", "12345678");

    const result = validateLoginForm(validData);
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("valida dados de cadastro corretamente", () => {
    const validData = new FormData();
    validData.set("fullName", "Maria Santos");
    validData.set("email", "maria@ufba.br");
    validData.set("password", "12345678");
    validData.set("confirmPassword", "12345678");
    validData.set("terms", "on");

    const result = validateRegisterForm(validData);
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });
});
