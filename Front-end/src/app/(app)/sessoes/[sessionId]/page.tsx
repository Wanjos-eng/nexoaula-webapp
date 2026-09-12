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
import { notFound } from "next/navigation";
import { useState } from "react";

import { mockSessions } from "@/modules/marketplace/marketplace.mock";
import {
  calcCommission,
  formatCents,
} from "@/modules/marketplace/marketplace.types";
import styles from "./page.module.css";

type Props = { params: { sessionId: string } };

type EnrollState = "idle" | "confirming" | "done" | "cancelled";

export default function SessionDetailPage({ params }: Props) {
  const session = mockSessions.find((s) => s.id === params.sessionId);
  if (!session) notFound();

  const [enrollState, setEnrollState] = useState<EnrollState>("idle");
  const isFull = session.enrolled_count >= session.capacity;
  const commission = calcCommission(session.price_cents);
  const netTutor = session.price_cents - commission;

  const starts = new Date(session.starts_at);
  const ends = new Date(session.ends_at);

  function handleEnroll() {
    setEnrollState("confirming");
  }

  function handleConfirm() {
    setEnrollState("done");
  }

  function handleCancel() {
    setEnrollState("idle");
  }

  function handleCancelEnrollment() {
    setEnrollState("cancelled");
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
              {formatCents(session.price_cents, session.currency)}
            </p>
            <p className={styles.priceNote}>
              Comissão da plataforma (15%):{" "}
              <strong>{formatCents(commission, session.currency)}</strong>
            </p>
            <p className={styles.priceNote}>
              Repasse líquido ao tutor:{" "}
              <strong>{formatCents(netTutor, session.currency)}</strong>
            </p>
            <hr className={styles.divider} />

            {enrollState === "idle" && (
              <button
                className={styles.enrollButton}
                disabled={isFull}
                onClick={handleEnroll}
                type="button"
              >
                {isFull ? "Vagas esgotadas" : "Simular Inscrição"}
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
                    <dd>{formatCents(session.price_cents, session.currency)}</dd>
                  </div>
                  <div>
                    <dt>Comissão nexoAula (15%)</dt>
                    <dd>{formatCents(commission, session.currency)}</dd>
                  </div>
                  <div>
                    <dt>Repasse ao tutor</dt>
                    <dd>{formatCents(netTutor, session.currency)}</dd>
                  </div>
                </dl>
                <p className={styles.receiptNotice}>
                  Nenhum pagamento foi processado. Esta é uma demonstração
                  acadêmica.
                </p>
                <button
                  className={styles.cancelEnrollButton}
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
          </div>
        </aside>
      </div>
    </main>
  );
}
