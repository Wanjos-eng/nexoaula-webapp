import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreateGroupFlow } from "./CreateGroupFlow";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
afterEach(() => {
  vi.restoreAllMocks();
  push.mockReset();
});

function change(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
function fillIdentity() {
  change("Nome do grupo *", "Estudos de MSD");
  change("Disciplina *", "mock-msd");
  change("Turma (opcional)", "mock-msd-c8");
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
}

describe("CreateGroupFlow", () => {
  it("bloqueia etapa incompleta e permite focar o campo pelo resumo de erros", () => {
    render(<CreateGroupFlow />);
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    const alert = screen.getByRole("alert");
    expect(document.activeElement).toBe(alert);
    fireEvent.click(
      within(alert).getByRole("link", { name: /Informe um nome/ }),
    );
    expect(document.activeElement).toBe(
      screen.getByLabelText("Nome do grupo *"),
    );
    change("Nome do grupo *", "Primeira letra");
    expect(document.activeElement).toBe(
      screen.getByLabelText("Nome do grupo *"),
    );
    expect(screen.queryByRole("group", { name: "Visibilidade" })).toBeNull();
  });
  it("preserva dados, edita resumo e conclui sem API ou armazenamento", () => {
    const storage = vi.spyOn(Storage.prototype, "setItem");
    const fetch = vi.spyOn(globalThis, "fetch");
    render(<CreateGroupFlow />);
    fillIdentity();
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "Definir acesso ao grupo" }),
    );
    fireEvent.click(screen.getByRole("radio", { name: /Não listado/ }));
    fireEvent.click(screen.getByRole("radio", { name: /Somente por convite/ }));
    change("Capacidade de participantes (opcional)", "25");
    change("Regras do grupo (opcional)", "Respeitar os colegas.");
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(
      (screen.getByLabelText("Nome do grupo *") as HTMLInputElement).value,
    ).toBe("Estudos de MSD");
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("button", { name: "Revisar grupo" }));
    expect(screen.getByText("C8 · 2026.2")).toBeDefined();
    expect(screen.getByText("Somente por convite")).toBeDefined();
    fireEvent.click(
      screen.getByRole("button", { name: "Editar informações do grupo" }),
    );
    change("Nome do grupo *", "MSD revisado");
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("button", { name: "Revisar grupo" }));
    fireEvent.click(screen.getByRole("button", { name: "Concluir simulação" }));
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "Simulação concluída" }),
    );
    expect(screen.getByText("MSD revisado")).toBeDefined();
    expect(screen.getByText(/Nenhum dado foi salvo/)).toBeDefined();
    expect(screen.queryByRole("link", { name: /Ir para o grupo/ })).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    expect(storage).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Iniciar outra simulação" }),
    );
    expect(
      (screen.getByLabelText("Nome do grupo *") as HTMLInputElement).value,
    ).toBe("");
  });
  it("rejeita capacidade inválida sem perder regras", () => {
    render(<CreateGroupFlow />);
    fillIdentity();
    change("Capacidade de participantes (opcional)", "-2");
    change("Regras do grupo (opcional)", "Respeito.");
    fireEvent.click(screen.getByRole("button", { name: "Revisar grupo" }));
    expect(
      screen
        .getByLabelText("Capacidade de participantes (opcional)")
        .getAttribute("aria-invalid"),
    ).toBe("true");
    expect(
      (
        screen.getByLabelText(
          "Regras do grupo (opcional)",
        ) as HTMLTextAreaElement
      ).value,
    ).toBe("Respeito.");
  });
  it("remove turma incompatível e aceita disciplina sem turma", () => {
    render(<CreateGroupFlow />);
    change("Nome do grupo *", "Estruturas");
    change("Disciplina *", "mock-msd");
    change("Turma (opcional)", "mock-msd-c8");
    change("Disciplina *", "mock-ed");
    expect(
      (screen.getByLabelText("Turma (opcional)") as HTMLSelectElement).value,
    ).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("group", { name: "Visibilidade" })).toBeDefined();
  });
  it("confirma descarte e permite cancelar o cancelamento sem perder dados", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<CreateGroupFlow />);
    change("Nome do grupo *", "Rascunho");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(push).not.toHaveBeenCalled();
    expect(
      (screen.getByLabelText("Nome do grupo *") as HTMLInputElement).value,
    ).toBe("Rascunho");
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(push).toHaveBeenCalledWith("/grupos");
  });
  it("descarta rascunho ao desmontar a tela", () => {
    const { unmount } = render(<CreateGroupFlow />);
    change("Nome do grupo *", "Temporário");
    unmount();
    render(<CreateGroupFlow />);
    expect(
      (screen.getByLabelText("Nome do grupo *") as HTMLInputElement).value,
    ).toBe("");
  });
});
