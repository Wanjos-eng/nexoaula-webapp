"use client";

import { ArrowLeft, CalendarBlank, Storefront, UsersThree } from "@phosphor-icons/react";
import Link from "next/link";

import { useState } from "react";
import { useMarketplace } from "@/modules/marketplace/useMarketplace";
import { marketplaceApi, marketplaceError, marketplacePath, type Booking } from "@/modules/marketplace/marketplace.api";
import { formatCents } from "@/modules/marketplace/marketplace.types";
import styles from "./page.module.css";

export default function MyBookingsPage() {
  const [offset, setOffset] = useState(0);
  const { data: bookings = [], error, loading, refresh } = useMarketplace<Booking[]>(`${marketplacePath}/bookings/mine?limit=20&offset=${offset}`);
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState("");
  async function cancel(id: string) {
    setBusy(id); setFailure("");
    try { await marketplaceApi.cancel(id); refresh(); }
    catch (error) { setFailure(marketplaceError(error)); }
    finally { setBusy(null); }
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
      {failure && <p role="alert">{failure}</p>}
      {loading ? <p role="status">Carregando inscrições…</p> : error ? <div role="alert">{error} <button onClick={refresh}>Tentar novamente</button></div> : bookings.length === 0 ? (
        <p className={styles.empty}>Você ainda não possui inscrições simuladas.</p>
      ) : (
        <ul className={styles.list} aria-label="Histórico de inscrições">
          {bookings.map((booking) => {
            const starts = new Date(booking.session.starts_at);
            return (
              <li className={styles.card} key={booking.booking_id}>
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
                  {formatCents(booking.transaction.amount_cents, booking.transaction.currency)}
                  <small> valor simulado</small>
                </strong>
                <p>Comissão demonstrativa (15%): {formatCents(booking.transaction.commission_cents)}</p>
                <p>{booking.notice}</p>
                {booking.status === "confirmed" && new Date(booking.session.starts_at).getTime() > Date.now() && <button disabled={busy !== null} onClick={() => cancel(booking.session_id)}>Cancelar inscrição</button>}
              </li>
            );
          })}
        </ul>
      )}
      <nav aria-label="Paginação de inscrições">
        <button disabled={loading || offset === 0} onClick={() => setOffset(Math.max(0, offset - 20))}>Anterior</button>
        <button disabled={loading || bookings.length < 20} onClick={() => setOffset(offset + 20)}>Próxima</button>
      </nav>
    </main>
  );
}
