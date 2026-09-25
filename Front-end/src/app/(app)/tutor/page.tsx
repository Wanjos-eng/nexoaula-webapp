"use client";

import { CalendarBlank, IdentificationCard, Plus, Storefront } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";

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
  type SessionOffer,
} from "@/modules/marketplace/marketplace.api";
import { formatCents, type TutorProfile } from "@/modules/marketplace/marketplace.types";
import { useMarketplace } from "@/modules/marketplace/useMarketplace";
import styles from "./page.module.css";

type OfferView = "active" | "drafts" | "history";
type DialogMode = "activate" | "pause" | "cancel" | null;

const STATUS_LABEL = {
  draft: "Rascunho",
  scheduled: "Publicada",
  completed: "Concluída",
  cancelled: "Cancelada",
} as const;

export default function TutorPage() {
  const profile = useMarketplace<TutorProfile | null>(`${marketplacePath}/tutor`);
  const offers = useMarketplace<SessionOffer[]>(
    `${marketplacePath}/sessions/mine?limit=100&offset=0`,
  );
  const [view, setView] = useState<OfferView>("active");
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [selectedOffer, setSelectedOffer] = useState<SessionOffer | null>(null);
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  const activeProfile = profile.data?.status === "active";
  const grouped = useMemo(() => {
    const source = offers.data ?? [];
    return {
      active: source.filter((offer) => offer.status === "scheduled"),
      drafts: source.filter((offer) => offer.status === "draft"),
      history: source.filter(
        (offer) => offer.status === "completed" || offer.status === "cancelled",
      ),
    };
  }, [offers.data]);

  const visibleOffers = grouped[view];

  async function runMutation(
    action: () => Promise<unknown>,
    successMessage: string,
  ) {
    if (busy) return;
    setBusy(true);

    try {
      await action();
      setDialogMode(null);
      setSelectedOffer(null);
      profile.refresh();
      offers.refresh();
      showToast({ message: successMessage, variant: "success" });
    } catch (cause) {
      showToast({ message: marketplaceError(cause), variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  function openActivation() {
    setHeadline(profile.data?.headline ?? "");
    setBio(profile.data?.bio ?? "");
    setDialogMode("activate");
  }

  function openCancel(offer: SessionOffer) {
    setSelectedOffer(offer);
    setDialogMode("cancel");
  }

  return (
    <div className={styles.page}>
      <PageHeader
        actions={
          activeProfile ? (
            <Link className={styles.primaryLink} href="/tutor/nova-sessao">
              <Plus aria-hidden size={18} weight="bold" />
              Criar tutoria
            </Link>
          ) : null
        }
        description="Gerencie seu perfil profissional e acompanhe as tutorias que você oferece à comunidade."
        eyebrow="Área do Tutor"
        title="Painel do Tutor"
      />

      <div className={styles.demoNotice} role="note">
        <Storefront aria-hidden size={18} />
        <span>
          Ambiente demonstrativo. Nenhuma cobrança real será realizada.
        </span>
      </div>

      <section aria-labelledby="profile-title" className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="profile-title">Perfil de tutor</h2>
            <p>Controle sua disponibilidade para publicar novas tutorias.</p>
          </div>
        </div>

        {profile.loading ? (
          <Skeleton variant="row" />
        ) : profile.error ? (
          <Card className={styles.errorCard}>
            <p>{profile.error}</p>
            <Button onClick={profile.refresh} size="sm" type="button" variant="secondary">
              Tentar novamente
            </Button>
          </Card>
        ) : (
          <Card className={styles.profileCard}>
            <div className={styles.profileIdentity}>
              <div className={styles.profileIcon}>
                <IdentificationCard aria-hidden size={22} />
              </div>
              <div>
                <div className={styles.profileStatus}>
                  <strong>
                    {profile.data?.headline ||
                      (activeProfile ? "Perfil profissional ativo" : "Perfil de tutor")}
                  </strong>
                  <Badge variant={activeProfile ? "success" : "neutral"}>
                    {profile.data?.status === "suspended"
                      ? "Suspenso"
                      : activeProfile
                        ? "Ativo"
                        : "Inativo"}
                  </Badge>
                </div>
                <p>
                  {profile.data?.bio ||
                    (activeProfile
                      ? "Seu perfil está disponível para publicação de tutorias."
                      : "Ative seu perfil para começar a oferecer tutorias.")}
                </p>
              </div>
            </div>

            <div className={styles.profileActions}>
              {activeProfile ? (
                <Button
                  onClick={() => setDialogMode("pause")}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Gerenciar
                </Button>
              ) : profile.data?.status !== "suspended" ? (
                <Button onClick={openActivation} size="sm" type="button">
                  {profile.data ? "Retomar perfil" : "Ativar perfil"}
                </Button>
              ) : null}
            </div>
          </Card>
        )}
      </section>

      <section aria-labelledby="overview-title" className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="overview-title">Visão geral</h2>
            <p>Resumo das suas ofertas cadastradas.</p>
          </div>
        </div>

        {offers.loading ? (
          <div className={styles.metrics}>
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} variant="row" />
            ))}
          </div>
        ) : (
          <div className={styles.metrics}>
            <Card className={styles.metricCard}>
              <span>Ativas</span>
              <strong>{grouped.active.length}</strong>
            </Card>
            <Card className={styles.metricCard}>
              <span>Rascunhos</span>
              <strong>{grouped.drafts.length}</strong>
            </Card>
            <Card className={styles.metricCard}>
              <span>Concluídas</span>
              <strong>
                {(offers.data ?? []).filter((offer) => offer.status === "completed").length}
              </strong>
            </Card>
            <Card className={styles.metricCard}>
              <span>Canceladas</span>
              <strong>
                {(offers.data ?? []).filter((offer) => offer.status === "cancelled").length}
              </strong>
            </Card>
          </div>
        )}
      </section>

      <section aria-labelledby="offers-title" className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="offers-title">Suas tutorias</h2>
            <p>Publique rascunhos e acompanhe o histórico das suas ofertas.</p>
          </div>
        </div>

        <div className={styles.tabs} role="tablist" aria-label="Estado das tutorias oferecidas">
          <button
            aria-selected={view === "active"}
            className={view === "active" ? styles.tabActive : ""}
            onClick={() => setView("active")}
            role="tab"
            type="button"
          >
            Ativas <span>{grouped.active.length}</span>
          </button>
          <button
            aria-selected={view === "drafts"}
            className={view === "drafts" ? styles.tabActive : ""}
            onClick={() => setView("drafts")}
            role="tab"
            type="button"
          >
            Rascunhos <span>{grouped.drafts.length}</span>
          </button>
          <button
            aria-selected={view === "history"}
            className={view === "history" ? styles.tabActive : ""}
            onClick={() => setView("history")}
            role="tab"
            type="button"
          >
            Histórico <span>{grouped.history.length}</span>
          </button>
        </div>

        {offers.loading ? (
          <div className={styles.offerList} role="status" aria-label="Carregando tutorias do tutor">
            <span className="sr-only">Carregando tutorias...</span>
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} variant="row" />
            ))}
          </div>
        ) : offers.error ? (
          <Card className={styles.errorCard}>
            <p>{offers.error}</p>
            <Button onClick={offers.refresh} size="sm" type="button" variant="secondary">
              Tentar novamente
            </Button>
          </Card>
        ) : visibleOffers.length === 0 ? (
          <Card className={styles.emptyCard}>
            <Storefront aria-hidden size={34} />
            <div>
              <h3>
                {view === "active"
                  ? "Nenhuma tutoria ativa"
                  : view === "drafts"
                    ? "Nenhum rascunho"
                    : "Seu histórico está vazio"}
              </h3>
              <p>
                {view === "active" && activeProfile
                  ? "Publique uma nova tutoria para ela aparecer aqui."
                  : view === "drafts"
                    ? "Tutorias ainda não publicadas aparecerão nesta aba."
                    : "Tutorias concluídas ou canceladas aparecerão aqui."}
              </p>
            </div>
            {view === "active" && activeProfile ? (
              <Link className={styles.secondaryLink} href="/tutor/nova-sessao">
                Criar tutoria
              </Link>
            ) : null}
          </Card>
        ) : (
          <ul className={styles.offerList} aria-label="Tutorias oferecidas">
            {visibleOffers.map((offer) => (
              <li key={offer.id}>
                <Card className={styles.offerCard}>
                  <div className={styles.offerMain}>
                    <Badge
                      variant={
                        offer.status === "scheduled"
                          ? "success"
                          : offer.status === "cancelled"
                            ? "danger"
                            : "neutral"
                      }
                    >
                      {STATUS_LABEL[offer.status]}
                    </Badge>
                    <h3>{offer.title}</h3>
                    <p>
                      <CalendarBlank aria-hidden size={16} />
                      {new Date(offer.starts_at).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>

                  <div className={styles.offerAside}>
                    <strong>{formatCents(offer.price_cents)}</strong>
                    <div className={styles.offerActions}>
                      {offer.status === "draft" && activeProfile ? (
                        <Button
                          disabled={busy}
                          onClick={() =>
                            runMutation(
                              () => marketplaceApi.publish(offer.id),
                              "Tutoria publicada com sucesso.",
                            )
                          }
                          size="sm"
                          type="button"
                        >
                          Publicar
                        </Button>
                      ) : null}
                      {offer.status === "scheduled" ? (
                        <Button
                          disabled={busy}
                          onClick={() => openCancel(offer)}
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
            ))}
          </ul>
        )}
      </section>

      {dialogMode === "activate" ? (
        <Dialog
          descriptionId="activate-tutor-description"
          onClose={() => {
            if (!busy) setDialogMode(null);
          }}
          titleId="activate-tutor-title"
        >
          <form
            className={styles.dialogForm}
            onSubmit={(event) => {
              event.preventDefault();
              void runMutation(
                () => marketplaceApi.activate(headline, bio),
                "Perfil de tutor ativado.",
              );
            }}
          >
            <div>
              <p className={styles.dialogEyebrow}>Perfil profissional</p>
              <h2 id="activate-tutor-title">Ativar perfil de tutor</h2>
              <p id="activate-tutor-description">
                Estas informações ajudam a apresentar você aos estudantes.
              </p>
            </div>
            <label>
              <span>Título profissional</span>
              <input
                maxLength={200}
                onChange={(event) => setHeadline(event.target.value)}
                required
                value={headline}
              />
            </label>
            <label>
              <span>Bio (opcional)</span>
              <textarea
                maxLength={2000}
                onChange={(event) => setBio(event.target.value)}
                rows={4}
                value={bio}
              />
            </label>
            <div className={styles.dialogActions}>
              <Button
                disabled={busy}
                onClick={() => setDialogMode(null)}
                type="button"
                variant="secondary"
              >
                Cancelar
              </Button>
              <Button loading={busy} type="submit">
                Confirmar ativação
              </Button>
            </div>
          </form>
        </Dialog>
      ) : null}

      {dialogMode === "pause" ? (
        <Dialog
          descriptionId="pause-tutor-description"
          onClose={() => {
            if (!busy) setDialogMode(null);
          }}
          titleId="pause-tutor-title"
        >
          <div className={styles.dialogContent}>
            <div>
              <p className={styles.dialogEyebrow}>Perfil profissional</p>
              <h2 id="pause-tutor-title">Gerenciar perfil de tutor</h2>
              <p id="pause-tutor-description">
                Pausar o perfil impede a publicação de novas tutorias até você retomá-lo.
              </p>
            </div>
            <div className={styles.dialogActions}>
              <Button
                disabled={busy}
                onClick={() => setDialogMode(null)}
                type="button"
                variant="secondary"
              >
                Fechar
              </Button>
              <Button
                loading={busy}
                onClick={() =>
                  runMutation(marketplaceApi.pause, "Perfil de tutor pausado.")
                }
                type="button"
                variant="danger"
              >
                Pausar perfil
              </Button>
            </div>
          </div>
        </Dialog>
      ) : null}

      {dialogMode === "cancel" && selectedOffer ? (
        <Dialog
          descriptionId="cancel-offer-description"
          onClose={() => {
            if (!busy) setDialogMode(null);
          }}
          titleId="cancel-offer-title"
        >
          <div className={styles.dialogContent}>
            <div>
              <p className={styles.dialogEyebrow}>Tutoria publicada</p>
              <h2 id="cancel-offer-title">Cancelar esta tutoria?</h2>
              <p id="cancel-offer-description">
                <strong>{selectedOffer.title}</strong> deixará de aceitar novas reservas.
              </p>
            </div>
            <div className={styles.dialogActions}>
              <Button
                disabled={busy}
                onClick={() => setDialogMode(null)}
                type="button"
                variant="secondary"
              >
                Manter tutoria
              </Button>
              <Button
                loading={busy}
                onClick={() =>
                  runMutation(
                    () => marketplaceApi.cancelOffer(selectedOffer.id),
                    "Tutoria cancelada.",
                  )
                }
                type="button"
                variant="danger"
              >
                Cancelar tutoria
              </Button>
            </div>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
