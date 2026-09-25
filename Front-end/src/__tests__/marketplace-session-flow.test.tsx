import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SessionDetailPage from "@/app/(app)/sessoes/[sessionId]/page";
import MyBookingsPage from "@/app/(app)/sessoes/minhas/page";
import SessoesPage from "@/app/(app)/sessoes/page";
import NewTutorSessionPage from "@/app/(app)/tutor/nova-sessao/page";
import TutorPage from "@/app/(app)/tutor/page";
import { apiClient, ApiError } from "@/lib/api";
import type {
  Booking,
  PublishedSession,
  SessionOffer,
} from "@/modules/marketplace/marketplace.api";
import type { TutorProfile } from "@/modules/marketplace/marketplace.types";

vi.mock("next/navigation", () => ({
  useParams: () => ({ sessionId: "session-001" }),
  useRouter: () => ({
    back: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock("@/modules/auth", () => ({
  useAuthSession: () => ({ user: { id: "student" } }),
}));

vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

let bookings: Booking[];
let profile: TutorProfile | null;
let session: PublishedSession;
let mineOffers: SessionOffer[];

const notice =
  "Nenhum pagamento foi processado. Esta é uma demonstração acadêmica.";

beforeEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
  bookings = [];
  profile = null;
  mineOffers = [];
  session = {
    id: "session-001",
    tutor_user_id: "tutor",
    tutor_name: "Tutor",
    subject_id: "subject-1",
    subject_name: "Cálculo",
    title: "Limites",
    description: null,
    modality: "online",
    location: null,
    external_url: "https://example.test",
    starts_at: "2099-01-01T12:00:00Z",
    ends_at: "2099-01-01T13:00:00Z",
    capacity: 2,
    enrolled_count: 0,
    available_seats: 2,
    price_cents: 2500,
    commission_cents: 375,
    currency: "BRL",
    status: "scheduled",
  };

  vi.spyOn(apiClient, "get").mockImplementation(async (path) => {
    let data: unknown;
    if (path.includes("/academic/subjects")) {
      data = [{ id: "subject-1", name: "Cálculo" }];
    } else if (path.includes("/bookings/mine")) {
      data = bookings;
    } else if (path.endsWith("/tutor")) {
      data = profile;
    } else if (path.includes("/sessions/mine")) {
      data = mineOffers;
    } else if (path.endsWith("/sessions/session-001")) {
      data = session;
    } else {
      data =
        new URLSearchParams(path.split("?")[1]).get("topic") === "ausente"
          ? []
          : [session];
    }
    return { data: data as never, status: 200 };
  });

  vi.spyOn(apiClient, "post").mockImplementation(async (path, options) => {
    if (path.endsWith("/enroll")) {
      bookings = [
        {
          booking_id: "booking-1",
          session_id: session.id,
          session,
          status: "confirmed",
          simulated: true,
          notice,
          booked_at: "2026-01-01T10:00:00Z",
          cancelled_at: null,
          transaction: {
            id: "transaction-1",
            amount_cents: 1010,
            commission_cents: 152,
            currency: "BRL",
            status: "completed",
            simulated: true,
          },
        },
      ];
      return { data: bookings[0] as never, status: 201 };
    }

    if (path.endsWith("/activate")) {
      const body = options?.body as { headline: string; bio: string };
      profile = {
        user_id: "student",
        ...body,
        status: "active",
        created_at: "2026-01-01",
      };
      return { data: profile as never, status: 200 };
    }

    return {
      data: {
        ...session,
        status: path.endsWith("/publish") ? "scheduled" : "draft",
      } as never,
      status: 201,
    };
  });

  vi.spyOn(apiClient, "del").mockImplementation(async () => {
    bookings = bookings.map((booking) => ({
      ...booking,
      status: "cancelled",
      cancelled_at: "2026-01-02T10:00:00Z",
    }));
    return { data: bookings[0] as never, status: 200 };
  });
});

describe("marketplace conectado à API", () => {
  it("busca no servidor e apresenta estado vazio", async () => {
    render(<SessoesPage />);

    await screen.findByText("Limites");
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "ausente" },
    });

    await screen.findByText("Nenhuma tutoria encontrada");
    expect(apiClient.get).toHaveBeenCalledWith(
      expect.stringContaining("topic=ausente"),
      expect.anything(),
    );
  });

  it("usa o valor persistido do recibo e cancela pela API compartilhada", async () => {
    const storage = vi.spyOn(Storage.prototype, "setItem");
    render(<SessionDetailPage />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Reservar vaga" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar reserva" }),
    );

    const receipt = await screen.findByRole("status", {
      name: "Reserva de tutoria confirmada",
    });
    expect(receipt.textContent?.replaceAll(/\s/g, " ")).toContain("R$ 10,10");
    expect(receipt.textContent).not.toContain("R$ 1,52");

    fireEvent.click(
      screen.getByRole("button", { name: "Cancelar reserva" }),
    );
    const cancelButtons = screen.getAllByRole("button", {
      name: "Cancelar reserva",
    });
    fireEvent.click(cancelButtons.at(-1)!);

    await screen.findByText("Reserva cancelada");
    expect(apiClient.del).toHaveBeenCalledWith(
      "/v1/marketplace/sessions/session-001/enroll",
      { body: {} },
    );
    expect(storage).not.toHaveBeenCalled();
  });

  it("restaura a reserva pela API após remontar a tela", async () => {
    const view = render(<SessionDetailPage />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Reservar vaga" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar reserva" }),
    );
    await screen.findByRole("status", {
      name: "Reserva de tutoria confirmada",
    });

    view.unmount();
    render(<SessionDetailPage />);

    await screen.findByRole("button", { name: "Cancelar reserva" });
    expect(
      screen.queryByRole("button", { name: "Reservar vaga" }),
    ).toBeNull();
  });

  it("exibe erro real de lotação sem fabricar sucesso", async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce(
      new ApiError(409, "Conflict", {
        detail: "Esta sessão está lotada.",
      }),
    );
    render(<SessionDetailPage />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Reservar vaga" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar reserva" }),
    );

    expect((await screen.findByRole("alert")).textContent).toContain("lotada");
    expect(
      screen.queryByRole("status", {
        name: "Reserva de tutoria confirmada",
      }),
    ).toBeNull();
  });

  it("ativa o tutor pela API", async () => {
    render(<TutorPage />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Ativar perfil" }),
    );
    fireEvent.change(screen.getByLabelText("Título profissional"), {
      target: { value: "Tutor de cálculo" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar ativação" }),
    );

    await screen.findByRole("link", { name: "Criar tutoria" });
    expect(apiClient.post).toHaveBeenCalledWith(
      "/v1/marketplace/tutor/activate",
      { body: { headline: "Tutor de cálculo", bio: "" } },
    );
  });

  it("salva rascunho com UUID do catálogo e publica pela API", async () => {
    render(<NewTutorSessionPage />);
    await screen.findByRole("option", { name: "Cálculo" });

    const inputs = [
      ["Título da tutoria", "Limites"],
      ["Disciplina", "subject-1"],
      ["Data e horário", "2099-01-01T12:00"],
      ["Término", "2099-01-01T13:00"],
      ["Link do encontro (online ou híbrida)", "https://example.test"],
      ["Capacidade", "2"],
      ["Valor (R$)", "25"],
    ] as const;

    for (const [label, value] of inputs) {
      fireEvent.change(screen.getByLabelText(label), {
        target: { value },
      });
    }

    fireEvent.click(
      screen.getByRole("button", { name: "Revisar tutoria" }),
    );
    await screen.findByRole("heading", { name: "Revise sua tutoria" });

    expect(apiClient.post).toHaveBeenCalledWith(
      "/v1/marketplace/sessions",
      {
        body: expect.objectContaining({
          subject_id: "subject-1",
          price_cents: 2500,
        }),
      },
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Publicar tutoria" }),
    );
    await screen.findByText(
      "Sua tutoria já está disponível para os estudantes.",
    );
  });

  it("carrega um rascunho existente e salva a edição no mesmo ID", async () => {
    mineOffers = [
      {
        id: "draft-001",
        tutor_user_id: "student",
        subject_id: "subject-1",
        title: "Rascunho existente",
        description: "Descrição inicial",
        modality: "online",
        location: null,
        external_url: "https://example.test/sala",
        starts_at: "2099-02-01T12:00:00Z",
        ends_at: "2099-02-01T13:00:00Z",
        capacity: 4,
        price_cents: 3000,
        currency: "BRL",
        status: "draft",
      },
    ];
    window.history.replaceState(
      {},
      "",
      "/tutor/nova-sessao?edit=draft-001",
    );
    const patch = vi
      .spyOn(apiClient, "patch")
      .mockResolvedValue({ data: mineOffers[0], status: 200 });

    render(<NewTutorSessionPage />);

    await screen.findByRole("heading", { name: "Editar tutoria" });
    const title = screen.getByLabelText("Título da tutoria") as HTMLInputElement;
    expect(title.value).toBe("Rascunho existente");

    fireEvent.change(title, {
      target: { value: "Rascunho atualizado" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Salvar e revisar" }),
    );

    await screen.findByRole("heading", { name: "Revise sua tutoria" });
    expect(patch).toHaveBeenCalledWith(
      "/v1/marketplace/sessions/draft-001",
      {
        body: expect.objectContaining({
          title: "Rascunho atualizado",
          subject_id: "subject-1",
          price_cents: 3000,
        }),
      },
    );
  });

  it("não confunde falha de consulta com histórico vazio", async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error("offline"));
    render(<MyBookingsPage />);

    await screen.findByRole("alert");
    expect(
      screen.queryByText("Nenhuma tutoria agendada"),
    ).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Tentar novamente" }),
    );
    await waitFor(() =>
      expect(screen.getByText("Nenhuma tutoria agendada")).toBeDefined(),
    );
  });
});
