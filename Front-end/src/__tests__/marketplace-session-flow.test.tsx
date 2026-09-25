import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SessionDetailPage from "@/app/(app)/sessoes/[sessionId]/page";
import MyBookingsPage from "@/app/(app)/sessoes/minhas/page";
import SessoesPage from "@/app/(app)/sessoes/page";
import NewTutorSessionPage from "@/app/(app)/tutor/nova-sessao/page";
import TutorPage from "@/app/(app)/tutor/page";

const marketplace = vi.hoisted(() => {
  const session = {
    id: "session-001",
    tutor_user_id: "tutor-001",
    tutor_name: "Tutor Exemplo",
    subject_id: "subject-001",
    subject_name: "Cálculo II",
    title: "Revisão de Cálculo II",
    description: "Revisão",
    modality: "online" as const,
    location: null,
    external_url: "https://example.com/sessao",
    starts_at: "2099-09-20T18:00:00.000Z",
    ends_at: "2099-09-20T19:00:00.000Z",
    capacity: 2,
    enrolled_count: 1,
    price_cents: 2500,
    currency: "BRL",
    status: "scheduled" as const,
  };
  const receipt = {
    booking_id: "booking-001",
    session_id: session.id,
    status: "confirmed" as const,
    simulated: true as const,
    notice: "Nenhum pagamento foi processado. Esta é uma demonstração acadêmica.",
    transaction: {
      id: "transaction-001",
      amount_cents: 2500,
      commission_cents: 375,
      currency: "BRL",
      status: "completed" as const,
      simulated: true as const,
    },
  };
  const fullSession = {
    ...session,
    id: "session-full",
    title: "Estruturas de Dados - turma lotada",
    subject_name: "Estruturas de Dados",
    enrolled_count: 2,
  };
  return {
    session,
    receipt,
    bookings: [] as Array<{
      id: string;
      session: typeof session;
      status: "confirmed" | "cancelled";
      booked_at: string;
      cancelled_at: string | null;
    }>,
    profile: null,
    listSessions: vi.fn(async () => [session, fullSession]),
    getSession: vi.fn(async () => session),
    enrollSession: vi.fn(async () => receipt),
    cancelEnrollment: vi.fn(async () => undefined),
    activateTutorProfile: vi.fn(async (headline: string, bio: string) => ({
      user_id: "student-demo",
      headline,
      bio,
      status: "active" as const,
      created_at: new Date().toISOString(),
    })),
    createSession: vi.fn(async () => ({ ...session, id: "created-session", status: "draft" as const })),
    publishSession: vi.fn(async () => ({ ...session, id: "created-session" })),
    catalog: vi.fn(async () => [{ id: "subject-001", name: "Estruturas de Dados" }]),
  };
});

vi.mock("@/modules/marketplace/marketplace.api", () => ({
  useSessions: () => ({
    data: [marketplace.session, { ...marketplace.session, id: "session-full", title: "Estruturas de Dados - turma lotada", subject_name: "Estruturas de Dados", enrolled_count: 2 }],
    loaded: true,
    error: null,
  }),
  useMyBookings: () => ({ data: marketplace.bookings, loaded: true, error: null }),
  useMySessions: () => ({ data: [], loaded: true, error: null }),
  useTutorProfile: () => ({ data: marketplace.profile, loaded: true, error: null }),
  listSessions: marketplace.listSessions,
  getSession: marketplace.getSession,
  enrollSession: marketplace.enrollSession,
  cancelEnrollment: marketplace.cancelEnrollment,
  activateTutorProfile: marketplace.activateTutorProfile,
  createSession: marketplace.createSession,
  publishSession: marketplace.publishSession,
  apiErrorMessage: (error: unknown) => String(error),
}));

vi.mock("@/modules/groups/api", () => ({
  catalog: marketplace.catalog,
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ sessionId: "session-001" }),
}));
vi.mock("@/modules/auth", () => ({
  useAuthSession: () => ({
    user: { id: "student-demo", fullName: "Estudante Exemplo" },
  }),
}));

