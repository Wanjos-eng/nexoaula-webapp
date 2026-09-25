"use client";

import {
  CalendarBlank,
  CheckCircle,
  Plus,
  Storefront,
  UsersThree,
  WarningCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";

import { activateTutorProfile, apiErrorMessage, useMyBookings, useMySessions, useTutorProfile } from "@/modules/marketplace/marketplace.api";
import { formatCents } from "@/modules/marketplace/marketplace.types";
import styles from "./page.module.css";

type TutorActivationState = "inactive" | "activating" | "active";

export default function TutorPage() {
  const [activation, setActivation] =
    useState<TutorActivationState>("inactive");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [activationError, setActivationError] = useState("");
  const { data: savedProfile } = useTutorProfile();

  const { data: myBookings } = useMyBookings();
  const { data: mySessions } = useMySessions();

  async function handleActivate() {
    try {
      await activateTutorProfile(headline, bio);
      setActivationError("");
      setActivation("active");
    } catch (error: unknown) {
      setActivationError(apiErrorMessage(error));
    }
  }

  const isActive = activation === "active" || savedProfile?.status === "active";

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.eyebrow}>
          <Storefront aria-hidden size={18} weight="fill" />
          Painel do Tutor
        </div>
        <h1 className={styles.title}>Meu perfil profissional</h1>
        <p className={styles.subtitle}>
          Ative seu perfil para criar e publicar sessões de tutoria.
        </p>
        <div
          className={styles.simulationBanner}
          role="note"
          aria-label="Aviso de simulação acadêmica"
        >
          🎓 <strong>Demonstração acadêmica.</strong> Nenhum pagamento real
          será realizado. Os valores são apenas demonstrativos.
        </div>
      </header>

      {/* Profile activation */}
      <section className={styles.section} aria-labelledby="profile-heading">
        <h2 id="profile-heading" className={styles.sectionTitle}>
          Perfil profissional
        </h2>

        {activation === "inactive" && !isActive ? (
          <div className={styles.activationCard}>
            <WarningCircle aria-hidden size={32} weight="fill" className={styles.warningIcon} />
            <p>
              Você ainda não ativou seu perfil profissional. Ative para poder
              criar sessões de tutoria simuladas.
            </p>
            <button
              className={styles.activateButton}
              onClick={() => setActivation("activating")}
              type="button"
            >
              Ativar perfil profissional
            </button>
          </div>
        ) : activation === "activating" ? (
          <form
            className={styles.profileForm}
            onSubmit={(e) => {
              e.preventDefault();
              handleActivate();
            }}
          >
            <label className={styles.field}>
              <span>Título profissional</span>
              <input
                id="tutor-headline"
                maxLength={200}
                placeholder="Ex: Monitor de Cálculo II — UNIVASF"
                required
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span>Bio (opcional)</span>
              <textarea
                id="tutor-bio"
                maxLength={500}
                placeholder="Conte um pouco sobre sua experiência e as disciplinas que você tutora."
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </label>
            <div className={styles.formActions}>
              <button
                className={styles.cancelButton}
                onClick={() => setActivation("inactive")}
                type="button"
              >
                Cancelar
              </button>
              <button className={styles.activateButton} type="submit">
                Confirmar ativação
              </button>
            </div>
          </form>
        ) : (
          <div
            className={styles.activeProfile}
            role="status"
            aria-live="polite"
          >
            <CheckCircle
              aria-hidden
              className={styles.successIcon}
              size={28}
              weight="fill"
            />
            <div>
              <p className={styles.activeTitle}>
                {savedProfile?.headline || headline || "Perfil profissional ativo"}
              </p>
              {(savedProfile?.bio || bio) && <p className={styles.activeBio}>{savedProfile?.bio || bio}</p>}
            </div>
          </div>
        )}
        {activationError ? <p role="alert">{activationError}</p> : null}
      </section>

      {/* My sessions — would be listed from API */}
      {isActive && (
        <section className={styles.section} aria-labelledby="sessions-heading">
          <div className={styles.sectionHeader}>
            <h2 id="sessions-heading" className={styles.sectionTitle}>
              Minhas sessões
            </h2>
            <Link className={styles.newButton} href="/tutor/nova-sessao">
              <Plus aria-hidden size={16} />
              Nova sessão
            </Link>
          </div>
          {mySessions.length === 0 ? <p className={styles.emptyNote}>Nenhuma sessão criada ainda. Crie a sua primeira sessão de tutoria.</p> : (
            <ul className={styles.bookingList}>{mySessions.map((session) => <li className={styles.bookingCard} key={session.id}><div><p className={styles.bookingTitle}>{session.title}</p><p className={styles.bookingMeta}>{session.status}</p></div></li>)}</ul>
          )}
        </section>
      )}

      {/* Student bookings */}
      <section className={styles.section} aria-labelledby="bookings-heading">
        <h2 id="bookings-heading" className={styles.sectionTitle}>
          Minhas inscrições
        </h2>

        {myBookings.length === 0 ? (
          <p className={styles.emptyNote}>
            Você ainda não se inscreveu em nenhuma sessão.{" "}
            <Link href="/sessoes">Explorar sessões disponíveis</Link>
          </p>
        ) : (
          <ul className={styles.bookingList}>
            {myBookings.map((booking) => {
              const starts = new Date(booking.session.starts_at);
              return (
                <li key={booking.id} className={styles.bookingCard}>
                  <div className={styles.bookingInfo}>
                    <span className={styles.bookingStatus}>
                      {booking.status === "confirmed"
                        ? "✅ Confirmada"
                        : booking.status === "cancelled"
                          ? "❌ Cancelada"
                          : booking.status}
                    </span>
                    <p className={styles.bookingTitle}>
                      {booking.session.title}
                    </p>
                    <p className={styles.bookingMeta}>
                      <CalendarBlank aria-hidden size={13} />{" "}
                      {starts.toLocaleDateString("pt-BR", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      &nbsp;·&nbsp;
                      <UsersThree aria-hidden size={13} />{" "}
                      {booking.session.tutor_name}
                    </p>
                  </div>
                  <p className={styles.bookingPrice}>
                    {formatCents(
                      booking.session.price_cents,
                      booking.session.currency,
                    )}{" "}
                    <small>(simulado)</small>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
