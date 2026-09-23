"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api";
import { Failure, Loading } from "./AsyncState";
import { useRemote } from "./useRemote";
import { groupPlans, localDateTime, publishPlan, saveDraft, type LessonInput, type TeachingPlan } from "./schedule";
import s from "./AcademicCommunity.module.css";

type EditableLesson = { title: string; description: string; date: string; topicIds: string[] };
export function GroupSchedule({ groupId, canManage }: { groupId: string; canManage: boolean }) {
  const fetcher = useCallback((signal: AbortSignal) => groupPlans(groupId, signal), [groupId]);
  const remote = useRemote(groupId, fetcher, true);
  const [editing, setEditing] = useState<{ planId?: string; lessons: EditableLesson[] }>();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<unknown>();
  const [feedback, setFeedback] = useState("");
  const published = remote.data?.find((plan) => plan.status === "published");
  const draft = remote.data?.find((plan) => plan.status === "draft" && plan.version > (published?.version ?? 0));
  const accessDenied = remote.error instanceof ApiError && [401, 403, 404].includes(remote.error.status);
  const scrolledTo = useRef("");
  useEffect(() => {
    // The anchor does not exist until the asynchronous plan request has finished.
    const hash = window.location.hash.slice(1);
    if (!published || scrolledTo.current === hash || !published.lessons.some((lesson) => hash === `aula-${lesson.id}`)) return;
    document.getElementById(hash)?.scrollIntoView?.({ block: "center" });
    scrolledTo.current = hash;
  }, [published]);

  function edit(plan?: TeachingPlan) {
    setError(undefined);
    setFeedback("");
    setEditing({
      planId: plan?.status === "draft" ? plan.id : undefined,
      lessons: (plan?.lessons ?? []).map((lesson) => ({
        title: lesson.title, description: lesson.description ?? "",
        date: localDateTime(lesson.scheduledAt), topicIds: lesson.topicIds,
      })),
    });
  }
  function update(index: number, field: "title" | "description" | "date", value: string) {
    setEditing((current) => current && ({
      ...current, lessons: current.lessons.map((lesson, i) => i === index ? { ...lesson, [field]: value } : lesson),
    }));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || lock.current || accessDenied) return;
    const publishing = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "publish";
    const lessons: LessonInput[] = [];
    for (const lesson of editing.lessons) {
      const date = new Date(lesson.date);
      if (!lesson.title.trim() || !lesson.date || Number.isNaN(date.getTime()) || localDateTime(date.toISOString()) !== lesson.date) {
        setError(new ApiError(422, "Invalid lesson", { detail: "Informe título e data/hora válidos para cada aula." }));
        return;
      }
      lessons.push({ title: lesson.title.trim(), description: lesson.description.trim() || null,
        scheduledAt: date.toISOString(), topicIds: lesson.topicIds });
    }
    if (publishing && !lessons.length) return;
    lock.current = true;
    setBusy(true);
    setError(undefined);
    setFeedback("");
    try {
      const saved = await saveDraft(groupId, lessons, editing.planId);
      // Keep the real ID even if publication fails, so retry never creates another version.
      setEditing({ ...editing, planId: saved.id });
      if (publishing) await publishPlan(groupId, saved.id);
      setEditing(undefined);
      setFeedback(publishing ? "Cronograma publicado. Os membros já podem consultar as aulas." : "Rascunho salvo.");
      remote.reload();
    } catch (cause) {
      setError(cause);
      remote.reload();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section className={s.panel} id="cronograma" aria-label="Plano e cronograma">
      <div className={s.header}>
        <h2>Plano e cronograma</h2>
        <Link className={s.secondary} href="/calendario">Abrir calendário</Link>
      </div>
      {feedback && <p role="status" className={s.success}>{feedback}</p>}
      {error ? <Failure error={error} /> : null}
      {remote.loading ? <Loading /> : remote.error ? <Failure error={remote.error} retry={remote.reload} /> : (
        <>
          {published ? (
            <div>
              <p>Plano publicado · versão {published.version}</p>
              {published.lessons.length ? (
                <div aria-label="Aulas publicadas">
                  {published.lessons.map((lesson) => (
                    <article className={s.row} id={`aula-${lesson.id}`} key={lesson.id}>
                      <div>
                        <h3>{lesson.title}</h3>
                        <time dateTime={lesson.scheduledAt}>{new Date(lesson.scheduledAt).toLocaleString("pt-BR")}</time>
                        {lesson.description && <p className={s.text}>{lesson.description}</p>}
                      </div>
                    </article>
                  ))}
                </div>
              ) : <p>O plano publicado ainda não contém aulas.</p>}
            </div>
          ) : <p>O organizador ainda não publicou o cronograma deste grupo.</p>}
          {canManage && !editing && (
            <div className={s.actions}>
              <button className={s.primary} onClick={() => edit(draft ?? published)}>
                {draft ? "Editar rascunho" : published ? "Criar nova versão" : "Criar rascunho"}
              </button>
              {draft && <span>Rascunho · versão {draft.version}</span>}
            </div>
          )}
        </>
      )}
      {canManage && editing && !accessDenied && (
        <form aria-label="Editar cronograma" onSubmit={submit}>
          <p>Defina as aulas no seu horário local. A publicação disponibiliza esta versão aos membros.</p>
          <fieldset disabled={busy} className={s.scheduleFields}>
            {editing.lessons.map((lesson, index) => (
              <fieldset key={index} className={s.panel}>
                <legend>Aula {index + 1}</legend>
                <label className={s.field}>Título da aula {index + 1}
                  <input required maxLength={255} value={lesson.title} onChange={(e) => update(index, "title", e.target.value)} />
                </label>
                <label className={s.field}>Data e horário da aula {index + 1}
                  <input required type="datetime-local" value={lesson.date} onChange={(e) => update(index, "date", e.target.value)} />
                </label>
                <label className={s.field}>Descrição da aula {index + 1}
                  <textarea value={lesson.description} onChange={(e) => update(index, "description", e.target.value)} />
                </label>
                <button type="button" className={s.danger} onClick={() => setEditing({
                  ...editing, lessons: editing.lessons.filter((_, i) => i !== index),
                })}>Remover aula {index + 1}</button>
              </fieldset>
            ))}
            <div className={s.actions}>
              <button type="button" className={s.secondary} onClick={() => setEditing({
                ...editing, lessons: [...editing.lessons, { title: "", description: "", date: "", topicIds: [] }],
              })}>Adicionar aula</button>
              <button type="submit" value="save" className={s.secondary}>Salvar rascunho</button>
              <button type="submit" value="publish" className={s.primary} disabled={!editing.lessons.length}>Publicar cronograma</button>
              <button type="button" className={s.secondary} onClick={() => setEditing(undefined)}>Cancelar edição</button>
            </div>
          </fieldset>
          {busy && <p role="status">Salvando cronograma…</p>}
        </form>
      )}
    </section>
  );
}
