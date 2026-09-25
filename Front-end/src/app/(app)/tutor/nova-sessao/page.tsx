"use client";

import { ArrowLeft, CheckCircle, WarningCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import { useMarketplace } from "@/modules/marketplace/useMarketplace";
import { marketplaceApi, marketplaceError } from "@/modules/marketplace/marketplace.api";
import { formatCents } from "@/modules/marketplace/marketplace.types";
import styles from "./page.module.css";

type PublicationState = "editing" | "draft" | "published";

type SessionDraft = {
  subjectId: string;
  title: string;
  subjectName: string;
  startsAt: string;
  endsAt: string;
  location: string;
  externalUrl: string;
  modality: "online" | "in_person" | "hybrid";
  capacity: number;
  priceCents: number;
};

export default function NewTutorSessionPage() {
  const subjects = useMarketplace<{ id: string; name: string }[]>("/v1/academic/subjects?limit=100");
  const [offerId, setOfferId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<PublicationState>("editing");
  const [draft, setDraft] = useState<SessionDraft | null>(null);
  const [error, setError] = useState("");
  const [subjects, setSubjects] = useState<CatalogItem[]>([]);

  useEffect(() => {
    catalog("subjects").then(setSubjects).catch((cause: unknown) => setError(apiErrorMessage(cause)));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const formData = new FormData(event.currentTarget);
    const startsAt = String(formData.get("startsAt"));
    const endsAt = String(formData.get("endsAt"));
    const modality = String(formData.get("modality")) as SessionDraft["modality"];
    const location = String(formData.get("location") ?? "").trim();
    const externalUrl = String(formData.get("externalUrl") ?? "").trim();
    const title = String(formData.get("title") ?? "").trim();
    const subjectId = String(formData.get("subjectId") ?? "");
    const subjectName = subjects.find((subject) => subject.id === subjectId)?.name ?? "";
    const startTime = new Date(startsAt).getTime();
    const endTime = new Date(endsAt).getTime();
    const capacity = Number(formData.get("capacity"));
    const priceCents = Math.round(Number(formData.get("price")) * 100);
    if (!title || !subjectId || !subjectName || !Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime <= Date.now() || endTime <= startTime || !Number.isSafeInteger(capacity) || capacity < 1 || !Number.isSafeInteger(priceCents) || priceCents < 0) {
      setError("Informe uma data futura, capacidade positiva e valor demonstrativo válido.");
      return;
    }
    if ((modality !== "online" && !location) || (modality !== "in_person" && !/^https?:\/\//i.test(externalUrl))) {
      setError("Informe o local para sessões presenciais e o link HTTP(S) para sessões online ou híbridas.");
      return;
    }
    setError("");
    setDraft({
      subjectId,
      title,
      subjectName,
      startsAt,
      endsAt,
      location,
      externalUrl,
      modality,
      capacity,
      priceCents,
    });
    setBusy(true);
    try {
      const payload = { title, subject_id: subject, starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(), modality, location: modality === "online" ? null : location,
        external_url: modality === "in_person" ? null : externalUrl, capacity, price_cents: priceCents };
      const offer = offerId ? await marketplaceApi.edit(offerId, payload) : await marketplaceApi.create(payload);
      setOfferId(offer.id); setState("draft");
    } catch (error) { setError(marketplaceError(error)); }
    finally { setBusy(false); }
  }

  async function handlePublish() {
    if (!offerId || busy) return;
    setBusy(true); setError("");
    try { await marketplaceApi.publish(offerId); setState("published"); }
    catch (error) { setError(marketplaceError(error)); }
    finally { setBusy(false); }
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
            <input name="title" defaultValue={draft?.title} placeholder="Revisão de Cálculo II" required />
          </label>
          <label>
            <span>Disciplina</span>
            <select name="subject" defaultValue={draft?.subject ?? ""} required disabled={subjects.loading}>
              <option value="">Selecione uma disciplina</option>
              {subjects.data?.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
            </select>
            {subjects.error && <span role="alert">{subjects.error}</span>}
          </label>
          <div className={styles.row}>
            <label>
              <span>Data e horário</span>
              <input name="startsAt" defaultValue={draft?.startsAt} required type="datetime-local" />
            </label>
            <label>
              <span>Término</span>
              <input name="endsAt" required type="datetime-local" defaultValue={draft?.endsAt} />
            </label>
            <label>
              <span>Modalidade</span>
              <select defaultValue={draft?.modality ?? "online"} name="modality">
                <option value="online">Online</option>
                <option value="in_person">Presencial</option>
                <option value="hybrid">Híbrida</option>
              </select>
            </label>
          </div>
          <label>
            <span>Local (presencial ou híbrida)</span>
            <input name="location" defaultValue={draft?.location} />
          </label>
          <label>
            <span>Link demonstrativo (online ou híbrida)</span>
            <input name="externalUrl" type="url" placeholder="https://example.com/sessao" defaultValue={draft?.externalUrl} />
          </label>
          <div className={styles.row}>
            <label>
              <span>Capacidade</span>
              <input min="1" name="capacity" defaultValue={draft?.capacity} required type="number" />
            </label>
            <label>
              <span>Valor demonstrativo (R$)</span>
              <input min="0" name="price" defaultValue={draft ? draft.priceCents / 100 : undefined} required step="0.01" type="number" />
            </label>
          </div>
          <button className={styles.primary} disabled={busy || subjects.loading} type="submit">{busy ? "Salvando…" : "Revisar oferta"}</button>
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
            <div><dt>Disciplina</dt><dd>{subjects.data?.find((subject) => subject.id === draft.subject)?.name}</dd></div>
            <div><dt>Início</dt><dd>{new Date(draft.startsAt).toLocaleString("pt-BR")}</dd></div>
            <div><dt>Término</dt><dd>{new Date(draft.endsAt).toLocaleString("pt-BR")}</dd></div>
            <div><dt>Capacidade</dt><dd>{draft.capacity} estudantes</dd></div>
            <div><dt>Valor demonstrativo</dt><dd>{formatCents(draft.priceCents)}</dd></div>
          </dl>
          {state === "draft" ? (
            <div className={styles.actions}>
              <button className={styles.secondary} onClick={() => setState("editing")} disabled={busy} type="button">Editar</button>
              <button className={styles.primary} onClick={handlePublish} disabled={busy} type="button">Publicar sessão simulada</button>
            </div>
          ) : (
            <Link className={styles.primaryLink} href="/sessoes">Ver vitrine de sessões</Link>
          )}
        </section>
      ) : null}
    </main>
  );
}
