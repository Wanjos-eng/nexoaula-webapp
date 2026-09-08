import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoginForm, RegisterForm, isValidEmail, validateLoginForm, validateRegisterForm } from "@/modules/auth";
import { authService } from "@/modules/auth/services/auth.service";
import { ApiError, NetworkError } from "@/lib/api";

const push = vi.fn();
const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
}));

describe("LoginForm", () => {
  let loginSpy: ReturnType<typeof vi.spyOn>;
  const loginResponse = {
    status: 200,
    data: {
      id: "user-1",
      email: "lucas@exemplo.com",
      fullName: "Lucas Silva",
      createdAt: "2026-09-08T12:00:00Z",
    },
  };

  beforeEach(() => {
    vi.useFakeTimers();
    push.mockReset();
    replace.mockReset();
    loginSpy = vi.spyOn(authService, "login");
  });

  afterEach(() => {
    vi.useRealTimers();
    loginSpy.mockRestore();
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

  it("simula loading, sucesso e navega para /inicio com credenciais preenchidas, respeitando o atraso", async () => {
    loginSpy.mockResolvedValueOnce(loginResponse);

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "lucas@exemplo.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "senha-segura" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(screen.getByRole("button", { name: "Entrando..." })).toBeDefined();

    await act(async () => {
      await Promise.resolve();
    });

    expect(
      screen.getByText(/Autenticado com sucesso/i),
    ).toBeDefined();

    expect(push).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(replace).toHaveBeenCalledWith("/inicio");
  });

  it("simula falha genérica e permite recuperação na segunda tentativa", async () => {
    loginSpy.mockRejectedValueOnce(new NetworkError());

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "erro@demo.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "qualquer-senha" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText(/Erro de conexão/i)).toBeDefined();
    expect(push).not.toHaveBeenCalled();

    loginSpy.mockResolvedValueOnce(loginResponse);

    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "lucas@exemplo.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText(/Autenticado com sucesso/i)).toBeDefined();
  });

  it("exibe mensagem genérica ao receber erro 401 de credenciais inválidas", async () => {
    loginSpy.mockRejectedValueOnce(new ApiError(401, "Unauthorized", {}));

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "lucas@exemplo.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "senha-errada" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText(/E-mail ou senha incorretos/i)).toBeDefined();
    expect(push).not.toHaveBeenCalled();
  });

  it("diferencia falha de proteção CSRF de credenciais inválidas", async () => {
    loginSpy.mockRejectedValueOnce(new ApiError(403, "Forbidden", {}));

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "bloqueado@exemplo.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "senha1234" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText(/Não foi possível validar esta solicitação/i)).toBeDefined();
    expect(push).not.toHaveBeenCalled();
  });

  it("exibe indisponibilidade temporária do servidor", async () => {
    loginSpy.mockRejectedValueOnce(new ApiError(503, "Service Unavailable", {}));
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "lucas@exemplo.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "senha1234" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await act(async () => Promise.resolve());

    expect(screen.getByText(/temporariamente indisponível/i)).toBeDefined();
  });

  it("exibe mensagem de erro inesperado para exceções desconhecidas", async () => {
    loginSpy.mockRejectedValueOnce(new Error("unknown failure"));

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "lucas@exemplo.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "senha1234" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText(/Ocorreu um erro inesperado/i)).toBeDefined();
    expect(push).not.toHaveBeenCalled();
  });

  it("possui link para navegação para a página de cadastro", () => {
    render(<LoginForm />);

    const signupLink = screen.getByRole("link", { name: "Criar conta" });
    expect(signupLink.getAttribute("href")).toBe("/cadastro");
  });
});

describe("RegisterForm", () => {
  let registerSpy: ReturnType<typeof vi.spyOn>;
  const registerResponse = {
    status: 201,
    data: {
      id: "user-1",
      email: "lucas@exemplo.com",
      fullName: "Lucas Silva",
      createdAt: "2026-09-08T12:00:00Z",
    },
  };

  beforeEach(() => {
    vi.useFakeTimers();
    push.mockReset();
    replace.mockReset();
    registerSpy = vi.spyOn(authService, "register");
  });

  afterEach(() => {
    vi.useRealTimers();
    registerSpy.mockRestore();
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

  it("cria conta com sucesso e navega para /login, respeitando o atraso", async () => {
    registerSpy.mockResolvedValueOnce(registerResponse);

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

    await act(async () => {
      // Resolve promise
      await Promise.resolve();
    });

    expect(
      screen.getByText(/Conta criada com sucesso/i),
    ).toBeDefined();

    expect(push).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(push).toHaveBeenCalledWith("/login");
  });

  it("mostra erro de e-mail em uso (409) e permite nova tentativa", async () => {
    registerSpy.mockRejectedValueOnce(new ApiError(409, "Conflict", {}));

    render(<RegisterForm />);

    fireEvent.change(screen.getByLabelText("Nome completo"), {
      target: { value: "Lucas Silva" },
    });
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "erro@demo.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "senha1234" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar senha"), {
      target: { value: "senha1234" },
    });
    fireEvent.click(screen.getByRole("checkbox"));

    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getAllByText(/Este e-mail já está em uso/i).length).toBeGreaterThan(0);
    expect(push).not.toHaveBeenCalled();

    registerSpy.mockResolvedValueOnce(registerResponse);
    
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "novo@exemplo.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText(/Conta criada com sucesso/i)).toBeDefined();
  });

  it("mostra falha de conexão", async () => {
    registerSpy.mockRejectedValueOnce(new NetworkError());

    render(<RegisterForm />);

    fireEvent.change(screen.getByLabelText("Nome completo"), {
      target: { value: "Lucas Silva" },
    });
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "teste@demo.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "senha1234" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar senha"), {
      target: { value: "senha1234" },
    });
    fireEvent.click(screen.getByRole("checkbox"));

    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText(/Falha na conexão/i)).toBeDefined();
  });

  it("mostra indisponibilidade temporária retornada pela API", async () => {
    registerSpy.mockRejectedValueOnce(new ApiError(503, "Service Unavailable", {}));

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

    await act(async () => Promise.resolve());

    expect(screen.getByText(/temporariamente indisponível/i)).toBeDefined();
  });

  it("possui link para navegação para a página de login", () => {
    render(<RegisterForm />);

    const loginLink = screen.getByRole("link", { name: "Entrar" });
    expect(loginLink.getAttribute("href")).toBe("/login");
  });
});

describe("authSchemas", () => {
  describe("isValidEmail", () => {
    it("valida emails corretamente", () => {
      expect(isValidEmail("aluno@exemplo.com")).toBe(true);
      expect(isValidEmail("")).toBe(false);
      expect(isValidEmail("@")).toBe(false);
      expect(isValidEmail("aluno@")).toBe(false);
      expect(isValidEmail("@exemplo.com")).toBe(false);
      expect(isValidEmail("aluno @exemplo.com")).toBe(false);
      expect(isValidEmail("aluno@ exemplo.com")).toBe(false);
    });
  });

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

  it("aplica no cliente os limites públicos do contrato de cadastro", () => {
    const invalidData = new FormData();
    invalidData.set("fullName", "Nome válido");
    invalidData.set("email", "aluno@exemplo.com");
    invalidData.set("password", "🔒".repeat(19));
    invalidData.set("confirmPassword", "🔒".repeat(19));
    invalidData.set("terms", "on");

    const result = validateRegisterForm(invalidData);

    expect(result.isValid).toBe(false);
    expect(result.errors.password).toBe("A senha deve ter no máximo 72 bytes.");
  });
});
