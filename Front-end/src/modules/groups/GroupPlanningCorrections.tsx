"use client";

import { useCallback, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import { Failure, Loading } from "./AsyncState";
import { useRemote } from "./useRemote";
import { localDateTime, type GroupLessonOccurrence, type GroupTopic, type Lesson } from "./schedule";
import {
  createPlanningCorrection,
  decidePlanningCorrection,
  listPlanningCorrections,
  type PlanningCorrection,
  type PlanningCorrectionKind,
} from "./planning-corrections.api";
import s from "./GroupPlanningCorrections.module.css";

type CorrectionTarget = {
  type: "lesson" | "occurrence";
  id: string;
  title: string;
  snapshot: Record<string, unknown>;
};

type Props = {
  groupId: string;
  canManage: boolean;
  lessons: Lesson[];
  occurrences: GroupLessonOccurrence[];
  topics: GroupTopic[];
  onApplied: () => void;
};

export function GroupPlanningCorrections({
  groupId, canManage, lessons, occurrences, topics, onApplied,
}: Props) {
  const fetcher = useCallback(
    (signal: AbortSignal) => listPlanningCorrections(groupId, signal),
    [groupId],
  );
  const remote = useRemote(`planning-corrections-${groupId}`, fetcher, true);
  const [target, setTarget] = useState<CorrectionTarget | null>(null);
  const [kind, setKind] = useState<PlanningCorrectionKind>("schedule");
  const [field, setField] = useState("scheduledAt");
  const [value, setValue] = useState("");
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const [actualStartedAt, setActualStartedAt] = useState("");
  const [actualEndedAt, setActualEndedAt] = useState("");
  const [rescheduledTo, setRescheduledTo] = useState("");
  const [reason, setReason] = useState("");
  const [decision, setDecision] = useState<{ correction: PlanningCorrection; status: "approved" | "rejected" } | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<unknown>();
  const [feedback, setFeedback] = useState("");
  const corrections = remote.data ?? [];

  function openSuggestion(next: CorrectionTarget) {
    setTarget(next);
    const initialField = next.type === "lesson" ? "scheduledAt" : "status";
    setKind(next.type === "lesson" ? "schedule" : "status");
    setField(initialField);
    setValue(initialField === "scheduledAt"
      ? localDateTime(String(next.snapshot.scheduledAt ?? ""))
      : String(next.snapshot[initialField] ?? ""));
    setSelectedTopicIds(Array.isArray(next.snapshot.topicIds) ? next.snapshot.topicIds.map(String) : []);
    setActualStartedAt(next.snapshot.actualStartedAt ? localDateTime(String(next.snapshot.actualStartedAt)) : "");
    setActualEndedAt(next.snapshot.actualEndedAt ? localDateTime(String(next.snapshot.actualEndedAt)) : "");
    setRescheduledTo(next.snapshot.rescheduledTo ? localDateTime(String(next.snapshot.rescheduledTo)) : "");
    setReason("");
    setError(undefined);
    setFeedback("");
  }

  function changeField(nextField: string) {
    if (!target) return;
    setField(nextField);
    const raw = target.snapshot[nextField];
    setValue(isDateField(nextField) && raw ? localDateTime(String(raw)) : String(raw ?? ""));
    if (nextField === "topicIds") {
      setSelectedTopicIds(Array.isArray(raw) ? raw.map(String) : []);
    }
  }

  async function submitSuggestion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!target || lock.current) return;
    let proposedPatch: Record<string, unknown>;
    if (field === "topicIds") {
      proposedPatch = { topicIds: [...selectedTopicIds].sort() };
    } else if (target.type === "lesson" && field === "scheduledAt") {
      const date = new Date(value);
      if (!value || Number.isNaN(date.getTime())) {
        setError(new Error("Informe uma data e horário válidos."));
        return;
      }
      proposedPatch = { scheduledAt: date.toISOString() };
    } else if (target.type === "occurrence" && field === "status") {
      proposedPatch = { status: value };
      if (value === "held") {
        const started = new Date(actualStartedAt);
        const ended = new Date(actualEndedAt);
        if (!actualStartedAt || !actualEndedAt || Number.isNaN(started.getTime()) || Number.isNaN(ended.getTime()) || started >= ended) {
          setError(new Error("Para sugerir a realização, informe início e término válidos."));
          return;
        }
        proposedPatch.actualStartedAt = started.toISOString();
        proposedPatch.actualEndedAt = ended.toISOString();
      } else if (value === "postponed") {
        const nextDate = new Date(rescheduledTo);
        if (!rescheduledTo || Number.isNaN(nextDate.getTime())) {
          setError(new Error("Informe a nova data para sugerir o adiamento."));
          return;
        }
        proposedPatch.rescheduledTo = nextDate.toISOString();
      }
    } else {
      proposedPatch = { [field]: value.trim() || null };
    }

    lock.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await createPlanningCorrection(groupId, {
        groupId,
        ...(target.type === "lesson" ? { scheduledLessonId: target.id } : { lessonOccurrenceId: target.id }),
        kind,
        proposedPatch,
        reason: reason.trim() || null,
      });
      setFeedback("Sugestão enviada. O cronograma não foi alterado.");
      setTarget(null);
      remote.reload();
    } catch (cause) {
      setError(cause);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function confirmDecision() {
    if (!decision || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await decidePlanningCorrection(groupId, decision.correction.id, {
        status: decision.status,
        decisionNote: decisionNote.trim() || null,
      });
      setFeedback(decision.status === "approved" ? "Sugestão aprovada e alteração aplicada." : "Sugestão recusada.");
      setDecision(null);
      setDecisionNote("");
      remote.reload();
      if (decision.status === "approved") onApplied();
    } catch (cause) {
      setError(cause);
      remote.reload();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  const suggestionTargets = lessons.flatMap((lesson) => {
    const lessonTarget: CorrectionTarget = { type: "lesson", id: lesson.id, title: lesson.title, snapshot: lesson };
    const occurrence = occurrences.find((item) => item.scheduledLessonId === lesson.id);
    const occurrenceTarget: CorrectionTarget | null = occurrence
      ? { type: "occurrence", id: occurrence.id, title: `${lesson.title} · ocorrência`, snapshot: occurrence }
      : null;
    return [lessonTarget, ...(occurrenceTarget ? [occurrenceTarget] : [])];
  });
  const pending = corrections.filter((item) => item.status === "pending");

  return (
    <section className={s.section} aria-labelledby="planning-corrections-title">
      <header className={s.header}>
        <div>
          <p className={s.eyebrow}>Participação no cronograma</p>
          <h3 id="planning-corrections-title">Sugestões de correção</h3>
        </div>
      </header>
      {feedback ? <p className={s.success} role="status">{feedback}</p> : null}
      {error ? <p className={s.error} role="alert">{correctionError(error)}</p> : null}
      {remote.error ? <Failure error={remote.error} retry={remote.reload} /> : null}
      {remote.loading ? <Loading /> : null}

      {canManage && pending.length > 0 ? (
        <div className={s.queue} aria-label="Fila de correções pendentes">
          <h4>Fila do organizador · {pending.length} pendente{pending.length === 1 ? "" : "s"}</h4>
          {pending.map((correction) => (
            <article className={s.correction} key={correction.id}>
              <div className={s.correctionHeader}>
                <div>
                  <strong>{correctionTargetTitle(correction, lessons, occurrences)}</strong>
                  <p>{kindLabel(correction.kind)} · enviado em {new Date(correction.createdAt).toLocaleString("pt-BR")}</p>
                </div>
                <span className={s.pending}>{statusLabel(correction.status)}</span>
              </div>
              <DiffView correction={correction} />
              {correction.reason ? <p className={s.reason}><strong>Justificativa:</strong> {correction.reason}</p> : null}
              <div className={s.actions}>
                <button className={s.primary} type="button" onClick={() => { setDecision({ correction, status: "approved" }); setDecisionNote(""); setError(undefined); }}>Aprovar</button>
                <button className={s.danger} type="button" onClick={() => { setDecision({ correction, status: "rejected" }); setDecisionNote(""); setError(undefined); }}>Recusar</button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      <div className={s.targets}>
        {suggestionTargets.map((item) => {
          const related = corrections.filter((correction) => item.type === "lesson"
            ? correction.scheduledLessonId === item.id
            : correction.lessonOccurrenceId === item.id);
          return (
            <article className={s.target} key={`${item.type}-${item.id}`}>
              <div className={s.targetHeader}>
                <div><strong>{item.title}</strong><small>{item.type === "lesson" ? "Aula prevista" : "Ocorrência registrada"}</small></div>
                <button className={s.secondary} type="button" onClick={() => openSuggestion(item)}>Sugerir correção</button>
              </div>
              {related.length ? (
                <ul className={s.statusList} aria-label={`Status das sugestões para ${item.title}`}>
                  {related.map((correction) => (
                    <li key={correction.id}>
                      <span className={statusClass(correction.status)}>{statusLabel(correction.status)}</span>
                      <span>{kindLabel(correction.kind)} · {new Date(correction.createdAt).toLocaleDateString("pt-BR")}</span>
                      {correction.decisionNote ? <small>{correction.decisionNote}</small> : null}
                    </li>
                  ))}
                </ul>
              ) : <p className={s.muted}>Nenhuma sugestão para este item.</p>}
            </article>
          );
        })}
      </div>

      {target ? (
        <div className={s.backdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setTarget(null); }}>
          <section className={s.modal} role="dialog" aria-modal="true" aria-labelledby="correction-create-title">
            <h3 id="correction-create-title">Sugerir correção</h3>
            <p className={s.muted}>{target.title} · a proposta ficará pendente até a decisão do organizador.</p>
            <form className={s.form} onSubmit={submitSuggestion}>
              <label>Tipo de correção<select value={kind} onChange={(event) => setKind(event.target.value as PlanningCorrectionKind)}>
                <option value="schedule">Cronograma</option><option value="topics">Tópicos</option><option value="status">Status</option><option value="details">Detalhes</option><option value="other">Outro</option>
              </select></label>
              <label>Alteração proposta<select value={field} onChange={(event) => changeField(event.target.value)}>
                {target.type === "lesson" ? <>
                  <option value="title">Título</option><option value="description">Descrição</option><option value="scheduledAt">Data e horário</option><option value="topicIds">Tópicos</option>
                </> : <>
                  <option value="status">Status da ocorrência</option><option value="notes">Notas</option><option value="topicIds">Tópicos</option>
                  {target.snapshot.status === "held" ? <><option value="actualStartedAt">Início real</option><option value="actualEndedAt">Término real</option></> : null}
                  {target.snapshot.status === "postponed" ? <option value="rescheduledTo">Data reagendada</option> : null}
                </>}
              </select></label>
              {field === "topicIds" ? (
                <label>Tópicos propostos<select multiple value={selectedTopicIds} onChange={(event) => setSelectedTopicIds(Array.from(event.target.selectedOptions, (option) => option.value))}>
                  {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.customTitle ?? topic.topicName ?? topic.id}</option>)}
                </select><small>Use Ctrl ou Command para selecionar mais de um tópico.</small></label>
              ) : target.type === "occurrence" && field === "status" ? (
                <>
                  <label>Status proposto<select value={value} onChange={(event) => setValue(event.target.value)}>
                    <option value="held">Realizada</option><option value="postponed">Adiada</option><option value="cancelled">Cancelada</option>
                  </select></label>
                  {value === "held" ? <div className={s.fields}>
                    <label>Início real<input required type="datetime-local" value={actualStartedAt} onChange={(event) => setActualStartedAt(event.target.value)} /></label>
                    <label>Término real<input required type="datetime-local" value={actualEndedAt} onChange={(event) => setActualEndedAt(event.target.value)} /></label>
                  </div> : null}
                  {value === "postponed" ? <label>Nova data<input required type="datetime-local" value={rescheduledTo} onChange={(event) => setRescheduledTo(event.target.value)} /></label> : null}
                </>
              ) : isDateField(field) ? (
                <label>Valor proposto<input required type="datetime-local" value={value} onChange={(event) => setValue(event.target.value)} /></label>
              ) : field === "notes" || field === "description" ? (
                <label>Texto proposto<textarea rows={4} value={value} onChange={(event) => setValue(event.target.value)} /></label>
              ) : (
                <label>Valor proposto<input required maxLength={255} value={value} onChange={(event) => setValue(event.target.value)} /></label>
              )}
              <label>Justificativa<textarea rows={3} maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explique o motivo da sugestão (opcional)" /></label>
              <div className={s.actions}>
                <button className={s.primary} disabled={busy} type="submit">{busy ? "Enviando…" : "Enviar sugestão"}</button>
                <button className={s.secondary} disabled={busy} onClick={() => setTarget(null)} type="button">Fechar</button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {decision ? (
        <div className={s.backdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDecision(null); }}>
          <section className={s.modal} role="dialog" aria-modal="true" aria-labelledby="correction-decision-title">
            <h3 id="correction-decision-title">{decision.status === "approved" ? "Aprovar correção?" : "Recusar correção?"}</h3>
            <p className={s.muted}>{correctionTargetTitle(decision.correction, lessons, occurrences)}</p>
            <DiffView correction={decision.correction} />
            <label className={s.field}>Observação da decisão<textarea rows={3} maxLength={2000} value={decisionNote} onChange={(event) => setDecisionNote(event.target.value)} placeholder="Opcional" /></label>
            <div className={s.actions}>
              <button className={decision.status === "approved" ? s.primary : s.danger} type="button" disabled={busy} onClick={() => void confirmDecision()}>
                {busy ? "Salvando…" : decision.status === "approved" ? "Confirmar aprovação" : "Confirmar recusa"}
              </button>
              <button className={s.secondary} type="button" disabled={busy} onClick={() => setDecision(null)}>Voltar</button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function DiffView({ correction }: { correction: PlanningCorrection }) {
  const entries = Object.entries(correction.diff ?? {});
  const rows = entries.length ? entries : Object.entries(correction.proposedPatch).map(([key, after]) => [key, { before: correction.originalSnapshot[key], after }] as const);
  return (
    <div className={s.diff} aria-label="Comparação antes e depois">
      {rows.length ? rows.map(([key, values]) => (
        <div className={s.diffRow} key={key}>
          <strong>{fieldLabel(key)}</strong>
          <div><small>Antes</small><span>{displayValue(values.before)}</span></div>
          <div><small>Depois</small><span>{displayValue(values.after)}</span></div>
        </div>
      )) : <p className={s.muted}>A proposta não contém diferenças em relação ao snapshot.</p>}
    </div>
  );
}

function correctionTargetTitle(
  correction: PlanningCorrection,
  lessons: Lesson[],
  occurrences: GroupLessonOccurrence[],
): string {
  const occurrence = occurrences.find((item) => item.id === correction.lessonOccurrenceId);
  const lessonId = correction.scheduledLessonId ?? occurrence?.scheduledLessonId;
  const lesson = lessons.find((item) => item.id === lessonId);
  if (lesson) return correction.lessonOccurrenceId ? `${lesson.title} · ocorrência` : lesson.title;
  return correction.scheduledLessonId ? "Aula prevista" : "Ocorrência de aula";
}

function correctionError(error: unknown): string {
  if (error instanceof ApiError && error.status === 409) {
    const body = error.body as { detail?: unknown } | null;
    const detail = typeof body?.detail === "string" ? body.detail : "A sugestão já foi decidida ou o recurso foi alterado desde o snapshot.";
    return `Conflito (409): ${detail} Atualize a fila antes de continuar.`;
  }
  if (error instanceof ApiError && error.status === 403) return "Ação permitida apenas para membros ativos ou organizadores autorizados.";
  if (error instanceof Error && !(error instanceof ApiError)) return error.message;
  return "Não foi possível concluir a operação de correção. Tente novamente.";
}

function statusLabel(status: PlanningCorrection["status"]): string {
  return status === "pending" ? "Pendente" : status === "approved" ? "Aprovada" : "Recusada";
}

function statusClass(status: PlanningCorrection["status"]): string {
  return status === "pending" ? s.pending : status === "approved" ? s.approved : s.rejected;
}

function kindLabel(kind: PlanningCorrectionKind): string {
  return ({ schedule: "Cronograma", topics: "Tópicos", status: "Status", details: "Detalhes", other: "Outro" })[kind];
}

function fieldLabel(field: string): string {
  return ({
    title: "Título", description: "Descrição", scheduledAt: "Data e horário", topicIds: "Tópicos",
    status: "Status", actualStartedAt: "Início real", actualEndedAt: "Término real",
    rescheduledTo: "Nova data", notes: "Notas", scheduledLessonId: "Aula vinculada",
  })[field] ?? field;
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.length ? value.map(String).join(", ") : "Nenhum tópico";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toLocaleString("pt-BR");
  if (typeof value === "object") return JSON.stringify(value);
  if (value === "held") return "Realizada";
  if (value === "postponed") return "Adiada";
  if (value === "cancelled") return "Cancelada";
  return String(value);
}

function isDateField(field: string): boolean {
  return field === "scheduledAt" || field === "actualStartedAt" || field === "actualEndedAt" || field === "rescheduledTo";
}
