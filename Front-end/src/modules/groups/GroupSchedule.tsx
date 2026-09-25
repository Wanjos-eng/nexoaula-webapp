"use client";

import {
  BookOpenText,
  CalendarBlank,
  CheckCircle,
  Clock,
  NotePencil,
  Plus,
  Trash,
} from "@phosphor-icons/react";
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
import { GroupMeetings } from "./GroupMeetings";
import { GroupPlanningCorrections } from "./GroupPlanningCorrections";

type EditableLesson = { title: string; description: string; date: string; topicIds: string[] };

export function GroupSchedule({ groupId, canManage, personal = false }: { groupId: string; canManage: boolean; personal?: boolean }) {
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
  const [extraError, setExtraError] = useState<unknown>();
  const [extraLoading, setExtraLoading] = useState(true);
  const [attendanceBusy, setAttendanceBusy] = useState(false);
  const attendanceLock = useRef(false);

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

  const loadExtraData = useCallback((signal?: AbortSignal) => {
    return Promise.all([
      listGroupTopics(groupId, signal),
      listGroupOccurrences(groupId, { currentOnly: true }, signal),
      fetchMyAttendance(groupId, signal),
      fetchMyProgress(groupId, signal),
      fetchMyAdjustments(true, signal),
    ]).then(([tops, occs, atts, progs, adjs]) => {
      if (signal?.aborted) return;
      setExtraError(undefined);
      setTopics(tops);
      setOccurrences(occs);
      setMyAttendance(atts);
      setMyProgress(progs);
      setAdjustments(adjs.filter((adj) => occs.some((occ) => occ.id === adj.targetOccurrenceId)));
    }).catch((cause: unknown) => {
      if (!signal?.aborted) setExtraError(cause);
    }).finally(() => {
      if (!signal?.aborted) setExtraLoading(false);
    });
  }, [groupId]);

  useEffect(() => {
    const controller = new AbortController();
    void loadExtraData(controller.signal);
    return () => controller.abort();
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
      setFeedback("Tópico adicionado à comunidade.");
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
    if (attendanceLock.current) return;
    attendanceLock.current = true;
    setAttendanceBusy(true);
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
    } finally {
      attendanceLock.current = false;
      setAttendanceBusy(false);
    }
  }

  async function handleRemoveAttendance(occurrenceId: string) {
    if (attendanceLock.current) return;
    attendanceLock.current = true;
    setAttendanceBusy(true);
    try {
      setError(undefined);
      await removeMyAttendance(occurrenceId);
      setMyAttendance((prev) => prev.filter((a) => a.lessonOccurrenceId !== occurrenceId));
      setFeedback("Registro de frequência removido.");
    } catch (cause) {
      setError(cause);
    } finally {
      attendanceLock.current = false;
      setAttendanceBusy(false);
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
  const unrecordedCount = occurrences.filter((occ) => occ.status === "held"
    && occ.actualEndedAt && Date.parse(occ.actualEndedAt) <= Date.parse(nowIso)
    && !myAttendance.some((record) => record.lessonOccurrenceId === occ.id)).length;

  return (
    <>
    {!personal && <GroupMeetings groupId={groupId} canManage={canManage} />}
    <section className={`${s.panel} ${s.schedulePanel}`} id="cronograma" aria-label="Plano e cronograma">
      <div className={s.plannerHeader}>
        <div className={s.plannerTitleBlock}>
          <span className={s.plannerEyebrow}>
            {personal ? "Acompanhamento acadêmico" : "Planejamento acadêmico"}
          </span>
          <h2>{personal ? "Minhas aulas e registros" : "Plano e cronograma"}</h2>
          <p>
            {personal
              ? "Acompanhe as aulas publicadas, seus registros e o progresso ao longo da disciplina."
              : "Organize o conteúdo da disciplina em uma sequência clara de tópicos, aulas e ocorrências."}
          </p>
        </div>
        <div className={s.plannerHeaderActions}>
          {!personal && (
            <span className={published ? s.planStatusPublished : draft ? s.planStatusDraft : s.planStatusEmpty}>
              {published ? (
                <>
                  <CheckCircle aria-hidden size={16} weight="fill" />
                  Publicado · v{published.version}
                </>
              ) : draft ? (
                <>
                  <NotePencil aria-hidden size={16} />
                  Rascunho · v{draft.version}
                </>
              ) : (
                <>
                  <Clock aria-hidden size={16} />
                  Não publicado
                </>
              )}
            </span>
          )}
          <Link className={s.secondary} href="/calendario">
            <CalendarBlank aria-hidden size={17} />
            Abrir calendário
          </Link>
        </div>
      </div>

      {canManage && !personal && (
        <div className={s.plannerWorkflow} aria-label="Etapas do planejamento">
          <div className={s.workflowStep}>
            <span className={s.workflowIndex}>1</span>
            <BookOpenText aria-hidden size={22} />
            <div>
              <strong>Estruture a ementa</strong>
              <p>Cadastre os tópicos que vão orientar as aulas da comunidade.</p>
            </div>
          </div>
          <div className={s.workflowConnector} aria-hidden />
          <div className={s.workflowStep}>
            <span className={s.workflowIndex}>2</span>
            <CalendarBlank aria-hidden size={22} />
            <div>
              <strong>Monte as aulas</strong>
              <p>Defina títulos, datas, horários e os tópicos de cada encontro.</p>
            </div>
          </div>
          <div className={s.workflowConnector} aria-hidden />
          <div className={s.workflowStep}>
            <span className={s.workflowIndex}>3</span>
            <CheckCircle aria-hidden size={22} />
            <div>
              <strong>Publique para o grupo</strong>
              <p>Revise o rascunho e disponibilize o cronograma aos membros.</p>
            </div>
          </div>
        </div>
      )}
      {feedback && <p role="status" className={s.success}>{feedback}</p>}
      {error ? <Failure error={error} /> : null}
      {extraError && !remote.error && !remote.loading ? <Failure error={extraError} retry={() => void loadExtraData()} /> : null}
      <div className={s.personalPanel} id="frequencia">
        <h3>Minha frequência</h3>
        <p>Seu controle privado de presenças e faltas. Não substitui a frequência oficial.</p>
        {extraLoading ? <p role="status">Carregando seus registros…</p> : !extraError ? <p>
          <strong>{myAttendance.filter((item) => item.status === "present").length}</strong> presenças · <strong>{myAttendance.filter((item) => item.status === "absent").length}</strong> faltas · <strong>{unrecordedCount}</strong> sem registro
        </p> : null}
        <p>Após o organizador confirmar que a aula foi realizada e encerrada, marque Presença ou Falta na aula abaixo.</p>
      </div>
      {!personal && <GroupPlanningCorrections
        groupId={groupId}
        canManage={canManage}
        lessons={published?.lessons ?? []}
        occurrences={occurrences}
        topics={topics}
        onApplied={() => { remote.reload(); void loadExtraData(); }}
      />}

      {/* Adjustment Notices Banner */}
      {adjustments.length > 0 && (
        <div className={s.adjustmentList} aria-label="Avisos de ajuste de frequência">
          {adjustments.map((adj) => (
            <div key={adj.id} className={s.adjustmentNotice}>
              <p className={s.adjustmentText}>
                <strong>Aviso de retificação:</strong> Uma aula desta comunidade foi retificada pelo organizador.
                Sua frequência anterior foi{" "}
                <strong>{adj.outcome === "transferred" ? "transferida" : adj.outcome === "kept_existing" ? "preservada no destino" : "invalidada"}</strong>.
              </p>
              <button
                type="button"
                className={`${s.secondary} ${s.compactButton}`}
                onClick={() => handleDismissAdjustment(adj.id)}
              >
                Entendi / Marcar como visto
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Shared syllabus, editable by organizers. */}
      <div id="ementa" className={`${s.panel} ${s.syllabusCard}`}>
        <div className={s.subsectionHeader}>
          <div className={s.subsectionIcon}>
            <BookOpenText aria-hidden size={20} />
          </div>
          <div>
            <span className={s.subsectionEyebrow}>Base do planejamento</span>
            <h3>Ementa e tópicos de estudo</h3>
            <p className={s.formHint}>Conteúdo compartilhado da comunidade, organizado em tópicos e vinculado às aulas do cronograma.</p>
          </div>
        </div>
        {topics.length ? (
          <div className={s.topicBadges}>
            {topics.map((topic) => (
              <span className={s.badge} key={topic.id}>
                {topic.customTitle || topic.topicName || "Tópico sem título"}
              </span>
            ))}
          </div>
        ) : (
          <div className={s.inlineEmptyState}>
            <p>Nenhum tópico publicado pelo organizador.</p>
          </div>
        )}
      </div>
      {canManage && (
        <div className={`${s.panel} ${s.topicManager} ${s.topicManagerPro}`} aria-label="Gestão de tópicos da comunidade">
          <div className={s.managerSectionHeader}>
            <span className={s.managerStep}>Etapa 1</span>
            <div>
              <h3 className={s.subsectionTitle}>Tópicos de estudo da comunidade</h3>
              <p className={s.formHint}>Organize a ementa antes de montar o cronograma. Os tópicos poderão ser vinculados a cada aula.</p>
            </div>
          </div>
          {topics.length > 0 ? (
            <div className={s.topicBadges}>
              {topics.map((top) => (
                <span key={top.id} className={s.badge}>
                  {top.customTitle || top.topicName || "Tópico sem título"}
                </span>
              ))}
            </div>
          ) : (
            <p className={s.muted}>
              Nenhum tópico cadastrado na comunidade ainda.
            </p>
          )}
          <form className={s.topicForm} onSubmit={handleAddTopic}>
            <label className={`${s.field} ${s.topicInput}`}>
              <span>Cadastrar novo tópico</span>
              <input
                value={newTopicTitle}
                onChange={(e) => setNewTopicTitle(e.target.value)}
                placeholder="Ex: Integrais definidas"
                maxLength={255}
                disabled={topicBusy}
              />
            </label>
            <button type="submit" className={s.secondary} disabled={!newTopicTitle.trim() || topicBusy}>
              <Plus aria-hidden size={16} />
              {topicBusy ? "Adicionando…" : "Adicionar tópico"}
            </button>
          </form>
        </div>
      )}

      {remote.loading ? <Loading /> : remote.error ? <Failure error={remote.error} retry={() => { remote.reload(); void loadExtraData(); }} /> : (
        <>
          {published ? (
            <div className={s.publishedPlan}>
              <div className={s.publishedPlanHeader}>
                <div className={s.publishedPlanIdentity}>
                  <span className={s.publishedPlanIcon}>
                    <CheckCircle aria-hidden size={22} weight="fill" />
                  </span>
                  <div>
                    <span className={s.subsectionEyebrow}>Cronograma atual</span>
                    <h3>Plano publicado</h3>
                    <p>Versão {published.version} · {published.lessons.length} {published.lessons.length === 1 ? "aula" : "aulas"} no planejamento</p>
                  </div>
                </div>
                <span className={s.planStatusPublished}>
                  <CheckCircle aria-hidden size={16} weight="fill" />
                  Visível para o grupo
                </span>
              </div>
              {published.lessons.length ? (
                <div aria-label="Aulas publicadas" className={s.lessonList}>
                  {published.lessons.map((lesson) => {
                    const occ = occurrences.find((o) => o.scheduledLessonId === lesson.id);
                    const isHeld = occ?.status === "held";
                    const isCancelled = occ?.status === "cancelled";
                    const isPostponed = occ?.status === "postponed";
                    const myAtt = occ ? myAttendance.find((a) => a.lessonOccurrenceId === occ.id) : undefined;
                    const lessonTopics = topics.filter((t) => (occ?.topicIds?.length ? occ.topicIds : lesson.topicIds).includes(t.id));

                    const canMarkAttendance =
                      !extraLoading && !extraError && isHeld &&
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
                      <article className={`${s.row} ${s.lessonCard}`} id={`aula-${lesson.id}`} key={lesson.id}>
                        <div className={s.lessonHeader}>
                          <div>
                            <h3>{lesson.title}</h3>
                            <time dateTime={lesson.scheduledAt}>{new Date(lesson.scheduledAt).toLocaleString("pt-BR")}</time>
                            {lesson.description && <p className={s.text}>{lesson.description}</p>}
                          </div>
                          <div>
                            {isHeld ? (
                              <span className={`${s.badge} ${s.badgeSuccess}`}>
                                Realizada
                              </span>
                            ) : isCancelled ? (
                              <span className={`${s.badge} ${s.badgeDanger}`}>
                                Cancelada
                              </span>
                            ) : isPostponed ? (
                              <span className={`${s.badge} ${s.badgeWarning}`}>
                                Adiada
                              </span>
                            ) : (
                              <span className={s.badge}>Agendada</span>
                            )}
                          </div>
                        </div>

                        {/* Occurrence Details */}
                        {occ && (
                          <div className={s.occurrenceDetails}>
                            {isHeld && occ.actualStartedAt && occ.actualEndedAt && (
                              <p>
                                <strong>Realização:</strong> {new Date(occ.actualStartedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} às{" "}
                                {new Date(occ.actualEndedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            )}
                            {isPostponed && occ.rescheduledTo && (
                              <p>
                                <strong>Reagendada para:</strong> {new Date(occ.rescheduledTo).toLocaleString("pt-BR")}
                              </p>
                            )}
                            {occ.notes && (
                              <p className={s.occurrenceNotes}>
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
                              className={`${s.secondary} ${s.compactButton}`}
                              onClick={() => startOccurrenceForm(lesson.id, lesson.title, lesson.scheduledAt, occ)}
                            >
                              {occ ? "Retificar ocorrência" : "Registrar ocorrência"}
                            </button>
                          </div>
                        )}

                        {!canMarkAttendance && !extraLoading && !extraError && <p className={s.formHint}>
                          {isCancelled ? "Aula cancelada: não gera falta." : isPostponed ? "Aula adiada: aguarde a realização para registrar frequência." : isHeld ? "A frequência estará disponível após o encerramento da aula." : "Aguardando o organizador confirmar a realização da aula para liberar Presença e Falta."}
                        </p>}
                        {/* Student Private Attendance & Topic Progress */}
                        {canMarkAttendance && occ && (
                          <div className={s.personalPanel}>
                            <p className={s.privateLabel}>
                              🔒 Registro Pessoal e Não Oficial (visível apenas para você)
                            </p>

                            <div className={s.attendanceControls}>
                              <span className={s.attendanceLabel}>Sua frequência:</span>
                              <button
                                type="button"
                                className={`${myAtt?.status === "present" ? s.primary : s.secondary} ${s.compactButton}`}
                                disabled={attendanceBusy}
                                aria-pressed={myAtt?.status === "present"}
                                onClick={() => handleRecordAttendance(occ.id, "present")}
                              >
                                {myAtt?.status === "present" ? "✓ Presente" : "Presença"}
                              </button>
                              <button
                                type="button"
                                className={`${myAtt?.status === "absent" ? s.danger : s.secondary} ${s.compactButton}`}
                                disabled={attendanceBusy}
                                aria-pressed={myAtt?.status === "absent"}
                                onClick={() => handleRecordAttendance(occ.id, "absent")}
                              >
                                {myAtt?.status === "absent" ? "✗ Falta" : "Falta"}
                              </button>
                              {myAtt && (
                                <button
                                  type="button"
                                  className={`${s.secondary} ${s.compactButton} ${s.mutedButton}`}
                                  disabled={attendanceBusy}
                                  onClick={() => handleRemoveAttendance(occ.id)}
                                >
                                  Remover
                                </button>
                              )}
                            </div>

                            {/* Topic Progress for this Lesson */}
                            {lessonTopics.length > 0 && (
                              <div className={s.topicProgress}>
                                <p className={s.topicProgressTitle}>
                                  Progresso pessoal nos tópicos abordados:
                                </p>
                                {lessonTopics.map((top) => {
                                  const prog = myProgress.find((p) => p.groupTopicId === top.id);
                                  const currentStatus = prog?.status ?? "pending";
                                  return (
                                    <div className={s.topicProgressRow} key={top.id}>
                                      <span className={s.topicName}>{top.customTitle || top.topicName || "Tópico sem título"}</span>
                                      <div className={`${s.actions} ${s.topicStatusActions}`}>
                                        <button
                                          type="button"
                                          className={`${currentStatus === "pending" ? s.primary : s.secondary} ${s.microButton}`}
                                          onClick={() => handleUpdateProgress(top.id, "pending")}
                                        >
                                          Pendente
                                        </button>
                                        <button
                                          type="button"
                                          className={`${currentStatus === "reviewing" ? s.primary : s.secondary} ${s.microButton}`}
                                          onClick={() => handleUpdateProgress(top.id, "reviewing")}
                                        >
                                          Em revisão
                                        </button>
                                        <button
                                          type="button"
                                          className={`${currentStatus === "mastered" ? s.primary : s.secondary} ${s.microButton}`}
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
              ) : (
                <div className={s.inlineEmptyState}>
                  <p>O plano publicado ainda não contém aulas.</p>
                </div>
              )}
            </div>
          ) : (
            <div className={s.emptyPublishedPlan}>
              <span className={s.emptyPublishedIcon}>
                <CalendarBlank aria-hidden size={24} />
              </span>
              <div>
                <strong>Nenhum cronograma publicado ainda</strong>
                <p>
                  {canManage
                    ? "Crie um rascunho, organize as aulas e publique quando o planejamento estiver pronto."
                    : "O organizador ainda está preparando o planejamento desta comunidade."}
                </p>
              </div>
            </div>
          )}

          {canManage && !editing && (
            <div className={s.scheduleActions}>
              <div className={s.scheduleActionContext}>
                <span className={s.managerStep}>Etapa 2</span>
                <div>
                  <strong>
                    {draft ? "Continue o rascunho em andamento" : published ? "Planeje a próxima versão" : "Monte o primeiro cronograma"}
                  </strong>
                  <p>
                    {draft
                      ? `Versão ${draft.version} ainda não publicada.`
                      : published
                        ? "Crie uma nova versão sem alterar o cronograma que os membros já consultam."
                        : "Adicione as aulas e salve o progresso antes de publicar."}
                  </p>
                </div>
              </div>
              <button className={s.primary} onClick={() => edit(draft ?? published)}>
                <NotePencil aria-hidden size={17} />
                {draft ? "Editar rascunho" : published ? "Criar nova versão" : "Criar rascunho"}
              </button>
            </div>
          )}
        </>
      )}

      {/* Occurrence Recording Modal/Panel */}
      {recordingOcc && (
        <form onSubmit={submitOccurrence} className={`${s.panel} ${s.occurrenceForm}`}>
          <h3>
            {recordingOcc.supersedesOccurrenceId ? "Retificar ocorrência" : "Registrar ocorrência"}: {recordingOcc.lessonTitle}
          </h3>
          <p className={s.formHint}>
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
        <form aria-label="Editar cronograma" className={s.plannerEditor} onSubmit={submit}>
          <div className={s.plannerEditorHeader}>
            <div className={s.plannerEditorIdentity}>
              <span className={s.plannerEditorIcon}>
                <NotePencil aria-hidden size={22} />
              </span>
              <div>
                <span className={s.managerStep}>Etapa 2</span>
                <h3>Montar cronograma</h3>
                <p>Defina as aulas no seu horário local. Você pode salvar o rascunho e publicar somente quando estiver pronto.</p>
              </div>
            </div>
            <span className={s.planStatusDraft}>
              <NotePencil aria-hidden size={16} />
              {editing.planId ? "Rascunho salvo" : "Novo rascunho"}
            </span>
          </div>

          <fieldset disabled={busy} className={s.scheduleFields}>
            {!editing.lessons.length ? (
              <div className={s.plannerEmptyLessons}>
                <span>
                  <CalendarBlank aria-hidden size={28} />
                </span>
                <div>
                  <strong>Seu cronograma ainda está vazio</strong>
                  <p>Adicione a primeira aula para começar a estruturar o planejamento da disciplina.</p>
                </div>
              </div>
            ) : null}

            <div className={s.lessonEditorList}>
              {editing.lessons.map((lesson, index) => (
                <fieldset key={index} className={s.lessonEditorCard}>
                  <legend className={s.lessonEditorLegend}>
                    <span className={s.lessonEditorNumber}>{String(index + 1).padStart(2, "0")}</span>
                    <span>
                      <strong>Aula {index + 1}</strong>
                      <small>{lesson.title.trim() || "Nova aula do cronograma"}</small>
                    </span>
                  </legend>

                  <div className={s.lessonEditorGrid}>
                    <label className={s.field}>Título da aula {index + 1}
                      <input
                        required
                        maxLength={255}
                        placeholder="Ex: Introdução a derivadas"
                        value={lesson.title}
                        onChange={(e) => update(index, "title", e.target.value)}
                      />
                    </label>
                    <label className={s.field}>Data e horário da aula {index + 1}
                      <input
                        required
                        type="datetime-local"
                        value={lesson.date}
                        onChange={(e) => update(index, "date", e.target.value)}
                      />
                    </label>
                  </div>

                  <label className={s.field}>Descrição da aula {index + 1}
                    <textarea
                      placeholder="Objetivos, conteúdo previsto ou orientações para esta aula."
                      value={lesson.description}
                      onChange={(e) => update(index, "description", e.target.value)}
                    />
                  </label>

                  {topics.length > 0 && (
                    <div className={s.lessonTopicSection}>
                      <div>
                        <span className={s.fieldLabel}>Tópicos desta aula</span>
                        <small>Selecione os conteúdos da ementa relacionados a este encontro.</small>
                      </div>
                      <div className={s.topicCheckboxes}>
                        {topics.map((t) => {
                          const checked = lesson.topicIds.includes(t.id);
                          return (
                            <label className={s.topicCheckbox} key={t.id}>
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
                              {t.customTitle || t.topicName || "Tópico sem título"}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className={s.lessonEditorFooter}>
                    <span>
                      <Clock aria-hidden size={15} />
                      {lesson.date
                        ? new Date(lesson.date).toLocaleString("pt-BR")
                        : "Data e horário ainda não definidos"}
                    </span>
                    <button type="button" className={s.danger} onClick={() => setEditing({
                      ...editing, lessons: editing.lessons.filter((_, i) => i !== index),
                    })}>
                      <Trash aria-hidden size={15} />
                      Remover aula {index + 1}
                    </button>
                  </div>
                </fieldset>
              ))}
            </div>

            <button type="button" className={s.addLessonButton} onClick={() => setEditing({
              ...editing, lessons: [...editing.lessons, { title: "", description: "", date: "", topicIds: [] }],
            })}>
              <span><Plus aria-hidden size={20} /></span>
              <div>
                <strong>Adicionar aula</strong>
                <small>Inclua mais um encontro no cronograma.</small>
              </div>
            </button>

            <div className={s.plannerActionBar}>
              <div className={s.plannerActionSummary}>
                <strong>{editing.lessons.length} {editing.lessons.length === 1 ? "aula" : "aulas"} no rascunho</strong>
                <span>As alterações só ficam visíveis aos membros depois da publicação.</span>
              </div>
              <div className={s.plannerActionButtons}>
                <button type="button" className={s.secondary} onClick={() => setEditing(undefined)}>
                  Cancelar edição
                </button>
                <button type="submit" value="save" className={s.secondary}>
                  <NotePencil aria-hidden size={16} />
                  Salvar rascunho
                </button>
                <button type="submit" value="publish" className={s.primary} disabled={!editing.lessons.length}>
                  <CheckCircle aria-hidden size={16} weight="fill" />
                  Publicar cronograma
                </button>
              </div>
            </div>
          </fieldset>
          {busy && <p role="status" className={s.plannerSaving}>Salvando cronograma…</p>}
        </form>
      )}
    </section>
    </>
  );
}
