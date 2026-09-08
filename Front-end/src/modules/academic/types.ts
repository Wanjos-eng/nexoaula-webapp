export type OccurrenceStatus = "held" | "cancelled" | "postponed" | "scheduled";
export type PersonalAttendanceStatus = "present" | "absent" | "unrecorded";

export type PlannedLesson = {
  id: string;
  sequenceNumber: number;
  title: string;
  description: string;
  topics: string[];
  estimatedHours: number;
};

export type LessonOccurrence = {
  id: string;
  plannedLessonId: string;
  title: string;
  date: string; // YYYY-MM-DD or format
  displayDate: string;
  time: string;
  status: OccurrenceStatus;
  actualStartsAt?: string;
  actualEndsAt?: string;
  notes?: string;
};

export type PersonalRecord = {
  id: string;
  lessonOccurrenceId: string;
  status: PersonalAttendanceStatus;
  recordedAt?: string;
  notes?: string;
  isPrivate: true;
};

export type AcademicDiscipline = {
  groupId: string;
  groupName: string;
  isMember: boolean;
  id: string;
  code: string;
  name: string;
  professor: string;
  period: string;
  classGroup: string;
  schedule: string;
  progressPercentage: number;
  totalLessons: number;
  heldLessons: number;
  pendingTopicsCount: number;
  absencesCount: number;
  available: boolean;
  syllabus: string[];
  materials: { title: string; type: string; info: string; href?: string }[];
  evaluations: { name: string; weight: string; grade: string; status: "Entregue" | "Pendente" }[];
  plannedLessons: PlannedLesson[];
  occurrences: LessonOccurrence[];
  personalRecords: Record<string, PersonalRecord>;
};

export type AcademicCalendarEvent = {
  groupName: string;
  id: string;
  title: string;
  type: "Aula" | "Encontro" | "Entrega";
  date: string; // YYYY-MM-DD
  time: string;
  context: string;
  occurrenceStatus?: OccurrenceStatus;
  href?: string;
};

export type AcademicProgressSummary = {
  groupId: string;
  groupName: string;
  disciplineId: string;
  disciplineName: string;
  classGroup: string;
  period: string;
  progressPercentage: number;
  heldLessonsCount: number;
  pendingTopicsCount: number;
  attendanceStatusLabel: string;
  nextFocusTopic: string;
};
