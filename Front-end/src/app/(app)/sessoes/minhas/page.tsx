"use client";

import { CalendarBlank, Storefront, UsersThree } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { BackButton } from "@/components/ui/BackButton";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import {
  marketplaceApi,
  marketplaceError,
  marketplacePath,
  type Booking,
} from "@/modules/marketplace/marketplace.api";
import { formatCents } from "@/modules/marketplace/marketplace.types";
import { useMarketplace } from "@/modules/marketplace/useMarketplace";
import styles from "./page.module.css";

type View = "upcoming" | "history";

const PAGE_SIZE = 20;

export default function MyBookingsPage() {
  const [offset, setOffset] = useState(0);
  const [view, setView] = useState<View>("upcoming");
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();
  const [now] = useState(() => Date.now());

  const {
    data: bookings = [],
    error,
    loading,
    refresh,
  } = useMarketplace<Booking[]>(
    `${marketplacePath}/bookings/mine?limit=${PAGE_SIZE}&offset=${offset}`,
  );

  const { upcoming, history } = useMemo(() => {
    const next: Booking[] = [];
    const past: Booking[] = [];

    for (const booking of bookings) {
      const startsAt = new Date(booking.session.starts_at).getTime();
      if (booking.status === "confirmed" && startsAt > now) next.push(booking);
      else past.push(booking);
    }

    return { upcoming: next, history: past };
  }, [bookings, now]);

  const visible = view === "upcoming" ? upcoming : history;

  async function confirmCancellation() {
    if (!cancelTarget || busy) return;
    setBusy(true);

    try {
      await marketplaceApi.cancel(cancelTarget.session_id);
      setCancelTarget(null);
      refresh();
      showToast({
        message: "Reserva cancelada e vaga liberada.",
        variant: "success",
      });
    } catch (cause) {
      showToast({ message: marketplaceError(cause), variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.page}>
      <BackButton fallback="/sessoes">Voltar para tutorias</BackButton>

      <PageHeader
        actions={
          <nav aria-label="Navegação de tutorias" className={styles.localNav}>
            <Link href="/sessoes">Explorar</Link>
            <span aria-current="page">Minhas tutorias</span>
          </nav>
        }
        description="Acompanhe suas próximas reservas e consulte o histórico das tutorias em que você se inscreveu."
        eyebrow="Tutorias"
        title="Minhas tutorias"
      />

      <div className={styles.tabs} role="tablist" aria-label="Estado das tutorias">
        <button
          aria-selected={view === "upcoming"}
          className={view === "upcoming" ? styles.tabActive : ""}
          onClick={() => setView("upcoming")}
          role="tab"
          type="button"
        >
          Próximas
          <span>{upcoming.length}</span>
        </button>
        <button
          aria-selected={view === "history"}
          className={view === "history" ? styles.tabActive : ""}
          onClick={() => setView("history")}
          role="tab"
          type="button"
        >
          Histórico
          <span>{history.length}</span>
        </button>
      </div>

      {loading ? (
        <div aria-label="Carregando minhas tutorias" className={styles.list} role="status">
          <span className="sr-only">Carregando tutorias...</span>
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} variant="row" />
          ))}
        </div>
      ) : error ? (
        <Card className={styles.stateCard} role="alert">
          <Storefront aria-hidden size={32} />
          <div>
            <h2>Não foi possível carregar suas tutorias</h2>
            <p>{error}</p>
          </div>
          <Button onClick={refresh} size="sm" type="button" variant="secondary">
            Tentar novamente
          </Button>
        </Card>
      ) : visible.length === 0 ? (
        <Card className={styles.stateCard}>
          <Storefront aria-hidden size={36} />
          <div>
            <h2>
              {view === "upcoming"
                ? "Nenhuma tutoria agendada"
                : "Seu histórico ainda está vazio"}
            </h2>
            <p>
              {view === "upcoming"
                ? "Explore as tutorias disponíveis e reserve uma vaga quando precisar de apoio."
                : "Tutorias concluídas ou canceladas aparecerão aqui."}
            </p>
          </div>
          {view === "upcoming" ? (
            <Link className={styles.exploreLink} href="/sessoes">
              Explorar tutorias
            </Link>
          ) : null}
        </Card>
      ) : (
        <ul
          className={styles.list}
          aria-label={view === "upcoming" ? "Próximas tutorias" : "Histórico de tutorias"}
        >
          {visible.map((booking) => {
            const starts = new Date(booking.session.starts_at);
            const isPast = starts.getTime() <= now;
            const displayStatus =
              booking.status === "cancelled"
                ? "Cancelada"
                : isPast
                  ? "Concluída"
                  : "Confirmada";
            const badgeVariant =
              displayStatus === "Cancelada"
                ? "danger"
                : displayStatus === "Concluída"
                  ? "neutral"
                  : "success";

            return (
              <li key={booking.booking_id}>
                <Card className={styles.bookingCard}>
                  <div className={styles.bookingMain}>
                    <div className={styles.bookingHeading}>
                      <Badge variant={badgeVariant}>{displayStatus}</Badge>
                      <h2>{booking.session.title}</h2>
                    </div>

                    <div className={styles.meta}>
                      <span>
                        <CalendarBlank aria-hidden size={16} />
                        {starts.toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                        {" · "}
                        {starts.toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span>
                        <UsersThree aria-hidden size={16} />
                        {booking.session.tutor_name}
                      </span>
                    </div>
                  </div>

                  <div className={styles.bookingAside}>
                    <strong>
                      {formatCents(
                        booking.transaction.amount_cents,
                        booking.transaction.currency,
                      )}
                    </strong>
                    <div className={styles.bookingActions}>
                      <Link href={`/sessoes/${booking.session_id}`}>Ver detalhes</Link>
                      {view === "upcoming" && booking.status === "confirmed" ? (
                        <Button
                          onClick={() => setCancelTarget(booking)}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          Cancelar
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {!loading && !error && bookings.length > 0 ? (
        <nav aria-label="Paginação das tutorias" className={styles.pagination}>
          <Button
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            size="sm"
            type="button"
            variant="secondary"
          >
            Anterior
          </Button>
          <span>Página {Math.floor(offset / PAGE_SIZE) + 1}</span>
          <Button
            disabled={bookings.length < PAGE_SIZE}
            onClick={() => setOffset(offset + PAGE_SIZE)}
            size="sm"
            type="button"
            variant="secondary"
          >
            Próxima
          </Button>
        </nav>
      ) : null}

      {cancelTarget ? (
        <Dialog
          descriptionId="cancel-booking-description"
          onClose={() => {
            if (!busy) setCancelTarget(null);
          }}
          titleId="cancel-booking-title"
        >
          <div className={styles.dialogContent}>
            <div>
              <p className={styles.dialogEyebrow}>Sua reserva</p>
              <h2 id="cancel-booking-title">Cancelar reserva?</h2>
              <p id="cancel-booking-description">
                A vaga em <strong>{cancelTarget.session.title}</strong> será liberada imediatamente.
              </p>
            </div>
            <div className={styles.dialogActions}>
              <Button
                disabled={busy}
                onClick={() => setCancelTarget(null)}
                type="button"
                variant="secondary"
              >
                Manter reserva
              </Button>
              <Button
                loading={busy}
                onClick={confirmCancellation}
                type="button"
                variant="danger"
              >
                Cancelar reserva
              </Button>
            </div>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
