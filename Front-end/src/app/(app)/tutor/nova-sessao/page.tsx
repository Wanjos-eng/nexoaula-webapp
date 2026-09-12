"use client";

import { ArrowLeft, CheckCircle, WarningCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { useAuthSession } from "@/modules/auth";
import { publishDemoSession } from "@/modules/marketplace/marketplace.demo";
import type { TutorSession } from "@/modules/marketplace/marketplace.types";
import { calcCommission, formatCents } from "@/modules/marketplace/marketplace.types";
import styles from "./page.module.css";

type PublicationState = "editing" | "draft" | "published";

type SessionDraft = {
  title: string;
  subject: string;
  startsAt: string;
  modality: "online" | "in_person" | "hybrid";
  capacity: number;
  priceCents: number;
};

export default function NewTutorSessionPage() {
  const { user } = useAuthSession();
  const [state, setState] = useState<PublicationState>("editing");
  const [draft, setDraft] = useState<SessionDraft | null>(null);
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const startsAt = String(formData.get("startsAt"));
    const capacity = Number(formData.get("capacity"));
    const priceCents = Math.round(Number(formData.get("price")) * 100);
    if (new Date(startsAt).getTime() <= Date.now() || capacity < 1 || priceCents < 0) {
      setError("Informe uma data futura, capacidade positiva e valor demonstrativo válido.");
      return;
    }
    setError("");
    setDraft({
      title: String(formData.get("title")),
      subject: String(formData.get("subject")),
      startsAt,
      modality: String(formData.get("modality")) as SessionDraft["modality"],
      capacity,
      priceCents,
    });
    setState("draft");
  }

  const commission = draft ? calcCommission(draft.priceCents) : 0;

  function handlePublish() {
    if (!draft) return;
    const startsAt = new Date(draft.startsAt);
    const session: TutorSession = {
      id: crypto.randomUUID(),
      tutor_user_id: user.id,
      tutor_name: user.fullName ?? "Tutor nexoAula",
      subject_id: draft.subject.toLowerCase().replaceAll(/\s+/g, "-"),
      subject_name: draft.subject,
      title: draft.title,
      description: null,
      modality: draft.modality,
      location: null,
      external_url: null,
      starts_at: startsAt.toISOString(),
      ends_at: new Date(startsAt.getTime() + 60 * 60 * 1000).toISOString(),
      capacity: draft.capacity,
      enrolled_count: 0,
      price_cents: draft.priceCents,
      currency: "BRL",
      status: "scheduled",
    };
    try {
      publishDemoSession(session);
      setError("");
      setState("published");
    } catch {
      setError("Não foi possível salvar a publicação simulada neste navegador. Tente novamente.");
    }
  }

  return (
    <main className={styles.page}>
      <Link className={styles.back} href="/tutor">
        <ArrowLeft aria-hidden size={16} /> Voltar ao painel
      </Link>
      <header>
        <h1>Nova sessão de tutoria</h1>
        <p>Crie e publique uma oferta demonstrativa para estudantes.</p>
      </header>
      <p className={styles.notice} role="note">
        <WarningCircle aria-hidden size={18} weight="fill" /> Esta é uma
        simulação acadêmica. Nenhum pagamento ou repasse real será realizado.
      </p>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}

      {state === "editing" ? (
        <form className={styles.form} onSubmit={handleSubmit}>
          <label>
            <span>Título da sessão</span>
            <input name="title" placeholder="Revisão de Cálculo II" required />
          </label>
          <label>
            <span>Disciplina</span>
            <input name="subject" placeholder="Cálculo II" required />
          </label>
          <div className={styles.row}>
            <label>
              <span>Data e horário</span>
              <input name="startsAt" required type="datetime-local" />
            </label>
            <label>
              <span>Modalidade</span>
              <select defaultValue="online" name="modality">
                <option value="online">Online</option>
                <option value="in_person">Presencial</option>
                <option value="hybrid">Híbrida</option>
              </select>
            </label>
          </div>
          <div className={styles.row}>
            <label>
              <span>Capacidade</span>
              <input min="1" name="capacity" required type="number" />
            </label>
            <label>
              <span>Valor demonstrativo (R$)</span>
              <input min="0" name="price" required step="0.01" type="number" />
            </label>
          </div>
          <button className={styles.primary} type="submit">Revisar oferta</button>
        </form>
      ) : draft ? (
        <section className={styles.summary} aria-labelledby="offer-summary">
          {state === "published" ? (
            <div className={styles.success} role="status" aria-live="polite">
              <CheckCircle aria-hidden size={28} weight="fill" />
              <p>Sessão simulada publicada e disponível na vitrine.</p>
            </div>
          ) : null}
          <h2 id="offer-summary">Resumo da oferta</h2>
          <dl>
            <div><dt>Título</dt><dd>{draft.title}</dd></div>
            <div><dt>Disciplina</dt><dd>{draft.subject}</dd></div>
            <div><dt>Início</dt><dd>{new Date(draft.startsAt).toLocaleString("pt-BR")}</dd></div>
            <div><dt>Capacidade</dt><dd>{draft.capacity} estudantes</dd></div>
            <div><dt>Valor demonstrativo</dt><dd>{formatCents(draft.priceCents)}</dd></div>
            <div><dt>Comissão simulada (15%)</dt><dd>{formatCents(commission)}</dd></div>
          </dl>
          {state === "draft" ? (
            <div className={styles.actions}>
              <button className={styles.secondary} onClick={() => setState("editing")} type="button">Editar</button>
              <button className={styles.primary} onClick={handlePublish} type="button">Publicar sessão simulada</button>
            </div>
          ) : (
            <Link className={styles.primaryLink} href="/sessoes">Ver vitrine de sessões</Link>
          )}
        </section>
      ) : null}
    </main>
  );
}
