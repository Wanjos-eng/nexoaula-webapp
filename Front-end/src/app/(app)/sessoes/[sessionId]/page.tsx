"use client";

import {
  CalendarBlank,
  CheckCircle,
  MapPin,
  Storefront,
  UsersThree,
  Video,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useState } from "react";

import { BackButton } from "@/components/ui/BackButton";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuthSession } from "@/modules/auth";
import {
  marketplaceApi,
  marketplaceError,
  marketplacePath,
  type Booking,
  type PublishedSession,
} from "@/modules/marketplace/marketplace.api";
import type { EnrollmentReceipt } from "@/modules/marketplace/marketplace.types";
import { formatCents } from "@/modules/marketplace/marketplace.types";
import { useMarketplace } from "@/modules/marketplace/useMarketplace";
import styles from "./page.module.css";

type ActionState = "idle" | "done" | "cancelled" | "error";
type DialogMode = "reserve" | "cancel" | null;

export default function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  return <SessionDetail key={sessionId} sessionId={sessionId} />;
}

function SessionDetail({ sessionId }: { sessionId: string }) {
  const { user } = useAuthSession();
  const details = useMarketplace<PublishedSession>(
    `${marketplacePath}/sessions/${sessionId}`,
  );
  const history = useMarketplace<Booking[]>(
    `${marketplacePath}/bookings/mine?session_id=${sessionId}&limit=100`,
  );
  const [actionState, setActionState] = useState<ActionState | null>(null);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [savedReceipt, setSavedReceipt] = useState<EnrollmentReceipt | null>(null);
  const [now] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [failureMessage, setFailureMessage] = useState("");

  const closeDialog = useCallback(() => {
    if (!busy) setDialogMode(null);
  }, [busy]);

  const receipt =
    savedReceipt ??
    history.data?.find(
      (booking) =>
        booking.session_id === sessionId && booking.status === "confirmed",
    ) ??
    null;
  const state =
    actionState ?? (receipt?.status === "confirmed" ? "done" : "idle");

  if (details.loading || history.loading) {
    return (
      <div className={styles.page} aria-label="Carregando tutoria" role="status">
        <span className="sr-only">Carregando tutoria...</span>
        <Skeleton className={styles.backSkeleton} variant="text" />
        <div className={styles.loadingLayout}>
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
      </div>
    );
  }

  const session = details.data;
  if (!session || details.error || history.error) {
    return (
      <div className={styles.page}>
        <BackButton fallback="/sessoes">Voltar para tutorias</BackButton>
        <Card className={styles.stateCard}>
          <WarningCircle aria-hidden size={34} />
          <div>
            <h1>Não foi possível abrir esta tutoria</h1>
            <p>{details.error ?? history.error ?? "Tutoria indisponível."}</p>
          </div>
          <div className={styles.stateActions}>
            <Button
              onClick={() => {
                details.refresh();
                history.refresh();
              }}
              size="sm"
              type="button"
              variant="secondary"
            >
              Tentar novamente
            </Button>
            <Link href="/sessoes/minhas">Ver minhas tutorias</Link>
          </div>
        </Card>
      </div>
    );
  }

  const isFull = session.available_seats <= 0;
  const ownOffer = session.tutor_user_id === user.id;
  const hasStarted = new Date(session.starts_at).getTime() <= now;
  const isUnavailable =
    isFull || ownOffer || session.status !== "scheduled" || hasStarted;
  const amount = receipt?.transaction.amount_cents ?? session.price_cents;
  const starts = new Date(session.starts_at);
  const ends = new Date(session.ends_at);

  async function confirmReservation() {
    if (busy) return;
    setBusy(true);
    setFailureMessage("");

    try {
      setSavedReceipt(await marketplaceApi.enroll(sessionId));
      setActionState("done");
      setDialogMode(null);
      details.refresh();
      history.refresh();
    } catch (error) {
      setFailureMessage(marketplaceError(error));
      setActionState("error");
      setDialogMode(null);
    } finally {
      setBusy(false);
    }
  }

  async function confirmCancellation() {
    if (busy) return;
    setBusy(true);
    setFailureMessage("");

    try {
      setSavedReceipt(await marketplaceApi.cancel(sessionId));
      setActionState("cancelled");
      setDialogMode(null);
      details.refresh();
      history.refresh();
    } catch (error) {
      setFailureMessage(marketplaceError(error));
      setActionState("error");
      setDialogMode(null);
    } finally {
      setBusy(false);
    }
  }

  const actionLabel = ownOffer
    ? "Esta tutoria é sua"
    : isFull
      ? "Vagas esgotadas"
      : hasStarted || session.status !== "scheduled"
        ? "Tutoria indisponível"
        : "Reservar vaga";

  return (
    <div className={styles.page}>
      <BackButton fallback="/sessoes">Voltar para tutorias</BackButton>

      <div className={styles.layout}>
        <section className={styles.content}>
          <div className={styles.hero}>
            <div className={styles.heroMeta}>
              <Badge variant="success">{session.subject_name}</Badge>
              {isFull ? (
                <Badge variant="danger">Lotada</Badge>
              ) : session.available_seats <= 3 ? (
                <Badge variant="warning">Poucas vagas</Badge>
              ) : null}
            </div>
            <h1>{session.title}</h1>
            <p className={styles.tutor}>
              com <strong>{session.tutor_name}</strong>
            </p>
            {session.description ? (
              <p className={styles.description}>{session.description}</p>
            ) : null}
          </div>

          <Card className={styles.detailsCard}>
            <h2>Detalhes da tutoria</h2>
            <dl className={styles.facts}>
              <div>
                <dt>
                  <CalendarBlank aria-hidden size={18} />
                  Data e horário
                </dt>
                <dd>
                  {starts.toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                  {" · "}
                  {starts.toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {"–"}
                  {ends.toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </dd>
              </div>
              <div>
                <dt>
                  {session.modality === "online" ? (
                    <Video aria-hidden size={18} />
                  ) : (
                    <MapPin aria-hidden size={18} />
                  )}
                  Modalidade
                </dt>
                <dd>
                  {session.modality === "online"
                    ? "Online"
                    : session.modality === "in_person"
                      ? "Presencial"
                      : "Híbrida"}
                  {session.location ? ` · ${session.location}` : ""}
                </dd>
              </div>
              <div>
                <dt>
                  <UsersThree aria-hidden size={18} />
                  Disponibilidade
                </dt>
                <dd>
                  {session.available_seats} de {session.capacity} vagas disponíveis
                </dd>
              </div>
            </dl>
          </Card>
        </section>

        <aside className={styles.bookingColumn}>
          <Card className={styles.bookingCard}>
            <div className={styles.price}>
              <span>Valor da tutoria</span>
              <strong>{formatCents(amount, session.currency)}</strong>
            </div>

            <div className={styles.demoNotice}>
              <Storefront aria-hidden size={17} />
              <p>
                Ambiente demonstrativo. Nenhuma cobrança real será realizada.
              </p>
            </div>

            {state === "idle" ? (
              <Button
                disabled={isUnavailable}
                fullWidth
                onClick={() => setDialogMode("reserve")}
                type="button"
              >
                {actionLabel}
              </Button>
            ) : null}

            {state === "done" ? (
              <div
                aria-label="Reserva de tutoria confirmada"
                aria-live="polite"
                className={styles.successState}
                role="status"
              >
                <CheckCircle aria-hidden size={34} weight="fill" />
                <div>
                  <h2>Vaga reservada</h2>
                  <p>Sua participação nesta tutoria está confirmada.</p>
                </div>
                <dl className={styles.receipt}>
                  <div>
                    <dt>Valor</dt>
                    <dd>{formatCents(amount, session.currency)}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>Confirmada</dd>
                  </div>
                </dl>
                {receipt?.notice ? (
                  <p className={styles.receiptNotice}>{receipt.notice}</p>
                ) : null}
                <Link className={styles.secondaryLink} href="/sessoes/minhas">
                  Ver minhas tutorias
                </Link>
                <Button
                  fullWidth
                  onClick={() => setDialogMode("cancel")}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Cancelar reserva
                </Button>
              </div>
            ) : null}

            {state === "cancelled" ? (
              <div className={styles.cancelledState} role="status">
                <XCircle aria-hidden size={30} weight="fill" />
                <div>
                  <h2>Reserva cancelada</h2>
                  <p>Sua vaga foi liberada para outra pessoa.</p>
                </div>
                <Button
                  disabled={isUnavailable}
                  fullWidth
                  onClick={() => setDialogMode("reserve")}
                  type="button"
                >
                  Reservar novamente
                </Button>
              </div>
            ) : null}

            {state === "error" ? (
              <div className={styles.errorState} role="alert">
                <WarningCircle aria-hidden size={30} weight="fill" />
                <div>
                  <h2>Não foi possível concluir</h2>
                  <p>{failureMessage}</p>
                </div>
                <Button
                  fullWidth
                  onClick={() => {
                    setActionState(null);
                    details.refresh();
                    history.refresh();
                  }}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Atualizar
                </Button>
              </div>
            ) : null}
          </Card>
        </aside>
      </div>

      {dialogMode === "reserve" ? (
        <Dialog
          descriptionId="reserve-dialog-description"
          onClose={closeDialog}
          titleId="reserve-dialog-title"
        >
          <div className={styles.dialogContent}>
            <div>
              <p className={styles.dialogEyebrow}>Resumo da reserva</p>
              <h2 id="reserve-dialog-title">Confirmar reserva</h2>
              <p id="reserve-dialog-description">
                Revise os dados antes de confirmar sua vaga.
              </p>
            </div>
            <dl className={styles.summary}>
              <div>
                <dt>Tutoria</dt>
                <dd>{session.title}</dd>
              </div>
              <div>
                <dt>Tutor</dt>
                <dd>{session.tutor_name}</dd>
              </div>
              <div>
                <dt>Horário</dt>
                <dd>
                  {starts.toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                  })}
                  {" · "}
                  {starts.toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </dd>
              </div>
              <div className={styles.summaryTotal}>
                <dt>Total</dt>
                <dd>{formatCents(session.price_cents, session.currency)}</dd>
              </div>
            </dl>
            <p className={styles.dialogNotice}>
              Ambiente demonstrativo. Nenhuma cobrança real será realizada.
            </p>
            <div className={styles.dialogActions}>
              <Button
                disabled={busy}
                onClick={closeDialog}
                type="button"
                variant="secondary"
              >
                Voltar
              </Button>
              <Button
                loading={busy}
                onClick={confirmReservation}
                type="button"
              >
                Confirmar reserva
              </Button>
            </div>
          </div>
        </Dialog>
      ) : null}

      {dialogMode === "cancel" ? (
        <Dialog
          descriptionId="cancel-dialog-description"
          onClose={closeDialog}
          titleId="cancel-dialog-title"
        >
          <div className={styles.dialogContent}>
            <div>
              <p className={styles.dialogEyebrow}>Sua reserva</p>
              <h2 id="cancel-dialog-title">Cancelar reserva?</h2>
              <p id="cancel-dialog-description">
                A vaga será liberada imediatamente para outra pessoa.
              </p>
            </div>
            <div className={styles.dialogActions}>
              <Button
                disabled={busy}
                onClick={closeDialog}
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
