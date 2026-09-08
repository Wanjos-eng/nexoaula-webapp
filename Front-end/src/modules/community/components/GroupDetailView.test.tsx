import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { groupDetailsMap } from "@/mocks/community/group-detail";
import { GroupDetailView } from "./GroupDetailView";

describe("GroupDetailView", () => {
  const mockGroup = groupDetailsMap["comunidade-msd-c8"];
  const nonMemberGroup = groupDetailsMap["estruturas-dados-monitoria"];

  it("renderiza o cabeçalho do grupo, metadados da disciplina e canais", () => {
    render(<GroupDetailView group={mockGroup} />);

    expect(screen.getByRole("heading", { name: "Comunidade MSD — C8" })).toBeDefined();
    expect(screen.getByText("Modelagem e Simulação Discreta")).toBeDefined();
    expect(screen.getByText("Turma C8")).toBeDefined();
    expect(screen.getByText("12 de 20 membros")).toBeDefined();
    expect(screen.getByRole("tab", { name: "#filas-mm1" })).toBeDefined();
    expect(screen.getByRole("tab", { name: "#geral" })).toBeDefined();
  });

  it("alterna entre tópicos e permite envio de mensagem simulada", () => {
    render(<GroupDetailView group={mockGroup} />);

    const geralTab = screen.getByRole("tab", { name: "#geral" });
    fireEvent.click(geralTab);

    expect(geralTab.getAttribute("aria-current")).toBe("page");
    expect(screen.getByText("Avisos gerais, combinados do grupo e orientações da disciplina.")).toBeDefined();

    const input = screen.getByPlaceholderText("Escreva em #geral...");
    fireEvent.change(input, { target: { value: "Minha primeira dúvida no canal geral" } });

    const submitButton = screen.getByRole("button", { name: "Enviar mensagem" });
    fireEvent.click(submitButton);

    expect(screen.getByText("Mensagem adicionada ao protótipo (sem persistência no servidor).")).toBeDefined();
    expect(screen.getByText("Minha primeira dúvida no canal geral")).toBeDefined();
  });

  it("permite registrar interesse no próximo encontro com feedback", () => {
    render(<GroupDetailView group={mockGroup} />);

    const interestButton = screen.getByRole("button", { name: "Tenho interesse" });
    fireEvent.click(interestButton);

    expect(screen.getByText("Interesse registrado no protótipo.")).toBeDefined();
    expect(screen.getByRole("button", { name: "Interesse confirmado" })).toBeDefined();
  });

  it("abre e fecha o painel de participantes e responde à tecla Escape", async () => {
    render(<GroupDetailView group={mockGroup} />);

    const participantsButton = screen.getByRole("button", { name: "Ver participantes" });
    fireEvent.click(participantsButton);

    const dialog = screen.getByRole("dialog", { name: "Participantes" });
    expect(dialog).toBeDefined();
    expect(within(dialog).getByText("Lucas Andrade")).toBeDefined();
    expect(within(dialog).getByText("Ana Souza")).toBeDefined();

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("exibe o painel do organizador para gerenciar grupo", () => {
    render(<GroupDetailView group={mockGroup} />);

    const manageButtons = screen.getAllByRole("button", { name: "Gerenciar grupo" });
    fireEvent.click(manageButtons[0]);

    const dialog = screen.getByRole("dialog", { name: "Gerenciar grupo" });
    expect(dialog).toBeDefined();
    expect(within(dialog).getByText("Visão do organizador")).toBeDefined();
    expect(within(dialog).getByText("Configurações do grupo")).toBeDefined();
  });

  it("exibe o estado de grupo não encontrado quando group é nulo", () => {
    render(<GroupDetailView group={null} />);

    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.getByRole("heading", { name: "Grupo de estudo não encontrado" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Explorar comunidades disponíveis" })).toBeDefined();
  });

  it("exibe aviso de modo de pré-visualização para não membros", () => {
    render(<GroupDetailView group={nonMemberGroup} />);

    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.getByText(/Você está em modo de pré-visualização/i)).toBeDefined();
    expect(screen.getAllByRole("button", { name: "Entrar no grupo" }).length).toBeGreaterThan(0);
  });
});

it("bloqueia mensagens, interesse e plano para visitante", () => {
  render(<GroupDetailView group={{ ...groupDetailsMap["comunidade-msd-c8"], isMember: false, role: undefined }} />);
  expect(screen.getByRole("button", { name: "Enviar mensagem" }).hasAttribute("disabled")).toBe(true);
  expect(screen.getByRole("button", { name: "Tenho interesse" }).hasAttribute("disabled")).toBe(true);
  expect(screen.getByRole("button", { name: "Plano e cronograma" }).hasAttribute("disabled")).toBe(true);
  expect(screen.queryByText("Plano publicado")).toBeNull();
  expect(screen.queryByRole("button", { name: "Gerenciar grupo" })).toBeNull();
  fireEvent.submit(screen.getByRole("button", { name: "Enviar mensagem" }).closest("form")!);
  expect(screen.queryByText(/Mensagem adicionada ao protótipo/)).toBeNull();
});

it("move o foco para o modal, contém Tab e restaura o acionador", () => {
  render(<GroupDetailView group={groupDetailsMap["comunidade-msd-c8"]} />);
  const trigger = screen.getByRole("button", { name: "Ver participantes" });
  trigger.focus();
  fireEvent.click(trigger);
  const close = screen.getByRole("button", { name: "Fechar painel" });
  expect(document.activeElement).toBe(close);
  fireEvent.keyDown(close, { key: "Tab" });
  expect(document.activeElement).toBe(close);
  fireEvent.keyDown(close, { key: "Escape" });
  expect(document.activeElement).toBe(trigger);
});

it.each(["loading", "error"] as const)("expõe estado demonstrativo %s", (state) => {
  render(<GroupDetailView group={groupDetailsMap["comunidade-msd-c8"]} state={state} />);
  expect(screen.getByRole(state === "loading" ? "status" : "alert")).toBeDefined();
  expect(screen.queryByRole("button", { name: "Enviar mensagem" })).toBeNull();
});

it("trata assuntos e encontros vazios", () => {
  render(<GroupDetailView group={{ ...groupDetailsMap["comunidade-msd-c8"], channels: [], nextMeetingDetail: undefined }} />);
  expect(screen.getByText("Nenhum assunto criado neste grupo.")).toBeDefined();
  expect(screen.getByText("Nenhum encontro agendado no momento.")).toBeDefined();
});
