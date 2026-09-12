/**
 * marketplace.types.ts
 * Tipos do módulo de Sessões de Tutoria Simuladas.
 * Alinhado ao ADR-0004 e ao modelo de dados em docs/diagrams/nexoaula.dbml
 * (tabelas: tutor_profiles, tutor_sessions, session_bookings, transactions).
 */

export type TutorProfileStatus = "active" | "paused" | "suspended";
export type SessionModality = "online" | "in_person" | "hybrid";
export type SessionStatus = "draft" | "scheduled" | "completed" | "cancelled";
export type BookingStatus =
  | "reserved"
  | "confirmed"
  | "cancelled"
  | "attended"
  | "no_show";

export type TutorProfile = {
  user_id: string;
  headline: string | null;
  bio: string | null;
  status: TutorProfileStatus;
  created_at: string;
};

export type TutorSession = {
  id: string;
  tutor_user_id: string;
  tutor_name: string;
  subject_id: string;
  subject_name: string;
  title: string;
  description: string | null;
  modality: SessionModality;
  location: string | null;
  external_url: string | null;
  starts_at: string;
  ends_at: string;
  capacity: number;
  enrolled_count: number;
  price_cents: number;
  currency: string;
  status: SessionStatus;
};

/** Resposta da API ao simular inscrição. Campo simulated=true é obrigatório. */
export type EnrollmentReceipt = {
  booking_id: string;
  session_id: string;
  status: BookingStatus;
  simulated: true;
  notice: string;
  transaction: {
    id: string;
    amount_cents: number;
    commission_cents: number;
    currency: string;
    status: "completed";
    simulated: true;
  };
};

export type SessionBooking = {
  id: string;
  session: TutorSession;
  status: BookingStatus;
  booked_at: string;
  cancelled_at: string | null;
};

/** Formata centavos em reais: 2500 → "R$ 25,00" */
export function formatCents(cents: number, currency = "BRL"): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency,
  });
}

/** Calcula comissão demonstrativa: 15% fixo (ADR-0004) */
export function calcCommission(amountCents: number): number {
  return Math.round(amountCents * 0.15);
}