describe("jornada de sessões profissionais simuladas", () => {
  beforeEach(() => {
    marketplace.bookings.length = 0;
    vi.clearAllMocks();
  });

  it("filtra a vitrine e informa quando uma sessão está lotada", () => {
    render(<SessoesPage />);

    expect(screen.getByRole("note").textContent).toContain("Nenhum pagamento real");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "Estruturas de Dados" },
    });

    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Vagas esgotadas" }).getAttribute("aria-disabled")).toBe("true");
  });

  it("confirma e cancela uma inscrição com recibo demonstrativo", async () => {
    render(<SessionDetailPage />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Simular Inscrição" })).toBeDefined());
    fireEvent.click(screen.getByRole("button", { name: "Simular Inscrição" }));
    expect(screen.getByRole("dialog").textContent).toContain("Nenhum pagamento será cobrado");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(screen.getByRole("status", { name: "Recibo de inscrição simulada" })).toBeDefined());
    const receipt = screen.getByRole("status", { name: "Recibo de inscrição simulada" });
    expect(receipt.textContent).toContain("Nenhum pagamento foi processado");
    expect(receipt.textContent?.replaceAll(/\s/g, " ")).toContain("R$ 3,75");

    fireEvent.click(screen.getByRole("button", { name: "Cancelar inscrição" }));
    await waitFor(() => expect(marketplace.cancelEnrollment).toHaveBeenCalledWith("session-001"));
    expect(screen.getByRole("status").textContent).toContain("Inscrição cancelada");

    marketplace.bookings.push({
      id: "booking-001",
      session: marketplace.session,
      status: "cancelled",
      booked_at: new Date().toISOString(),
      cancelled_at: new Date().toISOString(),
    });

    render(<MyBookingsPage />);
    expect(screen.getByRole("list", { name: "Histórico de inscrições" }).textContent)
      .toContain("Cancelada");
  });

  it("exibe erro retornado pela API ao inscrever", async () => {
    marketplace.enrollSession.mockRejectedValueOnce(new Error("lotada"));
    render(<SessionDetailPage />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Simular Inscrição" })).toBeDefined());
    fireEvent.click(screen.getByRole("button", { name: "Simular Inscrição" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("lotada"));
  });

  it("propaga duplicidade retornada pelo servidor", async () => {
    marketplace.enrollSession
      .mockResolvedValueOnce(marketplace.receipt)
      .mockRejectedValueOnce(new Error("já possui inscrição ativa"));
    const first = render(<SessionDetailPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Simular Inscrição" })).toBeDefined());
    fireEvent.click(screen.getByRole("button", { name: "Simular Inscrição" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    first.unmount();

    render(<SessionDetailPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Simular Inscrição" })).toBeDefined());
    fireEvent.click(screen.getByRole("button", { name: "Simular Inscrição" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("já possui inscrição ativa"));
  });

  it("ativa o perfil profissional e expõe a criação de sessão", async () => {
    render(<TutorPage />);

    fireEvent.click(screen.getByRole("button", { name: "Ativar perfil profissional" }));
    fireEvent.change(screen.getByLabelText("Título profissional"), {
      target: { value: "Monitor de Cálculo II" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar ativação" }));

    await waitFor(() => expect(marketplace.activateTutorProfile).toHaveBeenCalledWith("Monitor de Cálculo II", ""));
    expect(screen.getByRole("link", { name: "Nova sessão" }).getAttribute("href")).toBe("/tutor/nova-sessao");
  });

  it("revisa e publica uma oferta com comissão simulada", async () => {
    render(<NewTutorSessionPage />);

    fireEvent.change(screen.getByLabelText("Título da sessão"), {
      target: { value: "Revisão para P2" },
    });
    await waitFor(() => expect(screen.getByLabelText("Disciplina")).toBeDefined());
    fireEvent.change(screen.getByLabelText("Disciplina"), {
      target: { value: "subject-001" },
    });
    fireEvent.change(screen.getByLabelText("Data e horário"), {
      target: { value: "2099-09-20T18:00" },
    });
    fireEvent.change(screen.getByLabelText("Término"), { target: { value: "2099-09-20T19:00" } });
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
    await waitFor(() => expect(marketplace.publishSession).toHaveBeenCalledWith("created-session"));
  });

  it("exibe o histórico de inscrições sem sugerir cobrança real", () => {
    render(<MyBookingsPage />);

    expect(screen.getByRole("heading", { name: "Minhas inscrições" })).toBeDefined();
    expect(screen.getByRole("note").textContent).toContain("nenhuma cobrança");
    expect(screen.getByText("Você ainda não possui inscrições simuladas.")).toBeDefined();
  });
});
