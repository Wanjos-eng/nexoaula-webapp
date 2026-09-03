export type GroupEntryMode = "open" | "approval";

export type StudyGroup = {
  id: string;
  name: string;
  description: string;
  discipline: string;
  classGroup: string;
  period: string;
  topics: string[];
  memberCount: number;
  capacity: number;
  location: string;
  entryMode: GroupEntryMode;
  nextMeeting?: string;
  role?: "Organizador" | "Tutor" | "Participante";
  href?: string;
};

export type GroupFilters = {
  query: string;
  discipline: string;
  cohort: string;
  topic: string;
};

export type DirectoryStatus = "ready" | "loading" | "error";
