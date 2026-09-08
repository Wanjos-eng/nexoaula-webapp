import type { LessonOccurrence } from "./types";

export function canRecordAttendance(occurrence: LessonOccurrence, now: string): boolean {
  const start = Date.parse(occurrence.actualStartsAt ?? "");
  const end = Date.parse(occurrence.actualEndsAt ?? "");
  return occurrence.status === "held" && Number.isFinite(start) && Number.isFinite(end)
    && start < end && end <= Date.parse(now);
}
