import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient, ApiError } from "@/lib/api";
import SessionDetailPage from "@/app/(app)/sessoes/[sessionId]/page";
import MyBookingsPage from "@/app/(app)/sessoes/minhas/page";
import SessoesPage from "@/app/(app)/sessoes/page";
import NewTutorSessionPage from "@/app/(app)/tutor/nova-sessao/page";
import TutorPage from "@/app/(app)/tutor/page";
import type { Booking, PublishedSession } from "@/modules/marketplace/marketplace.api";
import type { TutorProfile } from "@/modules/marketplace/marketplace.types";

vi.mock("next/navigation", () => ({ useParams: () => ({ sessionId: "session-001" }) }));
vi.mock("@/modules/auth", () => ({ useAuthSession: () => ({ user: { id: "student" } }) }));

let bookings: Booking[];
let profile: TutorProfile | null;
let session: PublishedSession;
const notice = "Nenhum pagamento foi processado. Esta é uma demonstração acadêmica.";

beforeEach(() => {
  vi.restoreAllMocks(); bookings = []; profile = null;
  session = { id: "session-001", tutor_user_id: "tutor", tutor_name: "Tutor", subject_id: "subject-1", subject_name: "Cálculo",
    title: "Limites", description: null, modality: "online", location: null, external_url: "https://example.test",
    starts_at: "2099-01-01T12:00:00Z", ends_at: "2099-01-01T13:00:00Z", capacity: 2,
    enrolled_count: 0, available_seats: 2, price_cents: 2500, commission_cents: 375, currency: "BRL", status: "scheduled" };
  vi.spyOn(apiClient, "get").mockImplementation(async (path) => {
    let data: unknown;
    if (path.includes("/academic/subjects")) data = [{ id: "subject-1", name: "Cálculo" }];
    else if (path.includes("/bookings/mine")) data = bookings;
    else if (path.endsWith("/tutor")) data = profile;
    else if (path.includes("/sessions/mine")) data = [];
    else if (path.endsWith("/sessions/session-001")) data = session;
    else data = new URLSearchParams(path.split("?")[1]).get("topic") === "ausente" ? [] : [session];
    return { data: data as never, status: 200 };
  });
  vi.spyOn(apiClient, "post").mockImplementation(async (path, options) => {
    if (path.endsWith("/enroll")) {
      bookings = [{ booking_id: "booking-1", session_id: session.id, session, status: "confirmed", simulated: true, notice,
        booked_at: "2026-01-01T10:00:00Z", cancelled_at: null,
        transaction: { id: "transaction-1", amount_cents: 1010, commission_cents: 152, currency: "BRL", status: "completed", simulated: true } }];
      return { data: bookings[0] as never, status: 201 };
    }
    if (path.endsWith("/activate")) {
      const body = options?.body as { headline: string; bio: string };
      profile = { user_id: "student", ...body, status: "active", created_at: "2026-01-01" };
      return { data: profile as never, status: 200 };
    }
    return { data: { ...session, status: path.endsWith("/publish") ? "scheduled" : "draft" } as never, status: 201 };
  });
  vi.spyOn(apiClient, "del").mockImplementation(async () => {
    bookings = bookings.map((b) => ({ ...b, status: "cancelled", cancelled_at: "2026-01-02T10:00:00Z" }));
    return { data: bookings[0] as never, status: 200 };
  });
});

describe("marketplace conectado à API", () => {
  it("busca no servidor e apresenta estado vazio", async () => {
    render(<SessoesPage />);
    await screen.findByText("Limites");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "ausente" } });
    await screen.findByText("Nenhuma sessão encontrada para sua busca.");
    expect(apiClient.get).toHaveBeenCalledWith(expect.stringContaining("topic=ausente"), expect.anything());
  });

  it("usa valores do recibo do servidor e cancela com CSRF no cliente compartilhado", async () => {
    const storage = vi.spyOn(Storage.prototype, "setItem");
    render(<SessionDetailPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Simular Inscrição" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    const receipt = await screen.findByRole("status", { name: "Recibo de inscrição simulada" });
    expect(receipt.textContent?.replaceAll(/\s/g, " ")).toContain("R$ 10,10");
    expect(receipt.textContent?.replaceAll(/\s/g, " ")).toContain("R$ 1,52");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar inscrição" }));
    await screen.findByText("Inscrição cancelada.");
    expect(apiClient.del).toHaveBeenCalledWith("/v1/marketplace/sessions/session-001/enroll", { body: {} });
    expect(storage).not.toHaveBeenCalled();
  });

  it("restaura a inscrição pela API após remontar a tela", async () => {
    const view = render(<SessionDetailPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Simular Inscrição" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await screen.findByRole("status", { name: "Recibo de inscrição simulada" });
    view.unmount(); render(<SessionDetailPage />);
    await screen.findByRole("button", { name: "Cancelar inscrição" });
    expect(screen.queryByRole("button", { name: "Simular Inscrição" })).toBeNull();
  });

  it("exibe erro real de lotação sem fabricar sucesso", async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce(new ApiError(409, "Conflict", { detail: "Esta sessão está lotada." }));
    render(<SessionDetailPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Simular Inscrição" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect((await screen.findByRole("alert")).textContent).toContain("lotada");
    expect(screen.queryByRole("status", { name: "Recibo de inscrição simulada" })).toBeNull();
  });

  it("ativa o tutor pela API", async () => {
    render(<TutorPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Ativar perfil profissional" }));
    fireEvent.change(screen.getByLabelText("Título profissional"), { target: { value: "Tutor de cálculo" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar ativação" }));
    await screen.findByRole("link", { name: "Nova sessão" });
    expect(apiClient.post).toHaveBeenCalledWith("/v1/marketplace/tutor/activate", { body: { headline: "Tutor de cálculo", bio: "" } });
  });

  it("salva rascunho com UUID do catálogo e publica pela API", async () => {
    render(<NewTutorSessionPage />);
    await screen.findByRole("option", { name: "Cálculo" });
    for (const [label, value] of [["Título da sessão", "Limites"], ["Disciplina", "subject-1"], ["Data e horário", "2099-01-01T12:00"], ["Término", "2099-01-01T13:00"], ["Link demonstrativo (online ou híbrida)", "https://example.test"], ["Capacidade", "2"], ["Valor demonstrativo (R$)", "25"]]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Revisar oferta" }));
    await screen.findByRole("heading", { name: "Resumo da oferta" });
    expect(apiClient.post).toHaveBeenCalledWith("/v1/marketplace/sessions", { body: expect.objectContaining({ subject_id: "subject-1", price_cents: 2500 }) });
    fireEvent.click(screen.getByRole("button", { name: "Publicar sessão simulada" }));
    await screen.findByText("Sessão simulada publicada e disponível na vitrine.");
  });

  it("não confunde falha de consulta com histórico vazio", async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error("offline"));
    render(<MyBookingsPage />);
    await screen.findByRole("alert");
    expect(screen.queryByText("Você ainda não possui inscrições simuladas.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(screen.getByText("Você ainda não possui inscrições simuladas.")).toBeDefined());
  });
});
