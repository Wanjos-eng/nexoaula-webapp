import { apiClient } from "@/lib/api";
import { read } from "./api";
import { invalidateGroups } from "./schedule";

export type PlanningCorrectionKind = "schedule" | "topics" | "status" | "details" | "other";
export type PlanningCorrectionStatus = "pending" | "approved" | "rejected";

export type PlanningCorrection = {
  id: string;
  groupId: string;
  suggestedBy: string;
  scheduledLessonId: string | null;
  lessonOccurrenceId: string | null;
  kind: PlanningCorrectionKind;
  originalSnapshot: Record<string, unknown>;
  proposedPatch: Record<string, unknown>;
  diff: Record<string, { before: unknown; after: unknown }>;
  reason: string | null;
  status: PlanningCorrectionStatus;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
};

export type PlanningCorrectionCreateInput = {
  groupId: string;
  scheduledLessonId?: string;
  lessonOccurrenceId?: string;
  kind: PlanningCorrectionKind;
  proposedPatch: Record<string, unknown>;
  reason: string | null;
};

export type PlanningCorrectionDecisionInput = {
  status: "approved" | "rejected";
  decisionNote?: string | null;
};

export async function listPlanningCorrections(
  groupId: string,
  signal?: AbortSignal,
  status?: PlanningCorrectionStatus,
): Promise<PlanningCorrection[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return read<PlanningCorrection[]>(`groups/${groupId}/planning-corrections${query}`, signal);
}

export async function createPlanningCorrection(
  groupId: string,
  input: PlanningCorrectionCreateInput,
): Promise<PlanningCorrection> {
  const { data } = await apiClient.post<PlanningCorrection>(
    `/v1/groups/${groupId}/planning-corrections`, { body: input },
  );
  invalidateGroups();
  return data;
}

export async function decidePlanningCorrection(
  groupId: string,
  correctionId: string,
  input: PlanningCorrectionDecisionInput,
): Promise<PlanningCorrection> {
  const { data } = await apiClient.post<PlanningCorrection>(
    `/v1/groups/${groupId}/planning-corrections/${correctionId}/decision`, { body: input },
  );
  invalidateGroups();
  return data;
}
