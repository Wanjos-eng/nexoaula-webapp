"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api";
import { Failure, Loading } from "./AsyncState";
import { useRemote } from "./useRemote";
import {
  createGroupOccurrence,
  createGroupTopic,
  groupPlans,
  listGroupOccurrences,
  listGroupTopics,
  localDateTime,
  publishPlan,
  saveDraft,
  type GroupLessonOccurrence,
  type GroupTopic,
  type LessonInput,
  type OccurrenceStatus,
  type TeachingPlan,
} from "./schedule";
import {
  canRecordAttendance,
  fetchMyAdjustments,
  fetchMyAttendance,
  fetchMyProgress,
  markAdjustmentSeen,
  recordMyAttendance,
  removeMyAttendance,
  updateMyProgress,
} from "../academic/attendance";
import type {
  PersonalAttendanceRecord,
  StudentAttendanceAdjustmentRecord,
  StudentTopicProgressRecord,
  TopicProgressStatus,
} from "../academic/types";
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

  // Academic Extra States
  const [topics, setTopics] = useState<GroupTopic[]>([]);
  const [occurrences, setOccurrences] = useState<GroupLessonOccurrence[]>([]);
  const [myAttendance, setMyAttendance] = useState<PersonalAttendanceRecord[]>([]);
  const [myProgress, setMyProgress] = useState<StudentTopicProgressRecord[]>([]);
  const [adjustments, setAdjustments] = useState<StudentAttendanceAdjustmentRecord[]>([]);
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [topicBusy, setTopicBusy] = useState(false);

  // Occurrence form state for organizer
  const [recordingOcc, setRecordingOcc] = useState<{
    lessonId: string;
    lessonTitle: string;
    supersedesOccurrenceId?: string;
    status: OccurrenceStatus;
    actualStartedAt: string;
    actualEndedAt: string;
    rescheduledTo: string;
    notes: string;
  } | null>(null);

  const loadExtraData = useCallback(async () => {
    try {
      const [tops, occs, atts, progs, adjs] = await Promise.all([
        listGroupTopics(groupId).catch(() => []),
        listGroupOccurrences(groupId).catch(() => []),
        fetchMyAttendance(groupId).catch(() => []),
        fetchMyProgress(groupId).catch(() => []),
        fetchMyAdjustments(true).catch(() => []),
      ]);
      setTopics(tops);
      setOccurrences(occs);
      setMyAttendance(atts);
      setMyProgress(progs);
      setAdjustments(adjs);
    } catch {
      // ignore
    }
  }, [groupId]);

  useEffect(() => {
    loadExtraData();
  }, [loadExtraData]);

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
        date: localDateTime(lesson.scheduledAt), topicIds: lesson.topicIds || [],
      })),
    });
  }

  function update(index: number, field: "title" | "description" | "date", value: string) {
    setEditing((current) => current && ({
      ...current, lessons: current.lessons.map((lesson, i) => i === index ? { ...lesson, [field]: value } : lesson),
    }));
  }

  function updateTopics(index: number, topicIds: string[]) {
    setEditing((current) => current && ({
      ...current, lessons: current.lessons.map((lesson, i) => i === index ? { ...lesson, topicIds } : lesson),
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
      setEditing({ ...editing, planId: saved.id });
      if (publishing) await publishPlan(groupId, saved.id);
      setEditing(undefined);
      setFeedback(publishing ? "Cronograma publicado. Os membros já podem consultar as aulas." : "Rascunho salvo.");
      remote.reload();
      loadExtraData();
    } catch (cause) {
      setError(cause);
      remote.reload();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function handleAddTopic(e: FormEvent) {
    e.preventDefault();
    if (!newTopicTitle.trim() || topicBusy) return;
    setTopicBusy(true);
    setError(undefined);
    try {
      const created = await createGroupTopic(groupId, { customTitle: newTopicTitle.trim() });
      setTopics((prev) => [...prev, created]);
      setNewTopicTitle("");
      setFeedback("Tópico adicionado ao grupo.");
    } catch (cause) {
      setError(cause);
    } finally {
      setTopicBusy(false);
    }
  }

  function startOccurrenceForm(lessonId: string, lessonTitle: string, scheduledAt: string, existingOcc?: GroupLessonOccurrence) {
    setError(undefined);
    setFeedback("");
    if (existingOcc) {
      setRecordingOcc({
        lessonId,
        lessonTitle,
        supersedesOccurrenceId: existingOcc.id,
        status: existingOcc.status,
        actualStartedAt: existingOcc.actualStartedAt ? localDateTime(existingOcc.actualStartedAt) : localDateTime(scheduledAt),
        actualEndedAt: existingOcc.actualEndedAt ? localDateTime(existingOcc.actualEndedAt) : localDateTime(new Date().toISOString()),
        rescheduledTo: existingOcc.rescheduledTo ? localDateTime(existingOcc.rescheduledTo) : "",
        notes: existingOcc.notes ?? "",
      });
    } else {
      const sDate = new Date(scheduledAt);
      const eDate = new Date(sDate.getTime() + 2 * 60 * 60 * 1000);
      const now = new Date();
      const actualEnd = eDate < now ? eDate : now;
      const actualStart = sDate < actualEnd ? sDate : new Date(actualEnd.getTime() - 60 * 60 * 1000);
      setRecordingOcc({
        lessonId,
        lessonTitle,
        status: "held",
        actualStartedAt: localDateTime(actualStart.toISOString()),
        actualEndedAt: localDateTime(actualEnd.toISOString()),
        rescheduledTo: "",
        notes: "",
      });
    }
  }

  async function submitOccurrence(e: FormEvent) {
    e.preventDefault();
    if (!recordingOcc || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      if (recordingOcc.status === "held") {
        if (!recordingOcc.actualStartedAt || !recordingOcc.actualEndedAt) {
          throw new ApiError(422, "Missing dates", { detail: "Informe início e término reais da aula realizada." });
        }
        const sTime = new Date(recordingOcc.actualStartedAt);
        const eTime = new Date(recordingOcc.actualEndedAt);
        if (sTime >= eTime) {
          throw new ApiError(422, "Invalid time range", { detail: "O término da aula deve ser posterior ao início." });
        }
        if (eTime > new Date()) {
          throw new ApiError(422, "Future held lesson", { detail: "Aulas futuras ou em andamento não podem ser registradas como realizadas." });
        }
      } else if (recordingOcc.status === "postponed") {
        if (!recordingOcc.rescheduledTo) {
          throw new ApiError(422, "Missing reschedule date", { detail: "Informe a nova data para aula adiada." });
        }
      }

      await createGroupOccurrence(groupId, {
        status: recordingOcc.status,
        scheduledLessonId: recordingOcc.lessonId,
        supersedesOccurrenceId: recordingOcc.supersedesOccurrenceId || null,
        actualStartedAt: recordingOcc.status === "held" ? new Date(recordingOcc.actualStartedAt).toISOString() : null,
        actualEndedAt: recordingOcc.status === "held" ? new Date(recordingOcc.actualEndedAt).toISOString() : null,
        rescheduledTo: recordingOcc.status === "postponed" ? new Date(recordingOcc.rescheduledTo).toISOString() : null,
        notes: recordingOcc.notes.trim() || null,
      });

      setRecordingOcc(null);
      setFeedback("Ocorrência de aula registrada com sucesso.");
      await loadExtraData();
      remote.reload();
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  }

  async function handleRecordAttendance(occurrenceId: string, status: "present" | "absent") {
    try {
      setError(undefined);
      const saved = await recordMyAttendance(occurrenceId, status);
      setMyAttendance((prev) => [
        ...prev.filter((a) => a.lessonOccurrenceId !== occurrenceId),
        saved,
      ]);
      setFeedback(`Frequência privada salva (${status === "present" ? "Presença" : "Falta"}).`);
    } catch (cause) {
      setError(cause);
    }
  }

  async function handleRemoveAttendance(occurrenceId: string) {
    try {
      setError(undefined);
      await removeMyAttendance(occurrenceId);
      setMyAttendance((prev) => prev.filter((a) => a.lessonOccurrenceId !== occurrenceId));
      setFeedback("Registro de frequência removido.");
    } catch (cause) {
      setError(cause);
    }
  }

  async function handleUpdateProgress(groupTopicId: string, status: TopicProgressStatus) {
    try {
      setError(undefined);
      const saved = await updateMyProgress(groupTopicId, status);
      setMyProgress((prev) => [
        ...prev.filter((p) => p.groupTopicId !== groupTopicId),
        saved,
      ]);
      setFeedback("Progresso do tópico atualizado.");
    } catch (cause) {
      setError(cause);
    }
  }

  async function handleDismissAdjustment(adjustmentId: string) {
    try {
      setError(undefined);
      await markAdjustmentSeen(adjustmentId);
      setAdjustments((prev) => prev.filter((a) => a.id !== adjustmentId));
    } catch (cause) {
      setError(cause);
    }
  }

  const nowIso = new Date().toISOString();

  return (
    <section className={s.panel} id="cronograma" aria-label="Plano e cronograma">
      <div className={s.header}>
        <h2>Plano e cronograma</h2>
        <Link className={s.secondary} href="/calendario">Abrir calendário</Link>
      </div>
      {feedback && <p role="status" className={s.success}>{feedback}</p>}
      {error ? <Failure error={error} /> : null}

      {/* Adjustment Notices Banner */}
      {adjustments.length > 0 && (
        <div style={{ display: "grid", gap: "10px" }} aria-label="Avisos de ajuste de frequência">
          {adjustments.map((adj) => (
            <div
              key={adj.id}
              className={s.panel}
              style={{
                borderLeft: "4px solid #f59e0b",
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <p style={{ margin: 0, fontSize: "14px", lineHeight: "1.5" }}>
                <strong>Aviso de retificação:</strong> Uma aula deste grupo foi retificada pelo organizador.
                Sua frequência anterior foi{" "}
                <strong>{adj.outcome === "transferred" ? "transferida" : "invalidada"}</strong>.
              </p>
              <button
                type="button"
                className={s.secondary}
                style={{ minHeight: "34px", padding: "6px 14px", fontSize: "13px" }}
                onClick={() => handleDismissAdjustment(adj.id)}
              >
                Entendi / Marcar como visto
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Topic Management for Organizer */}
      {canManage && (
        <div className={s.panel} style={{ padding: "18px", gap: "14px" }} aria-label="Gestão de tópicos do grupo">
          <h3 style={{ fontSize: "16px" }}>Tópicos de estudo do grupo</h3>
          {topics.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {topics.map((top) => (
                <span key={top.id} className={s.badge}>
                  {top.customTitle}
                </span>
              ))}
            </div>
          ) : (
            <p className={s.muted} style={{ fontSize: "13px", margin: 0 }}>
              Nenhum tópico cadastrado no grupo ainda.
            </p>
          )}
          <form onSubmit={handleAddTopic} style={{ display: "flex", gap: "10px", alignItems: "flex-end", flexWrap: "wrap" }}>
            <label className={s.field} style={{ flex: "1 1 200px" }}>
              <span style={{ fontSize: "13px" }}>Cadastrar novo tópico</span>
              <input
                value={newTopicTitle}
                onChange={(e) => setNewTopicTitle(e.target.value)}
                placeholder="Ex: Integrais definidas"
                maxLength={255}
                disabled={topicBusy}
              />
            </label>
            <button type="submit" className={s.secondary} disabled={!newTopicTitle.trim() || topicBusy}>
              {topicBusy ? "Adicionando…" : "Adicionar tópico"}
            </button>
          </form>
        </div>
      )}

      {remote.loading ? <Loading /> : remote.error ? <Failure error={remote.error} retry={remote.reload} /> : (
        <>
          {published ? (
            <div>
              <p>Plano publicado · versão {published.version}</p>
              {published.lessons.length ? (
                <div aria-label="Aulas publicadas" style={{ display: "grid", gap: "16px", marginTop: "12px" }}>
                  {published.lessons.map((lesson) => {
                    const occ = occurrences.find((o) => o.scheduledLessonId === lesson.id);
                    const isHeld = occ?.status === "held";
                    const isCancelled = occ?.status === "cancelled";
                    const isPostponed = occ?.status === "postponed";
                    const myAtt = occ ? myAttendance.find((a) => a.lessonOccurrenceId === occ.id) : undefined;
                    const lessonTopics = topics.filter((t) => (occ?.topicIds?.length ? occ.topicIds : lesson.topicIds).includes(t.id));

                    const canMarkAttendance =
                      isHeld &&
                      occ?.actualStartedAt &&
                      occ?.actualEndedAt &&
                      canRecordAttendance(
                        {
                          id: occ.id,
                          plannedLessonId: lesson.id,
                          title: lesson.title,
                          date: occ.actualStartedAt,
                          displayDate: new Date(occ.actualStartedAt).toLocaleDateString("pt-BR"),
                          time: "",
                          status: "held",
                          actualStartsAt: occ.actualStartedAt,
                          actualEndsAt: occ.actualEndedAt,
                        },
                        nowIso,
                      );

                    return (
                      <article className={s.row} id={`aula-${lesson.id}`} key={lesson.id} style={{ display: "grid", gap: "12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
                          <div>
                            <h3>{lesson.title}</h3>
                            <time dateTime={lesson.scheduledAt}>{new Date(lesson.scheduledAt).toLocaleString("pt-BR")}</time>
                            {lesson.description && <p className={s.text}>{lesson.description}</p>}
                          </div>
                          <div>
                            {isHeld ? (
                              <span className={s.badge} style={{ color: "#10b981", borderColor: "#10b981" }}>
                                Realizada
                              </span>
                            ) : isCancelled ? (
                              <span className={s.badge} style={{ color: "#ef4444", borderColor: "#ef4444" }}>
                                Cancelada
                              </span>
                            ) : isPostponed ? (
                              <span className={s.badge} style={{ color: "#f59e0b", borderColor: "#f59e0b" }}>
                                Adiada
                              </span>
                            ) : (
                              <span className={s.badge}>Agendada</span>
                            )}
                          </div>
                        </div>

                        {/* Occurrence Details */}
                        {occ && (
                          <div style={{ fontSize: "13px", color: "var(--color-text-muted)", display: "grid", gap: "4px" }}>
                            {isHeld && occ.actualStartedAt && occ.actualEndedAt && (
                              <p style={{ margin: 0 }}>
                                <strong>Realização:</strong> {new Date(occ.actualStartedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} às{" "}
                                {new Date(occ.actualEndedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            )}
                            {isPostponed && occ.rescheduledTo && (
                              <p style={{ margin: 0 }}>
                                <strong>Reagendada para:</strong> {new Date(occ.rescheduledTo).toLocaleString("pt-BR")}
                              </p>
                            )}
                            {occ.notes && (
                              <p style={{ margin: 0, fontStyle: "italic" }}>
                                Notas: {occ.notes}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Organizer Occurrence Actions */}
                        {canManage && (
                          <div className={s.actions}>
                            <button
                              type="button"
                              className={s.secondary}
                              style={{ fontSize: "13px", minHeight: "36px", padding: "6px 14px" }}
                              onClick={() => startOccurrenceForm(lesson.id, lesson.title, lesson.scheduledAt, occ)}
                            >
                              {occ ? "Retificar ocorrência" : "Registrar ocorrência"}
                            </button>
                          </div>
                        )}

                        {/* Student Private Attendance & Topic Progress */}
                        {canMarkAttendance && occ && (
                          <div
                            style={{
                              marginTop: "8px",
                              padding: "16px",
                              border: "1px dashed var(--color-border)",
                              borderRadius: "12px",
                              background: "var(--color-surface)",
                              display: "grid",
                              gap: "12px",
                            }}
                          >
                            <p style={{ fontSize: "12px", fontWeight: 700, margin: 0, color: "var(--color-text-muted)" }}>
                              🔒 Registro Pessoal e Não Oficial (visível apenas para você)
                            </p>

                            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                              <span style={{ fontSize: "13px", fontWeight: 600 }}>Sua frequência:</span>
                              <button
                                type="button"
                                className={myAtt?.status === "present" ? s.primary : s.secondary}
                                style={{ minHeight: "34px", padding: "6px 14px", fontSize: "13px" }}
                                onClick={() => handleRecordAttendance(occ.id, "present")}
                              >
                                {myAtt?.status === "present" ? "✓ Presente" : "Presença"}
                              </button>
                              <button
                                type="button"
                                className={myAtt?.status === "absent" ? s.danger : s.secondary}
                                style={{ minHeight: "34px", padding: "6px 14px", fontSize: "13px" }}
                                onClick={() => handleRecordAttendance(occ.id, "absent")}
                              >
                                {myAtt?.status === "absent" ? "✗ Falta" : "Falta"}
                              </button>
                              {myAtt && (
                                <button
                                  type="button"
                                  className={s.secondary}
                                  style={{ minHeight: "34px", padding: "6px 14px", fontSize: "12px", color: "var(--color-text-muted)" }}
                                  onClick={() => handleRemoveAttendance(occ.id)}
                                >
                                  Remover
                                </button>
                              )}
                            </div>

                            {/* Topic Progress for this Lesson */}
                            {lessonTopics.length > 0 && (
                              <div style={{ display: "grid", gap: "8px", marginTop: "4px" }}>
                                <p style={{ fontSize: "13px", fontWeight: 600, margin: 0 }}>
                                  Progresso pessoal nos tópicos abordados:
                                </p>
                                {lessonTopics.map((top) => {
                                  const prog = myProgress.find((p) => p.groupTopicId === top.id);
                                  const currentStatus = prog?.status ?? "pending";
                                  return (
                                    <div
                                      key={top.id}
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        gap: "12px",
                                        flexWrap: "wrap",
                                        padding: "6px 0",
                                        borderBottom: "1px solid var(--color-border)",
                                      }}
                                    >
                                      <span style={{ fontSize: "13px" }}>{top.customTitle}</span>
                                      <div className={s.actions} style={{ gap: "6px" }}>
                                        <button
                                          type="button"
                                          style={{ fontSize: "11px", padding: "4px 8px", minHeight: "28px" }}
                                          className={currentStatus === "pending" ? s.primary : s.secondary}
                                          onClick={() => handleUpdateProgress(top.id, "pending")}
                                        >
                                          Pendente
                                        </button>
                                        <button
                                          type="button"
                                          style={{ fontSize: "11px", padding: "4px 8px", minHeight: "28px" }}
                                          className={currentStatus === "reviewing" ? s.primary : s.secondary}
                                          onClick={() => handleUpdateProgress(top.id, "reviewing")}
                                        >
                                          Em revisão
                                        </button>
                                        <button
                                          type="button"
                                          style={{ fontSize: "11px", padding: "4px 8px", minHeight: "28px" }}
                                          className={currentStatus === "mastered" ? s.primary : s.secondary}
                                          onClick={() => handleUpdateProgress(top.id, "mastered")}
                                        >
                                          Dominado
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              ) : <p>O plano publicado ainda não contém aulas.</p>}
            </div>
          ) : <p>O organizador ainda não publicou o cronograma deste grupo.</p>}

          {canManage && !editing && (
            <div className={s.actions} style={{ marginTop: "16px" }}>
              <button className={s.primary} onClick={() => edit(draft ?? published)}>
                {draft ? "Editar rascunho" : published ? "Criar nova versão" : "Criar rascunho"}
              </button>
              {draft && <span>Rascunho · versão {draft.version}</span>}
            </div>
          )}
        </>
      )}

      {/* Occurrence Recording Modal/Panel */}
      {recordingOcc && (
        <form onSubmit={submitOccurrence} className={s.panel} style={{ border: "2px solid var(--color-green)", padding: "20px" }}>
          <h3>
            {recordingOcc.supersedesOccurrenceId ? "Retificar ocorrência" : "Registrar ocorrência"}: {recordingOcc.lessonTitle}
          </h3>
          <p style={{ fontSize: "14px", margin: 0 }}>
            {recordingOcc.supersedesOccurrenceId
              ? "Ao retificar uma aula realizada para outra realizada, a frequência dos alunos será transferida automaticamente. Se for alterada para cancelada ou adiada, a frequência anterior será invalidada."
              : "Defina se a aula foi realizada, cancelada ou adiada."}
          </p>

          <label className={s.field}>
            <span>Status da ocorrência</span>
            <select
              value={recordingOcc.status}
              onChange={(e) => setRecordingOcc({ ...recordingOcc, status: e.target.value as OccurrenceStatus })}
            >
              <option value="held">Realizada</option>
              <option value="postponed">Adiada</option>
              <option value="cancelled">Cancelada</option>
            </select>
          </label>

          {recordingOcc.status === "held" && (
            <div className={s.fields}>
              <label className={s.field}>
                <span>Início real da aula</span>
                <input
                  required
                  type="datetime-local"
                  value={recordingOcc.actualStartedAt}
                  onChange={(e) => setRecordingOcc({ ...recordingOcc, actualStartedAt: e.target.value })}
                />
              </label>
              <label className={s.field}>
                <span>Término real da aula (deve ser no passado)</span>
                <input
                  required
                  type="datetime-local"
                  value={recordingOcc.actualEndedAt}
                  onChange={(e) => setRecordingOcc({ ...recordingOcc, actualEndedAt: e.target.value })}
                />
              </label>
            </div>
          )}

          {recordingOcc.status === "postponed" && (
            <label className={s.field}>
              <span>Nova data reagendada</span>
              <input
                required
                type="datetime-local"
                value={recordingOcc.rescheduledTo}
                onChange={(e) => setRecordingOcc({ ...recordingOcc, rescheduledTo: e.target.value })}
              />
            </label>
          )}

          <label className={s.field}>
            <span>Notas e observações da ocorrência</span>
            <textarea
              value={recordingOcc.notes}
              onChange={(e) => setRecordingOcc({ ...recordingOcc, notes: e.target.value })}
              placeholder="Ex: Conteúdo ministrado e dúvidas esclarecidas"
            />
          </label>

          <div className={s.actions}>
            <button type="submit" className={s.primary} disabled={busy}>
              {busy ? "Salvando…" : "Salvar ocorrência"}
            </button>
            <button type="button" className={s.secondary} onClick={() => setRecordingOcc(null)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Lesson Plan Editor */}
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

                {/* Topic selection for each lesson */}
                {topics.length > 0 && (
                  <div className={s.field}>
                    <span style={{ fontSize: "13px" }}>Tópicos desta aula</span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                      {topics.map((t) => {
                        const checked = lesson.topicIds.includes(t.id);
                        return (
                          <label key={t.id} style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...lesson.topicIds, t.id]
                                  : lesson.topicIds.filter((id) => id !== t.id);
                                updateTopics(index, next);
                              }}
                            />
                            {t.customTitle}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

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
