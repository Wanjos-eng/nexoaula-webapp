"use client";

import { CheckCircle, Storefront, WarningCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import { BackButton } from "@/components/ui/BackButton";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import {
  marketplaceApi,
  marketplaceError,
  type SessionOffer,
} from "@/modules/marketplace/marketplace.api";
import { formatCents } from "@/modules/marketplace/marketplace.types";
import { useMarketplace } from "@/modules/marketplace/useMarketplace";
import styles from "./page.module.css";

type PublicationState = "editing" | "review" | "published";

type SessionDraft = {
  title: string;
  subject: string;
  description: string;
  startsAt: string;
  endsAt: string;
  location: string;
  externalUrl: string;
  modality: "online" | "in_person" | "hybrid";
  capacity: number;
  priceCents: number;
};

const steps = [
  { key: "editing", label: "Detalhes" },
  { key: "review", label: "Revisar" },
  { key: "published", label: "Publicar" },
] as const;

export default function NewTutorSessionPage() {
  const subjects = useMarketplace<{ id: string; name: string }[]>(
    "/v1/academic/subjects?limit=100",
  );
  const [offerId, setOfferId] = useState<string | null>(null);
  const [editSessionId, setEditSessionId] = useState<string | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(true);
  const [editLoadError, setEditLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<PublicationState>("editing");
  const [draft, setDraft] = useState<SessionDraft | null>(null);
  const [error, setError] = useState("");
  const { showToast } = useToast();

  const currentStep = steps.findIndex((step) => step.key === state);

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get("edit");
    setEditSessionId(sessionId);

    if (!sessionId) {
      setLoadingEdit(false);
      return;
    }

    const controller = new AbortController();
    marketplaceApi
      .listMine(100, 0, controller.signal)
      .then((offers) => {
        if (controller.signal.aborted) return;
        const offer = offers.find((item) => item.id === sessionId);
        if (!offer || offer.status !== "draft") {
          setEditLoadError("Este rascunho não está disponível para edição.");
          return;
        }

        setOfferId(offer.id);
        setDraft(sessionOfferToDraft(offer));
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setEditLoadError(marketplaceError(cause));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingEdit(false);
      });

    return () => controller.abort();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const formData = new FormData(event.currentTarget);
    const startsAt = String(formData.get("startsAt"));
    const endsAt = String(formData.get("endsAt"));
    const modality = String(
      formData.get("modality"),
    ) as SessionDraft["modality"];
    const location = String(formData.get("location") ?? "").trim();
    const externalUrl = String(formData.get("externalUrl") ?? "").trim();
    const title = String(formData.get("title") ?? "").trim();
    const subject = String(formData.get("subject") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const startTime = new Date(startsAt).getTime();
    const endTime = new Date(endsAt).getTime();
    const capacity = Number(formData.get("capacity"));
    const priceCents = Math.round(Number(formData.get("price")) * 100);

    if (
      !title ||
      !subject ||
      !Number.isFinite(startTime) ||
      !Number.isFinite(endTime) ||
      startTime <= Date.now() ||
      endTime <= startTime ||
      !Number.isSafeInteger(capacity) ||
      capacity < 1 ||
      !Number.isSafeInteger(priceCents) ||
      priceCents < 0
    ) {
      setError(
        "Confira a data, o horário, a capacidade e o valor antes de continuar.",
      );
      return;
    }

    if (
      (modality !== "online" && !location) ||
      (modality !== "in_person" && !/^https?:\/\//i.test(externalUrl))
    ) {
      setError(
        "Informe o local para tutorias presenciais e um link HTTP(S) para tutorias online ou híbridas.",
      );
      return;
    }

    const nextDraft = {
      title,
      subject,
      description,
      startsAt,
      endsAt,
      location,
      externalUrl,
      modality,
      capacity,
      priceCents,
    };
    setError("");
    setDraft(nextDraft);
    setBusy(true);

    try {
      const payload = {
        title,
        subject_id: subject,
        description: description || null,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
        modality,
        location: modality === "online" ? null : location,
        external_url: modality === "in_person" ? null : externalUrl,
        capacity,
        price_cents: priceCents,
      };
      const offer = offerId
        ? await marketplaceApi.edit(offerId, payload)
        : await marketplaceApi.create(payload);
      setOfferId(offer.id);
      setState("review");
    } catch (cause) {
      setError(marketplaceError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function handlePublish() {
    if (!offerId || busy) return;
    setBusy(true);
    setError("");

    try {
      await marketplaceApi.publish(offerId);
      setState("published");
      showToast({ message: "Tutoria publicada com sucesso.", variant: "success" });
    } catch (cause) {
      setError(marketplaceError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.page}>
      <BackButton fallback="/tutor">Voltar ao painel</BackButton>

      <PageHeader
        description={
          editSessionId
            ? "Atualize o rascunho, revise a apresentação e publique quando estiver pronto."
            : "Defina os detalhes, revise a apresentação e publique sua tutoria para a comunidade."
        }
        eyebrow="Área do Tutor"
        title={editSessionId ? "Editar tutoria" : "Criar tutoria"}
      />

      <ol className={styles.stepper} aria-label="Etapas de criação da tutoria">
        {steps.map((step, index) => (
          <li
            className={
              index < currentStep
                ? styles.stepDone
                : index === currentStep
                  ? styles.stepActive
                  : ""
            }
            key={step.key}
          >
            <span>{index + 1}</span>
            <strong>{step.label}</strong>
          </li>
        ))}
      </ol>

      <div className={styles.notice} role="note">
        <Storefront aria-hidden size={18} />
        <span>
          Ambiente demonstrativo. Nenhuma cobrança ou repasse real será realizado.
        </span>
      </div>

      {error ? (
        <div className={styles.error} role="alert">
          <WarningCircle aria-hidden size={18} weight="fill" />
          <span>{error}</span>
        </div>
      ) : null}

      {loadingEdit ? (
        <Card className={styles.formCard} aria-label="Carregando rascunho" role="status">
          <span className="sr-only">Carregando rascunho...</span>
          <div className={styles.editLoading}>
            <div />
            <div />
            <div />
          </div>
        </Card>
      ) : editLoadError ? (
        <Card className={styles.editError} role="alert">
          <WarningCircle aria-hidden size={34} weight="fill" />
          <div>
            <h2>Não foi possível editar esta tutoria</h2>
            <p>{editLoadError}</p>
          </div>
          <Link className={styles.secondaryLink} href="/tutor">
            Voltar ao painel
          </Link>
        </Card>
      ) : state === "editing" ? (
        <Card className={styles.formCard}>
          <form
            className={styles.form}
            key={offerId ?? "new-offer"}
            onSubmit={handleSubmit}
          >
            <section className={styles.formSection}>
              <div>
                <h2>Informações principais</h2>
                <p>Explique com clareza o que o estudante encontrará nesta tutoria.</p>
              </div>

              <label>
                <span>Título da tutoria</span>
                <input
                  defaultValue={draft?.title}
                  name="title"
                  placeholder="Revisão para prova de Cálculo II"
                  required
                />
              </label>

              <label>
                <span>Disciplina</span>
                <select
                  defaultValue={draft?.subject ?? ""}
                  disabled={subjects.loading}
                  name="subject"
                  required
                >
                  <option value="">Selecione uma disciplina</option>
                  {subjects.data?.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
                {subjects.error ? <small role="alert">{subjects.error}</small> : null}
              </label>

              <label>
                <span>Descrição (opcional)</span>
                <textarea
                  defaultValue={draft?.description}
                  name="description"
                  placeholder="Conte o que será revisado, para quem a tutoria é indicada e como será o encontro."
                  rows={4}
                />
              </label>
            </section>

            <section className={styles.formSection}>
              <div>
                <h2>Data e formato</h2>
                <p>Informe quando e como o encontro acontecerá.</p>
              </div>

              <div className={styles.row}>
                <label>
                  <span>Data e horário</span>
                  <input
                    defaultValue={draft?.startsAt}
                    name="startsAt"
                    required
                    type="datetime-local"
                  />
                </label>
                <label>
                  <span>Término</span>
                  <input
                    defaultValue={draft?.endsAt}
                    name="endsAt"
                    required
                    type="datetime-local"
                  />
                </label>
              </div>

              <label>
                <span>Modalidade</span>
                <select
                  defaultValue={draft?.modality ?? "online"}
                  name="modality"
                >
                  <option value="online">Online</option>
                  <option value="in_person">Presencial</option>
                  <option value="hybrid">Híbrida</option>
                </select>
              </label>

              <div className={styles.row}>
                <label>
                  <span>Local (presencial ou híbrida)</span>
                  <input
                    defaultValue={draft?.location}
                    name="location"
                    placeholder="Sala, bloco ou local do encontro"
                  />
                </label>
                <label>
                  <span>Link do encontro (online ou híbrida)</span>
                  <input
                    defaultValue={draft?.externalUrl}
                    name="externalUrl"
                    placeholder="https://..."
                    type="url"
                  />
                </label>
              </div>
            </section>

            <section className={styles.formSection}>
              <div>
                <h2>Vagas e valor</h2>
                <p>Defina a capacidade do encontro e o valor demonstrativo.</p>
              </div>

              <div className={styles.rowCompact}>
                <label>
                  <span>Capacidade</span>
                  <input
                    defaultValue={draft?.capacity}
                    min="1"
                    name="capacity"
                    required
                    type="number"
                  />
                </label>
                <label>
                  <span>Valor (R$)</span>
                  <input
                    defaultValue={draft ? draft.priceCents / 100 : undefined}
                    min="0"
                    name="price"
                    required
                    step="0.01"
                    type="number"
                  />
                </label>
              </div>
            </section>

            <div className={styles.formActions}>
              <Button
                disabled={subjects.loading}
                loading={busy}
                type="submit"
              >
                {editSessionId ? "Salvar e revisar" : "Revisar tutoria"}
              </Button>
            </div>
          </form>
        </Card>
      ) : draft ? (
        <Card className={styles.reviewCard}>
          {state === "published" ? (
            <div
              aria-live="polite"
              className={styles.success}
              role="status"
            >
              <CheckCircle aria-hidden size={36} weight="fill" />
              <div>
                <h2>Tutoria publicada</h2>
                <p>Sua tutoria já está disponível para os estudantes.</p>
              </div>
            </div>
          ) : (
            <div className={styles.reviewHeader}>
              <div>
                <p className={styles.reviewEyebrow}>Prévia da publicação</p>
                <h2>Revise sua tutoria</h2>
                <p>Confira como as principais informações serão apresentadas.</p>
              </div>
              <Badge>Rascunho</Badge>
            </div>
          )}

          <div className={styles.preview}>
            <Badge variant="success">
              {subjects.data?.find((subject) => subject.id === draft.subject)?.name ??
                "Disciplina"}
            </Badge>
            <h3>{draft.title}</h3>
            {draft.description ? <p>{draft.description}</p> : null}
            <dl>
              <div>
                <dt>Quando</dt>
                <dd>{new Date(draft.startsAt).toLocaleString("pt-BR")}</dd>
              </div>
              <div>
                <dt>Modalidade</dt>
                <dd>
                  {draft.modality === "online"
                    ? "Online"
                    : draft.modality === "in_person"
                      ? "Presencial"
                      : "Híbrida"}
                </dd>
              </div>
              <div>
                <dt>Vagas</dt>
                <dd>{draft.capacity}</dd>
              </div>
              <div>
                <dt>Valor</dt>
                <dd>{formatCents(draft.priceCents)}</dd>
              </div>
            </dl>
          </div>

          {state === "review" ? (
            <div className={styles.actions}>
              <Button
                disabled={busy}
                onClick={() => setState("editing")}
                type="button"
                variant="secondary"
              >
                Voltar e editar
              </Button>
              <Button
                loading={busy}
                onClick={handlePublish}
                type="button"
              >
                Publicar tutoria
              </Button>
            </div>
          ) : (
            <div className={styles.successActions}>
              <Link className={styles.secondaryLink} href="/tutor">
                Voltar ao painel
              </Link>
              <Link
                className={styles.primaryLink}
                href={offerId ? `/sessoes/${offerId}` : "/sessoes"}
              >
                Ver tutoria
              </Link>
            </div>
          )}
        </Card>
      ) : null}
    </div>
  );
}

function sessionOfferToDraft(offer: SessionOffer): SessionDraft {
  return {
    title: offer.title,
    subject: offer.subject_id,
    description: offer.description ?? "",
    startsAt: toDateTimeLocal(offer.starts_at),
    endsAt: toDateTimeLocal(offer.ends_at),
    location: offer.location ?? "",
    externalUrl: offer.external_url ?? "",
    modality: offer.modality,
    capacity: offer.capacity,
    priceCents: offer.price_cents,
  };
}

function toDateTimeLocal(iso: string): string {
  const date = new Date(iso);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
