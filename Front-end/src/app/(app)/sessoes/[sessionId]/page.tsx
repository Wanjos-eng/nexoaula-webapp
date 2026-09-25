"use client";

import {
  ArrowLeft,
  CalendarBlank,
  CheckCircle,
  MapPin,
  UsersThree,
  Video,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { useAuthSession } from "@/modules/auth";
import { useMarketplace } from "@/modules/marketplace/useMarketplace";
import { marketplaceApi, marketplaceError, marketplacePath, type Booking, type PublishedSession } from "@/modules/marketplace/marketplace.api";
import type { EnrollmentReceipt } from "@/modules/marketplace/marketplace.types";
import {
  formatCents,
} from "@/modules/marketplace/marketplace.types";
import styles from "./page.module.css";

type EnrollState = "idle" | "confirming" | "done" | "cancelled" | "error";

export default function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  return <SessionDetail key={sessionId} sessionId={sessionId} />;
}

function SessionDetail({ sessionId }: { sessionId: string }) {
  const { user } = useAuthSession();
  const details = useMarketplace<PublishedSession>(`${marketplacePath}/sessions/${sessionId}`);
  const history = useMarketplace<Booking[]>(`${marketplacePath}/bookings/mine?session_id=${sessionId}&limit=100`);
  const [actionState, setEnrollState] = useState<EnrollState | null>(null);
  const [savedReceipt, setSavedReceipt] = useState<EnrollmentReceipt | null>(null);
  const [now] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [failureMessage, setFailureMessage] = useState("");
  const receipt = savedReceipt ?? history.data?.find((booking) => booking.session_id === sessionId && booking.status === "confirmed") ?? null;
  const enrollState = actionState ?? (receipt?.status === "confirmed" ? "done" : "idle");
  const session = details.data;
  if (details.loading || history.loading) return <main><p role="status">Carregando sessão…</p></main>;
  if (!session || details.error || history.error) return <main><p role="alert">{details.error ?? history.error ?? "Sessão indisponível."}</p><button onClick={() => { details.refresh(); history.refresh(); }}>Tentar novamente</button><Link href="/sessoes/minhas">Ver minhas inscrições</Link></main>;

  const isFull = session.enrolled_count >= session.capacity;
  const ownOffer = session.tutor_user_id === user.id;
  const isUnavailable = isFull || ownOffer || session.status !== "scheduled" || new Date(session.starts_at).getTime() <= now;
  const commission = receipt?.transaction.commission_cents ?? session.commission_cents;
  const amount = receipt?.transaction.amount_cents ?? session.price_cents;
  const netTutor = amount - commission;
  const starts = new Date(session.starts_at);
  const ends = new Date(session.ends_at);
  function handleEnroll() { setEnrollState("confirming"); }
  function handleCancel() { setEnrollState(null); }
  async function handleConfirm() {
    if (busy) return;
    setBusy(true);
    try {
      setSavedReceipt(await marketplaceApi.enroll(sessionId));
      setEnrollState("done");
      details.refresh(); history.refresh();
    } catch (error) {
      setFailureMessage(marketplaceError(error)); setEnrollState("error");
    } finally { setBusy(false); }
  }
  async function handleCancelEnrollment() {
    if (busy) return;
    setBusy(true);
    try {
      setSavedReceipt(await marketplaceApi.cancel(sessionId));
      setEnrollState("cancelled");
      details.refresh(); history.refresh();
    } catch (error) {
      setFailureMessage(marketplaceError(error)); setEnrollState("error");
    } finally { setBusy(false); }
  }

  return (
    <main className={styles.page}>
      <Link href="/sessoes" className={styles.back}>
        <ArrowLeft aria-hidden size={16} /> Voltar às sessões
      </Link>

      <div
        className={styles.simulationBanner}
        role="note"
        aria-label="Aviso de simulação acadêmica"
      >
        🎓 <strong>Demonstração acadêmica.</strong> Nenhum pagamento real será
        realizado. Os valores exibidos são apenas demonstrativos.
      </div>

      <div className={styles.layout}>
        {/* Main content */}
        <section className={styles.main}>
          <span className={styles.subject}>{session.subject_name}</span>
          <h1 className={styles.title}>{session.title}</h1>
          <p className={styles.tutor}>por <strong>{session.tutor_name}</strong></p>

          {session.description && (
            <p className={styles.description}>{session.description}</p>
          )}

          <dl className={styles.facts}>
            <div>
              <dt>
                <CalendarBlank aria-hidden size={16} /> Início
              </dt>
              <dd>
                {starts.toLocaleString("pt-BR", {
                  day: "numeric",
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </dd>
            </div>
            <div>
              <dt>
                <CalendarBlank aria-hidden size={16} /> Término
              </dt>
              <dd>
                {ends.toLocaleString("pt-BR", {
                  day: "numeric",
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </dd>
            </div>
            <div>
              <dt>
                {session.modality === "online" ? (
                  <Video aria-hidden size={16} />
                ) : (
                  <MapPin aria-hidden size={16} />
                )}{" "}
                Formato
              </dt>
              <dd>
                {session.modality === "online"
                  ? "Online"
                  : session.modality === "in_person"
                    ? "Presencial"
                    : "Híbrido"}
                {session.location && ` — ${session.location}`}
              </dd>
            </div>
            <div>
              <dt>
                <UsersThree aria-hidden size={16} /> Vagas
              </dt>
              <dd>
                {session.enrolled_count} inscritos de {session.capacity} disponíveis
              </dd>
            </div>
          </dl>
        </section>

        {/* Sidebar / enrollment */}
        <aside className={styles.sidebar}>
          <div className={styles.priceCard}>
            <p className={styles.priceLabel}>Valor demonstrativo</p>
            <p className={styles.priceValue}>
              {formatCents(amount, session.currency)}
            </p>
            <p className={styles.priceNote}>O recibo e a comissão são gerados pelo servidor após a inscrição.</p>
            <hr className={styles.divider} />

            {enrollState === "idle" && (
              <button
                className={styles.enrollButton}
                disabled={isUnavailable || busy}
                onClick={handleEnroll}
                type="button"
              >
                {ownOffer ? "Esta é sua oferta" : isFull ? "Vagas esgotadas" : isUnavailable ? "Sessão indisponível" : "Simular Inscrição"}
              </button>
            )}

            {enrollState === "confirming" && (
              <div className={styles.confirmBox} role="dialog" aria-label="Confirmar inscrição simulada">
                <p className={styles.confirmText}>
                  Confirmar inscrição em{" "}
                  <strong>{session.title}</strong>?
                </p>
                <p className={styles.simulationNote}>
                  <WarningCircle aria-hidden size={15} weight="fill" />
                  Esta é uma simulação acadêmica. Nenhum pagamento será
                  cobrado.
                </p>
                <div className={styles.confirmActions}>
                  <button
                    className={styles.cancelButton}
                    onClick={handleCancel}
                    type="button"
                  >
                    Cancelar
                  </button>
                  <button
                    className={styles.confirmButton}
                    disabled={busy}
                    onClick={handleConfirm}
                    type="button"
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            )}

            {enrollState === "done" && (
              <div
                className={styles.receipt}
                role="status"
                aria-live="polite"
                aria-label="Recibo de inscrição simulada"
              >
                <CheckCircle
                  aria-hidden
                  className={styles.receiptIcon}
                  size={32}
                  weight="fill"
                />
                <p className={styles.receiptTitle}>Inscrição simulada confirmada!</p>
                <dl className={styles.receiptDetails}>
                  <div>
                    <dt>Valor demonstrativo</dt>
                    <dd>{formatCents(amount, session.currency)}</dd>
                  </div>
                  <div>
                    <dt>Comissão nexoAula (15%)</dt>
                    <dd>{formatCents(receipt?.transaction.commission_cents ?? 0, session.currency)}</dd>
                  </div>
                  <div>
                    <dt>Repasse simulado ao tutor</dt>
                    <dd>{formatCents((receipt?.transaction.amount_cents ?? 0) - (receipt?.transaction.commission_cents ?? 0), session.currency)}</dd>
                  </div>
                </dl>
                <p className={styles.receiptNotice}>
                  {receipt?.notice}
                </p>
                <button
                  className={styles.cancelEnrollButton}
                  disabled={busy}
                  onClick={handleCancelEnrollment}
                  type="button"
                >
                  Cancelar inscrição
                </button>
              </div>
            )}

            {enrollState === "cancelled" && (
              <div
                className={styles.cancelledBox}
                role="status"
                aria-live="polite"
              >
                <XCircle aria-hidden size={28} weight="fill" />
                <p>Inscrição cancelada.</p>
                <button
                  className={styles.enrollButton}
                  onClick={handleEnroll}
                  type="button"
                >
                  Inscrever-se novamente
                </button>
              </div>
            )}

            {enrollState === "error" && (
              <div className={styles.errorBox} role="alert">
                <WarningCircle aria-hidden size={28} weight="fill" />
                <p>{failureMessage}</p>
                <button
                  className={styles.enrollButton}
                  onClick={() => { setEnrollState(null); details.refresh(); history.refresh(); }}
                  type="button"
                >
                  Atualizar inscrição
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
