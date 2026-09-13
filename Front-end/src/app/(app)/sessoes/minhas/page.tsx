"use client";

import { ArrowLeft, CalendarBlank, Storefront, UsersThree } from "@phosphor-icons/react";
import Link from "next/link";

import { useAuthSession } from "@/modules/auth";
import { useDemoBookings } from "@/modules/marketplace/marketplace.demo";
import { formatCents } from "@/modules/marketplace/marketplace.types";
import styles from "./page.module.css";

export default function MyBookingsPage() {
  const { user } = useAuthSession();
  const bookings = useDemoBookings(user.id);
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
      {bookings.length === 0 ? (
        <p className={styles.empty}>Você ainda não possui inscrições simuladas.</p>
      ) : (
        <ul className={styles.list} aria-label="Histórico de inscrições">
          {bookings.map((booking) => {
            const starts = new Date(booking.session.starts_at);
            return (
              <li className={styles.card} key={booking.id}>
                <div>
                  <span className={styles.status}>
                    {booking.status === "confirmed" ? "Confirmada" : "Cancelada"}
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
                <strong>
                  {formatCents(booking.session.price_cents, booking.session.currency)}
                  <small> valor simulado</small>
                </strong>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
