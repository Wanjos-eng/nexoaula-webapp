"use client";

import { useCallback, useRef, useState, type FormEvent } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { useAuthSession } from "@/modules/auth";
import { useRemote } from "./useRemote";
import { Failure, Loading } from "./AsyncState";
import { localDateTime, type GroupTopic } from "./schedule";
import {
  cancelMeeting,
  createMeeting,
  listGroupMeetings,
  listMeetingTopics,
  putMeetingParticipation,
  reportMeetingOutcome,
  updateMeeting,
  type Meeting,
  type MeetingCreateInput,
  type MeetingModality,
  type MeetingOutcomeInput,
  type MeetingParticipantStatus,
} from "./meetings.api";
import s from "./GroupMeetings.module.css";

type MeetingData = { meetings: Meeting[]; topics: GroupTopic[] };
type EditorState = { kind: "create" } | { kind: "edit"; meeting: Meeting };

export function GroupMeetings({ groupId, canManage }: { groupId: string; canManage: boolean }) {
  const fetcher = useCallback(async (signal: AbortSignal): Promise<MeetingData> => {
    const [meetings, topics] = await Promise.all([
      listGroupMeetings(groupId, signal),
      listMeetingTopics(groupId, signal),
    ]);
    return { meetings, topics };
  }, [groupId]);
  const remote = useRemote(`meetings-${groupId}`, fetcher, true);
  const { user } = useAuthSession();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Meeting | null>(null);
  const [outcomeTarget, setOutcomeTarget] = useState<Meeting | null>(null);
  const [outcome, setOutcome] = useState<"completed" | "postponed" | "cancelled">("completed");
  const [newStartsAt, setNewStartsAt] = useState("");
  const [newEndsAt, setNewEndsAt] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState<unknown>();
  const [participatingId, setParticipatingId] = useState<string | null>(null);

  async function submitMeeting(input: MeetingCreateInput, meeting?: Meeting) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(undefined);
    setFeedback("");
    try {
      if (meeting) {
        const { groupId: _groupId, ...payload } = input;
        void _groupId;
        await updateMeeting(meeting.id, payload);
        setFeedback("Encontro atualizado.");
      } else {
        await createMeeting(input);
        setFeedback("Encontro agendado.");
      }
      setEditor(null);
      remote.reload();
    } catch (cause) {
      setError(cause);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function confirmCancellation() {
    if (!cancelTarget || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await cancelMeeting(cancelTarget.id);
      setFeedback("Encontro cancelado. O histórico foi preservado.");
      setCancelTarget(null);
      remote.reload();
    } catch (cause) {
      setError(cause);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function changeParticipation(meeting: Meeting, status: MeetingParticipantStatus) {
    if (lock.current || (status === "attended" ? !canRecordPresence(meeting) : !isMeetingOpen(meeting))) return;
    lock.current = true;
    setParticipatingId(meeting.id);
    setError(undefined);
    try {
      await putMeetingParticipation(meeting.id, status);
      setFeedback(status === "attended" ? "Presença registrada." : status === "confirmed" ? "Presença confirmada." : status === "interested" ? "Interesse registrado." : "Participação desmarcada.");
      remote.reload();
    } catch (cause) {
      setError(cause);
    } finally {
      lock.current = false;
      setParticipatingId(null);
    }
  }

  async function submitOutcome() {
    if (!outcomeTarget || lock.current) return;
    let payload: MeetingOutcomeInput;
    if (outcome === "postponed") {
      const start = new Date(newStartsAt);
      const end = new Date(newEndsAt);
      if (!newStartsAt || !newEndsAt || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start <= new Date() || start >= end) {
        setError(new Error("Informe novos horários válidos no futuro; o fim deve ser posterior ao início."));
        return;
      }
      payload = { status: "postponed", startsAt: start.toISOString(), endsAt: end.toISOString() };
    } else {
      payload = { status: outcome };
    }
    lock.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await reportMeetingOutcome(outcomeTarget.id, payload);
      setFeedback(outcome === "completed" ? "Encontro registrado como realizado." : outcome === "postponed" ? "Encontro adiado e novo horário registrado." : "Encontro cancelado. O histórico foi preservado.");
      setOutcomeTarget(null);
      remote.reload();
    } catch (cause) {
      setError(cause);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <section className={s.section} aria-labelledby="group-meetings-title" id="encontros">
      <header className={s.header}>
        <div>
          <p className={s.eyebrow}>Agenda da comunidade</p>
          <h2 id="group-meetings-title">Encontros</h2>
        </div>
        {canManage ? <button className={s.primary} onClick={() => setEditor({ kind: "create" })} type="button">Agendar encontro</button> : null}
      </header>
      {feedback ? <p className={s.feedback} role="status">{feedback}</p> : null}
      {error && !editor && !cancelTarget && !outcomeTarget ? <Failure error={error} /> : null}
      {remote.loading ? <Loading /> : remote.error ? <Failure error={remote.error} retry={remote.reload} /> : !remote.data?.meetings.length ? (
        <p className={s.empty}>Nenhum encontro registrado para esta comunidade.</p>
      ) : (
        <div className={s.list}>
          {remote.data.meetings.map((meeting) => {
            const disabled = !isMeetingOpen(meeting);
            const statusLabel = meeting.status === "cancelled" ? "Cancelado" : meeting.status === "completed" ? "Realizado" : meeting.status === "postponed" ? "Adiado" : "Agendado";
            const date = new Date(meeting.startsAt);
            const timeRange = `${formatTime(date)}${meeting.endsAt ? ` – ${formatTime(new Date(meeting.endsAt))}` : ""}`;
            const currentStatus = meeting.participantStatus;
            return (
              <article className={s.card} key={meeting.id}>
                <div className={s.cardHead}>
                  <div>
                    <span className={meeting.status === "cancelled" ? s.cancelledBadge : s.statusBadge}>{statusLabel}</span>
                    <h3>{meeting.title}</h3>
                  </div>
                  <span className={s.confirmedCount} aria-label={`${meeting.confirmedCount} pessoas confirmadas`}>
                    {meeting.confirmedCount} {meeting.confirmedCount === 1 ? "confirmado" : "confirmados"}
                  </span>
                </div>
                <p className={s.meta}>{date.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })} · {timeRange}</p>
                <p className={s.meta}>{modalityLabel(meeting.modality)}</p>
                {meeting.topicIds.length ? <p className={s.topic}>Tópicos: {meeting.topicIds.map((topicId) => topicLabel(remote.data?.topics ?? [], topicId)).join(", ")}</p> : null}
                {meeting.description ? <p className={s.description}>{meeting.description}</p> : null}
                {meeting.location ? <p className={s.meta}>Local: {meeting.location}</p> : null}
                {meeting.externalUrl ? <a className={s.external} href={meeting.externalUrl} target="_blank" rel="noreferrer">Abrir link do encontro</a> : null}
                <p className={s.meta}>Sua participação: {currentStatus === "attended" ? "Presença registrada" : currentStatus === "confirmed" ? "Confirmada" : currentStatus === "interested" ? "Interesse registrado" : currentStatus === "cancelled" ? "Desistência registrada" : "Não informada"}</p>
                {canRecordPresence(meeting) && currentStatus !== "attended" ? (
                  <button className={s.secondary} disabled={participatingId === meeting.id} onClick={() => void changeParticipation(meeting, "attended")} type="button">Registrar minha presença</button>
                ) : null}
                {disabled ? <p className={s.disabledHint}>Inscrições encerradas. A presença pode ser registrada após o início, exceto em encontros cancelados.</p> : (
                  <div className={s.actions}>
                    <button className={currentStatus === "interested" ? s.selected : s.secondary} disabled={participatingId === meeting.id} onClick={() => void changeParticipation(meeting, "interested")} type="button">Tenho interesse</button>
                    <button className={currentStatus === "confirmed" ? s.selected : s.secondary} disabled={participatingId === meeting.id} onClick={() => void changeParticipation(meeting, "confirmed")} type="button">Confirmar</button>
                    {currentStatus && currentStatus !== "cancelled" ? <button className={s.textButton} disabled={participatingId === meeting.id} onClick={() => void changeParticipation(meeting, "cancelled")} type="button">Desmarcar</button> : null}
                  </div>
                )}
                {canManage && (meeting.status === "scheduled" || meeting.status === "postponed") ? (
                  <div className={s.organizerActions}>
                    <button className={s.textButton} disabled={!isMeetingOpen(meeting)} onClick={() => { setError(undefined); setEditor({ kind: "edit", meeting }); }} type="button">Editar</button>
                    <button className={s.dangerText} onClick={() => setCancelTarget(meeting)} type="button">Cancelar encontro</button>
                    {meeting.organizerId === user.id ? <button className={s.textButton} onClick={() => { setOutcomeTarget(meeting); setOutcome("completed"); setError(undefined); }} type="button">Registrar resultado</button> : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
      {editor ? (
        <Dialog
          onClose={() => {
            if (!busy) setEditor(null);
          }}
          titleId="meeting-editor-title"
        >
          {error ? <Failure error={error} /> : null}
          <h2 id="meeting-editor-title">
            {editor.kind === "edit" ? "Editar encontro" : "Agendar encontro"}
          </h2>
          <MeetingForm
            groupId={groupId}
            topics={remote.data?.topics ?? []}
            initial={editor.kind === "edit" ? editor.meeting : undefined}
            busy={busy}
            onCancel={() => setEditor(null)}
            onSubmit={(input) =>
              submitMeeting(
                input,
                editor.kind === "edit" ? editor.meeting : undefined,
              )
            }
          />
        </Dialog>
      ) : null}
      {cancelTarget ? (
        <div className={s.backdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setCancelTarget(null); }}>
          <section className={s.modal} role="dialog" aria-modal="true" aria-labelledby="cancel-meeting-title">
            {error ? <Failure error={error} /> : null}
            <h2 id="cancel-meeting-title">Cancelar encontro?</h2>
            <p>“{cancelTarget.title}” ficará no histórico com status cancelado. As pessoas não poderão mais alterar a participação.</p>
            <div className={s.actions}>
              <button className={s.danger} disabled={busy} onClick={() => void confirmCancellation()} type="button">Confirmar cancelamento</button>
              <button className={s.secondary} disabled={busy} onClick={() => setCancelTarget(null)} type="button">Manter encontro</button>
            </div>
          </section>
        </div>
      ) : null}
      {outcomeTarget ? (
        <div className={s.backdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setOutcomeTarget(null); }}>
          <section className={s.modal} role="dialog" aria-modal="true" aria-labelledby="meeting-outcome-title">
            {error ? <Failure error={error} /> : null}
            <h2 id="meeting-outcome-title">Registrar resultado</h2>
            <p>Atualize o histórico de “{outcomeTarget.title}”.</p>
            <div className={s.form}>
              <label>Resultado<select value={outcome} onChange={(event) => setOutcome(event.target.value as typeof outcome)}>
                <option value="completed">Realizado</option><option value="postponed">Adiado</option><option value="cancelled">Cancelado</option>
              </select></label>
              {outcome === "postponed" ? <>
                <label>Novo início<input type="datetime-local" value={newStartsAt} onChange={(event) => setNewStartsAt(event.target.value)} /></label>
                <label>Novo fim<input type="datetime-local" value={newEndsAt} onChange={(event) => setNewEndsAt(event.target.value)} /></label>
              </> : null}
              {outcome === "completed" && isMeetingOpen(outcomeTarget) ? <p className={s.meta}>O resultado “Realizado” fica disponível após o horário de término.</p> : null}
              <div className={s.actions}>
                <button className={s.primary} disabled={busy || (outcome === "completed" && isMeetingOpen(outcomeTarget))} onClick={() => void submitOutcome()} type="button">{busy ? "Salvando…" : "Salvar resultado"}</button>
                <button className={s.secondary} disabled={busy} onClick={() => setOutcomeTarget(null)} type="button">Fechar</button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function MeetingForm({
  groupId, topics, initial, busy, onCancel, onSubmit,
}: {
  groupId: string;
  topics: GroupTopic[];
  initial?: Meeting;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (input: MeetingCreateInput) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [modality, setModality] = useState<MeetingModality>(initial?.modality ?? "online");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [externalUrl, setExternalUrl] = useState(initial?.externalUrl ?? "");
  const [startsAt, setStartsAt] = useState(initial ? localDateTime(initial.startsAt) : "");
  const [endsAt, setEndsAt] = useState(initial?.endsAt ? localDateTime(initial.endsAt) : "");
  const [topicIds, setTopicIds] = useState<string[]>(initial?.topicIds ?? []);
  const [validation, setValidation] = useState("");
  const availableTopics = topics.filter((topic) => topic.subjectTopicId !== null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (!title.trim() || !startsAt || !endsAt || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
      setValidation("Informe título e horários válidos; o fim deve ser posterior ao início.");
      return;
    }
    if ((modality === "in_person" || modality === "hybrid") && !location.trim()) {
      setValidation("Informe o local deste encontro.");
      return;
    }
    if ((modality === "online" || modality === "hybrid") && !isValidHttpUrl(externalUrl)) {
      setValidation("Informe um link válido iniciado por http:// ou https://.");
      return;
    }
    setValidation("");
    onSubmit({
      groupId,
      title: title.trim(),
      description: description.trim() || null,
      modality,
      location: location.trim() || null,
      externalUrl: externalUrl.trim() || null,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      topicIds: availableTopics.flatMap((topic) => topic.subjectTopicId && topicIds.includes(topic.subjectTopicId) ? [topic.subjectTopicId] : []),
    });
  }

  return (
    <form className={s.form} onSubmit={submit}>
      <label>Título<input maxLength={200} required value={title} onChange={(event) => setTitle(event.target.value)} /></label>
      <label>Tópico da comunidade<select value={topicIds[0] ?? ""} onChange={(event) => setTopicIds(event.target.value ? [event.target.value] : [])}>
        <option value="">Sem tópico</option>
        {availableTopics.map((topic) => <option key={topic.id} value={topic.subjectTopicId ?? ""}>{topic.customTitle ?? topic.topicName ?? `Assunto ${topic.subjectTopicId?.slice(0, 8)}`}</option>)}
      </select></label>
      {!availableTopics.length ? <small>Associe tópicos acadêmicos à comunidade para selecioná-los aqui.</small> : null}
      <label>Descrição<textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
      <label>Formato<select value={modality} onChange={(event) => setModality(event.target.value as MeetingModality)}>
        <option value="online">Online</option><option value="in_person">Presencial</option><option value="hybrid">Híbrido</option>
      </select></label>
      {modality !== "online" ? <label>Local<input maxLength={250} required value={location} onChange={(event) => setLocation(event.target.value)} /></label> : null}
      {modality !== "in_person" ? <label>Link externo<input type="url" required value={externalUrl} onChange={(event) => setExternalUrl(event.target.value)} placeholder="https://…" /></label> : null}
      <label>Início<input required type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label>
      <label>Fim<input required type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} /></label>
      {validation ? <p className={s.validation} role="alert">{validation}</p> : null}
      <div className={s.actions}>
        <button className={s.primary} disabled={busy} type="submit">{busy ? "Salvando…" : initial ? "Salvar alterações" : "Agendar encontro"}</button>
        <button className={s.secondary} disabled={busy} onClick={onCancel} type="button">Fechar</button>
      </div>
    </form>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function canRecordPresence(meeting: Meeting): boolean {
  return meeting.status !== "cancelled" && Date.now() >= new Date(meeting.startsAt).getTime();
}

function isMeetingOpen(meeting: Meeting): boolean {
  if (meeting.status !== "scheduled" && meeting.status !== "postponed") return false;
  return Date.now() < new Date(meeting.endsAt ?? meeting.startsAt).getTime();
}

function modalityLabel(modality: MeetingModality): string {
  return modality === "online" ? "Online" : modality === "in_person" ? "Presencial" : "Híbrido";
}

function topicLabel(topics: GroupTopic[], subjectTopicId: string): string {
  const topic = topics.find((candidate) => candidate.subjectTopicId === subjectTopicId);
  return topic?.customTitle ?? topic?.topicName ?? `Assunto ${subjectTopicId.slice(0, 8)}`;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
