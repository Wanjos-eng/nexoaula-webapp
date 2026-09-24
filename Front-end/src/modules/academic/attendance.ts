import { apiClient } from "@/lib/api";
import type {
  LessonOccurrence,
  PersonalAttendanceRecord,
  StudentAttendanceAdjustmentRecord,
  StudentTopicProgressRecord,
  TopicProgressStatus,
} from "./types";

/**
 * Validação puramente funcional para saber se uma aula realizada encerrada pode
 * receber registro de frequência pelo aluno.
 */
export function canRecordAttendance(occurrence: LessonOccurrence, now: string): boolean {
  const start = Date.parse(occurrence.actualStartsAt ?? "");
  const end = Date.parse(occurrence.actualEndsAt ?? "");
  return (
    occurrence.status === "held" &&
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    start < end &&
    end <= Date.parse(now)
  );
}

/**
 * Consulta a lista de registros de frequência pessoal vigentes do aluno.
 */
export async function fetchMyAttendance(
  groupId?: string,
  signal?: AbortSignal,
): Promise<PersonalAttendanceRecord[]> {
  const query = groupId ? `?groupId=${encodeURIComponent(groupId)}` : "";
  const res = await apiClient.get<PersonalAttendanceRecord[]>(`/v1/me/attendance${query}`, { signal });
  return res.data;
}

/**
 * Registra ou atualiza a presença privada do aluno em uma ocorrência realizada.
 */
export async function recordMyAttendance(
  occurrenceId: string,
  status: "present" | "absent",
  notes?: string,
): Promise<PersonalAttendanceRecord> {
  const res = await apiClient.post<PersonalAttendanceRecord>("/v1/me/attendance", {
    body: {
      lessonOccurrenceId: occurrenceId,
      status,
      notes: notes?.trim() || null,
    },
  });
  return res.data;
}

/**
 * Remove o registro de frequência pessoal (volta para 'não informado').
 */
export async function removeMyAttendance(occurrenceId: string): Promise<void> {
  await apiClient.del<void>(`/v1/me/attendance/${occurrenceId}`);
}

/**
 * Consulta o progresso pessoal dos tópicos dos grupos do aluno.
 */
export async function fetchMyProgress(
  groupId?: string,
  signal?: AbortSignal,
): Promise<StudentTopicProgressRecord[]> {
  const query = groupId ? `?groupId=${encodeURIComponent(groupId)}` : "";
  const res = await apiClient.get<StudentTopicProgressRecord[]>(`/v1/me/progress${query}`, { signal });
  return res.data;
}

/**
 * Atualiza o status pessoal de dominância de um tópico do grupo.
 */
export async function updateMyProgress(
  groupTopicId: string,
  status: TopicProgressStatus,
  notes?: string,
): Promise<StudentTopicProgressRecord> {
  const res = await apiClient.put<StudentTopicProgressRecord>(`/v1/me/progress/${groupTopicId}`, {
    body: {
      status,
      notes: notes?.trim() || null,
    },
  });
  return res.data;
}

/**
 * Consulta os avisos de retificação/ajuste de frequência do aluno.
 */
export async function fetchMyAdjustments(
  unreadOnly = false,
  signal?: AbortSignal,
): Promise<StudentAttendanceAdjustmentRecord[]> {
  const query = unreadOnly ? "?unreadOnly=true" : "";
  const res = await apiClient.get<StudentAttendanceAdjustmentRecord[]>(
    `/v1/me/attendance-adjustments${query}`,
    { signal },
  );
  return res.data;
}

/**
 * Marca um aviso de ajuste de frequência como visto pelo aluno.
 */
export async function markAdjustmentSeen(
  adjustmentId: string,
): Promise<StudentAttendanceAdjustmentRecord> {
  const res = await apiClient.patch<StudentAttendanceAdjustmentRecord>(
    `/v1/me/attendance-adjustments/${adjustmentId}/seen`,
    { body: {} },
  );
  return res.data;
}
