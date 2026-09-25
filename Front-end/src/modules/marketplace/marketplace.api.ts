import { apiClient, ApiError } from "@/lib/api";
import type { EnrollmentReceipt, TutorProfile, TutorSession } from "./marketplace.types";

export type SessionOffer = Omit<TutorSession, "tutor_name" | "subject_name" | "enrolled_count">;
export type PublishedSession = TutorSession & { available_seats: number; commission_cents: number };
export type Booking = EnrollmentReceipt & {
  booked_at: string;
  cancelled_at: string | null;
  session: PublishedSession;
};
export const marketplacePath = "/v1/marketplace";
export const marketplaceApi = {
  enroll: async (id: string) => (await apiClient.post<EnrollmentReceipt>(`${marketplacePath}/sessions/${id}/enroll`, { body: {} })).data,
  cancel: async (id: string) => (await apiClient.del<EnrollmentReceipt>(`${marketplacePath}/sessions/${id}/enroll`, { body: {} })).data,
  activate: async (headline: string, bio: string) => (await apiClient.post<TutorProfile>(`${marketplacePath}/tutor/activate`, { body: { headline, bio } })).data,
  pause: async () => (await apiClient.del<TutorProfile>(`${marketplacePath}/tutor/deactivate`, { body: {} })).data,
  listMine: async (limit = 100, offset = 0) => (await apiClient.get<SessionOffer[]>(`${marketplacePath}/sessions/mine?limit=${limit}&offset=${offset}`)).data,
  create: async (body: unknown) => (await apiClient.post<SessionOffer>(`${marketplacePath}/sessions`, { body })).data,
  edit: async (id: string, body: unknown) => (await apiClient.patch<SessionOffer>(`${marketplacePath}/sessions/${id}`, { body })).data,
  publish: async (id: string) => (await apiClient.post<SessionOffer>(`${marketplacePath}/sessions/${id}/publish`, { body: {} })).data,
  cancelOffer: async (id: string) => (await apiClient.del<SessionOffer>(`${marketplacePath}/sessions/${id}`, { body: {} })).data,
};

export function marketplaceError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Sua sessão expirou. Entre novamente.";
    if (error.status === 422) return "Confira os campos informados e tente novamente.";
    if (error.status >= 500) return "Tutoria temporariamente indisponível. Tente novamente.";
    if (error.body && typeof error.body === "object" && "detail" in error.body && typeof error.body.detail === "string") return error.body.detail;
  }
  return "Não foi possível concluir a operação. Verifique a conexão e tente novamente.";
}
