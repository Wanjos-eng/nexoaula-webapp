import { beforeEach, describe, expect, it, vi } from "vitest";

const apiClient = {
  get: vi.fn(),
  post: vi.fn(),
  del: vi.fn(),
};

vi.mock("@/lib/api", () => ({
  apiClient,
  ApiError: class ApiError extends Error {},
}));

const { enrollSession } = await import("./marketplace.api");

describe("marketplace API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("inscreve na rota /v1 e retorna o recibo persistido", async () => {
    const receipt = {
      booking_id: "booking-1",
      session_id: "session-1",
      status: "confirmed",
      simulated: true,
      notice: "Nenhum pagamento foi processado.",
      transaction: {
        id: "transaction-1",
        amount_cents: 2500,
        commission_cents: 375,
        currency: "BRL",
        status: "completed",
        simulated: true,
      },
    };
    apiClient.post.mockResolvedValue({ data: receipt, status: 201 });

    await expect(enrollSession("session-1")).resolves.toEqual(receipt);
    expect(apiClient.post).toHaveBeenCalledWith(
      "/v1/marketplace/sessions/session-1/enroll",
      { body: {} },
    );
  });
});
