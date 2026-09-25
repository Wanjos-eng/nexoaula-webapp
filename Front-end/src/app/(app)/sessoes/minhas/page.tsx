"use client";

import { ArrowLeft, CalendarBlank, Storefront, UsersThree } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";

import { apiErrorMessage, cancelEnrollment, useMyBookings } from "@/modules/marketplace/marketplace.api";
import { formatCents } from "@/modules/marketplace/marketplace.types";
import styles from "./page.module.css";

export default function MyBookingsPage() {
  const { data: bookings, loaded, error } = useMyBookings();
  const [cancelledIds, setCancelledIds] = useState<Set<string>>(() => new Set());
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleCancel(sessionId: string, bookingId: string) {
    setCancellingId(bookingId);
    setActionError(null);
    try {
      await cancelEnrollment(sessionId);
      setCancelledIds((current) => new Set(current).add(bookingId));
    } catch (cause: unknown) {
      setActionError(apiErrorMessage(cause));
    } finally {
      setCancellingId(null);
    }
  }
  return (
    <main className={styles.page}>
      <Link className={styles.back} href="/sessoes">
        <ArrowLeft aria-hidden size={16} /> Voltar às sessões
      </Link>
      <header className={styles.header}>
        <Storefront aria-hidden size={24} weight="fill" />
        <div>
          <h1>Minhas inscrições</h1>
          <p>Acompanhe suas reservas demonstrativas e os respectivos estados.</p>
        </div>
      </header>
      <p className={styles.notice} role="note">
        Demonstração acadêmica: nenhuma cobrança ou pagamento real foi realizado.
      </p>
      {error ? <p role="alert">{error}</p> : null}
      {actionError ? <p role="alert">{actionError}</p> : null}
      {!loaded ? <p className={styles.empty}>Carregando inscrições…</p> : bookings.length === 0 ? (
        <p className={styles.empty}>Você ainda não possui inscrições simuladas.</p>
      ) : (
        <ul className={styles.list} aria-label="Histórico de inscrições">
          {bookings.map((booking) => {
            const starts = new Date(booking.session.starts_at);
            const bookingStatus = cancelledIds.has(booking.id) ? "cancelled" : booking.status;
            return (
              <li className={styles.card} key={booking.id}>
                <div>
                  <span className={styles.status}>
                    {bookingStatus === "confirmed" ? "Confirmada" : "Cancelada"}
                  </span>
                  <h2>{booking.session.title}</h2>
                  <p>
                    <CalendarBlank aria-hidden size={14} />
                    {starts.toLocaleString("pt-BR", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <p>
                    <UsersThree aria-hidden size={14} /> Tutor: {booking.session.tutor_name}
                  </p>
                </div>
                <div>
                  <strong>
                    {formatCents(booking.session.price_cents, booking.session.currency)}
                    <small> valor simulado</small>
                  </strong>
                  {booking.transaction ? (
                    <p>
                      Recibo: comissão de {formatCents(booking.transaction.commission_cents, booking.transaction.currency)}
                    </p>
                  ) : null}
                  {bookingStatus === "confirmed" ? (
                    <button
                      type="button"
                      onClick={() => handleCancel(booking.session.id, booking.id)}
                      disabled={cancellingId === booking.id}
                    >
                      {cancellingId === booking.id ? "Cancelando…" : "Cancelar inscrição"}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
