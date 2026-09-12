export type GroupEntryMode = "open" | "approval";
export type StudyGroupRole = "Organizador" | "Tutor" | "Participante";

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
  isPremiumCommunity?: boolean;
  studentAccessPrice?: string;
  href?: string;
};

export type OwnedStudyGroup = StudyGroup & {
  role: StudyGroupRole;
};

export type GroupFilters = {
  query: string;
  discipline: string;
  cohort: string;
  topic: string;
};

export type DirectoryStatus = "ready" | "loading" | "error";

export type GroupChannel = {
  id: string;
  name: string;
  description?: string;
};

export type GroupMessage = {
  id: string;
  authorName: string;
  authorInitials: string;
  timestamp: string;
  content: string;
  isOwn?: boolean;
  avatarColor?: string;
};

export type GroupMeeting = {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  mode: "online" | "presencial";
  description?: string;
};

export type GroupParticipant = {
  id: string;
  name: string;
  initials: string;
  role: StudyGroupRole;
  avatarColor?: string;
};

export type GroupDetailData = StudyGroup & {
  role?: StudyGroupRole;
  isMember: boolean;
  channels: GroupChannel[];
  messagesByChannel: Record<string, GroupMessage[]>;
  nextMeetingDetail?: GroupMeeting;
  participants: GroupParticipant[];
  pendingRequestsCount?: number;
  hasPublishedPlan?: boolean;
  planPublishedDate?: string;
};
