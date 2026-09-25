import { apiClient } from "@/lib/api";
import { catalog, read, type Group } from "./api";

export type LessonInput = {
  title: string;
  description: string | null;
  scheduledAt: string;
  topicIds: string[];
};
export type Lesson = LessonInput & {
  id: string;
  groupId: string;
  planId: string;
  createdAt: string;
};
export type TeachingPlan = {
  id: string;
  groupId: string;
  version: number;
  status: "draft" | "published" | "archived";
  publishedAt: string | null;
  lessons: Lesson[];
};

export type GroupTopic = {
  id: string;
  groupId: string;
  subjectTopicId: string | null;
  customTitle: string | null;
  topicName?: string | null;
  createdAt: string;
};

export type OccurrenceStatus = "held" | "cancelled" | "postponed";

export type GroupLessonOccurrence = {
  id: string;
  groupId: string;
  scheduledLessonId: string | null;
  supersedesOccurrenceId: string | null;
  status: OccurrenceStatus;
  actualStartedAt: string | null;
  actualEndedAt: string | null;
  rescheduledTo: string | null;
  notes: string | null;
  recordedBy: string;
  createdAt: string;
  topicIds: string[];
};

export type OccurrenceInput = {
  status: OccurrenceStatus;
  scheduledLessonId?: string | null;
  actualStartedAt?: string | null;
  actualEndedAt?: string | null;
  rescheduledTo?: string | null;
  notes?: string | null;
  topicIds?: string[];
  supersedesOccurrenceId?: string | null;
};

/** Read every page; a student's calendar must not silently stop at 100 lessons. */
export async function readAll<T>(path: string, signal?: AbortSignal): Promise<T[]> {
  const items: T[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await read<T[]>(
      `${path}${path.includes("?") ? "&" : "?"}limit=100&offset=${offset}`,
      signal,
    );
    if (!Array.isArray(page)) return items;
    items.push(...page);
    if (page.length < 100) return items;
  }
}

export const groupPlans = (groupId: string, signal?: AbortSignal) =>
  readAll<TeachingPlan>(`groups/${groupId}/plans`, signal);

export async function saveDraft(groupId: string, lessons: LessonInput[], planId?: string) {
  const path = `/v1/groups/${groupId}/plans`;
  const options = { body: { lessons } };
  const response = planId
    ? await apiClient.patch<TeachingPlan>(`${path}/${planId}`, options)
    : await apiClient.post<TeachingPlan>(path, options);
  invalidateGroups();
  return response.data;
}

export async function publishPlan(groupId: string, planId: string) {
  const response = await apiClient.post<TeachingPlan>(
    `/v1/groups/${groupId}/plans/${planId}/publish`, { body: {} },
  );
  invalidateGroups();
  return response.data;
}

export const GROUPS_CHANGED = "nexoaula:groups-changed";
export function invalidateGroups() {
  window.dispatchEvent(new Event(GROUPS_CHANGED));
}

export type AcademicGroup = Group & { subject: string; section: string; term: string };
export async function academicGroups(signal?: AbortSignal): Promise<AcademicGroup[]> {
  const groups = await readAll<Group>("groups/mine", signal);
  if (!groups.length) return [];
  const [subjects, sections, terms] = await Promise.all([
    catalog("subjects", signal), catalog("class-sections", signal), catalog("academic-terms", signal),
  ]);
  return groups.map((group) => {
    const section = sections.find((item) => item.id === group.offeringId);
    return {
      ...group,
      subject: subjects.find((item) => item.id === group.disciplineId)?.name ?? "Disciplina indisponível",
      section: section?.label ?? "Sem turma vinculada",
      term: terms.find((item) => item.id === section?.academicTermId)?.label ?? "Sem período vinculado",
    };
  });
}

export function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function localDateTime(iso: string) {
  const date = new Date(iso);
  return `${localDateKey(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export async function listGroupTopics(groupId: string, signal?: AbortSignal): Promise<GroupTopic[]> {
  return readAll<GroupTopic>(`groups/${groupId}/topics`, signal);
}

export async function createGroupTopic(
  groupId: string,
  data: { customTitle?: string; subjectTopicId?: string },
): Promise<GroupTopic> {
  const response = await apiClient.post<GroupTopic>(`/v1/groups/${groupId}/topics`, { body: data });
  invalidateGroups();
  return response.data;
}

export async function listGroupOccurrences(
  groupId: string,
  options?: { currentOnly?: boolean; scheduledLessonId?: string },
  signal?: AbortSignal,
): Promise<GroupLessonOccurrence[]> {
  const params = new URLSearchParams();
  if (options?.currentOnly !== undefined) {
    params.set("currentOnly", String(options.currentOnly));
  }
  if (options?.scheduledLessonId) {
    params.set("scheduledLessonId", options.scheduledLessonId);
  }
  const query = params.toString();
  return readAll<GroupLessonOccurrence>(`groups/${groupId}/occurrences${query ? `?${query}` : ""}`, signal);
}

export async function createGroupOccurrence(
  groupId: string,
  data: OccurrenceInput,
): Promise<GroupLessonOccurrence> {
  const response = await apiClient.post<GroupLessonOccurrence>(`/v1/groups/${groupId}/occurrences`, {
    body: data,
  });
  invalidateGroups();
  return response.data;
}

