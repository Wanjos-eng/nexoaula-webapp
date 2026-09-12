import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SessionDetailPage from "@/app/(app)/sessoes/[sessionId]/page";
import MyBookingsPage from "@/app/(app)/sessoes/minhas/page";
import SessoesPage from "@/app/(app)/sessoes/page";
import NewTutorSessionPage from "@/app/(app)/tutor/nova-sessao/page";
import TutorPage from "@/app/(app)/tutor/page";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
  useParams: () => ({ sessionId: "session-001" }),
}));
vi.mock("@/modules/auth", () => ({
  useAuthSession: () => ({
    user: { id: "student-demo", fullName: "Estudante Exemplo" },
  }),
}));

describe("jornada de sessões profissionais simuladas", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("filtra a vitrine e informa quando uma sessão está lotada", () => {
    render(<SessoesPage />);

    expect(screen.getByRole("note").textContent).toContain("Nenhum pagamento real");
    expect(screen.getAllByRole("listitem")).toHaveLength(3);

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "Estruturas de Dados" },
    });

    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Vagas esgotadas" }).getAttribute("aria-disabled")).toBe("true");
  });

  it("confirma e cancela uma inscrição com recibo demonstrativo", () => {
    render(<SessionDetailPage />);

    fireEvent.click(screen.getByRole("button", { name: "Simular Inscrição" }));
    expect(screen.getByRole("dialog").textContent).toContain("Nenhum pagamento será cobrado");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    const receipt = screen.getByRole("status", { name: "Recibo de inscrição simulada" });
    expect(receipt.textContent).toContain("Nenhum pagamento foi processado");
    expect(receipt.textContent?.replaceAll(/\s/g, " ")).toContain("R$ 3,75");

    fireEvent.click(screen.getByRole("button", { name: "Cancelar inscrição" }));
    expect(screen.getByRole("status").textContent).toContain("Inscrição cancelada");

    render(<MyBookingsPage />);
    expect(screen.getByRole("list", { name: "Histórico de inscrições" }).textContent)
      .toContain("Cancelada");
  });

  it("oferece feedback e nova tentativa quando a operação falha", () => {
    render(<SessionDetailPage />);

    fireEvent.click(screen.getByRole("button", { name: "Simular Inscrição" }));
    fireEvent.click(screen.getByRole("button", { name: "Simular falha da operação" }));

    expect(screen.getByRole("alert").textContent).toContain("Não foi possível concluir");
    expect(screen.getByRole("button", { name: "Tentar novamente" }).hasAttribute("disabled")).toBe(false);
  });

  it("recusa uma segunda inscrição ativa na mesma sessão", () => {
    const first = render(<SessionDetailPage />);
    fireEvent.click(screen.getByRole("button", { name: "Simular Inscrição" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    first.unmount();

    render(<SessionDetailPage />);
    fireEvent.click(screen.getByRole("button", { name: "Simular Inscrição" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(screen.getByRole("alert").textContent).toContain("já possui inscrição ativa");
  });

  it("ativa o perfil profissional e expõe a criação de sessão", () => {
    render(<TutorPage />);

    fireEvent.click(screen.getByRole("button", { name: "Ativar perfil profissional" }));
    fireEvent.change(screen.getByLabelText("Título profissional"), {
      target: { value: "Monitor de Cálculo II" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar ativação" }));

    expect(screen.getByRole("status").textContent).toContain("Monitor de Cálculo II");
    expect(screen.getByRole("link", { name: "Nova sessão" }).getAttribute("href")).toBe("/tutor/nova-sessao");
  });

  it("revisa e publica uma oferta com comissão simulada", () => {
    render(<NewTutorSessionPage />);

    fireEvent.change(screen.getByLabelText("Título da sessão"), {
      target: { value: "Revisão para P2" },
    });
    fireEvent.change(screen.getByLabelText("Disciplina"), {
      target: { value: "Cálculo II" },
    });
    fireEvent.change(screen.getByLabelText("Data e horário"), {
      target: { value: "2026-09-20T18:00" },
    });
    fireEvent.change(screen.getByLabelText("Término"), { target: { value: "2026-09-20T19:00" } });
    fireEvent.change(screen.getByLabelText("Link demonstrativo (online ou híbrida)"), { target: { value: "https://example.com/sessao" } });
    fireEvent.change(screen.getByLabelText("Capacidade"), {
      target: { value: "12" },
    });
    fireEvent.change(screen.getByLabelText("Valor demonstrativo (R$)"), {
      target: { value: "25" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Revisar oferta" }));

    expect(screen.getByRole("heading", { name: "Resumo da oferta" })).toBeDefined();
    expect(screen.getByText(/R\$\s*3,75/)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Publicar sessão simulada" }));
    expect(screen.getByRole("status").textContent).toContain("disponível na vitrine");

    render(<SessoesPage />);
    expect(screen.getByRole("list", { name: "Sessões disponíveis" }).textContent)
      .toContain("Revisão para P2");
  });

  it("exibe o histórico de inscrições sem sugerir cobrança real", () => {
    render(<MyBookingsPage />);

    expect(screen.getByRole("heading", { name: "Minhas inscrições" })).toBeDefined();
    expect(screen.getByRole("note").textContent).toContain("nenhuma cobrança");
    expect(screen.getByText("Você ainda não possui inscrições simuladas.")).toBeDefined();
  });
});
