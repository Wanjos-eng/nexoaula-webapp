import { apiClient } from "@/lib/api";
import { read } from "./api";
import { invalidateGroups, type GroupTopic } from "./schedule";

export type MeetingStatus = "scheduled" | "cancelled" | "completed";
export type MeetingModality = "in_person" | "online" | "hybrid";
export type MeetingParticipantStatus = "interested" | "confirmed" | "cancelled" | "attended";

export type Meeting = {
  id: string;
  groupId: string;
  channelId: string | null;
  organizerId: string;
  title: string;
  description: string | null;
  modality: MeetingModality;
  location: string | null;
  externalUrl: string | null;
  startsAt: string;
  endsAt: string | null;
  status: MeetingStatus;
  createdAt: string;
  updatedAt: string;
  topicIds: string[];
  confirmedCount: number;
  participantStatus: MeetingParticipantStatus | null;
};

export type MeetingCreateInput = {
  groupId: string;
  title: string;
  description: string | null;
  modality: MeetingModality;
  location: string | null;
  externalUrl: string | null;
  startsAt: string;
  endsAt: string;
  topicIds: string[];
};

export type MeetingUpdateInput = Partial<Omit<MeetingCreateInput, "groupId">> & {
  status?: MeetingStatus;
};

export type MeetingParticipation = {
  meetingId: string;
  userId: string;
  status: MeetingParticipantStatus;
  updatedAt: string;
};

export async function listGroupMeetings(groupId: string, signal?: AbortSignal): Promise<Meeting[]> {
  return read<Meeting[]>(`groups/${groupId}/meetings`, signal);
}

export async function listMyMeetings(start: string, end: string, signal?: AbortSignal): Promise<Meeting[]> {
  const query = new URLSearchParams({ start, end });
  return read<Meeting[]>(`me/meetings?${query}`, signal);
}

export async function listMeetingTopics(groupId: string, signal?: AbortSignal): Promise<GroupTopic[]> {
  return read<GroupTopic[]>(`groups/${groupId}/topics`, signal);
}

export async function createMeeting(input: MeetingCreateInput): Promise<Meeting> {
  const { data } = await apiClient.post<Meeting>(`/v1/groups/${input.groupId}/meetings`, { body: input });
  invalidateGroups();
  return data;
}

export async function updateMeeting(meetingId: string, input: MeetingUpdateInput): Promise<Meeting> {
  const { data } = await apiClient.patch<Meeting>(`/v1/meetings/${meetingId}`, { body: input });
  invalidateGroups();
  return data;
}

export async function cancelMeeting(meetingId: string): Promise<Meeting> {
  const { data } = await apiClient.post<Meeting>(`/v1/meetings/${meetingId}/cancel`, { body: {} });
  invalidateGroups();
  return data;
}

export async function putMeetingParticipation(
  meetingId: string,
  status: MeetingParticipantStatus,
): Promise<MeetingParticipation> {
  const { data } = await apiClient.put<MeetingParticipation>(
    `/v1/meetings/${meetingId}/participants/me`,
    { body: { status } },
  );
  invalidateGroups();
  return data;
}
