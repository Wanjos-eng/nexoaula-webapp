import { apiClient } from "@/lib/api";

export type ChannelMessageReplyPreview = {
  id: string;
  authorName: string;
  content: string | null;
  deleted: boolean;
};

export type ChannelMessage = {
  id: string;
  channelId: string;
  authorId: string;
  authorName: string;
  replyToMessageId: string | null;
  replyPreview: ChannelMessageReplyPreview | null;
  content: string | null;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
};

export type ChannelMessageCreate = {
  content: string;
  replyToMessageId?: string | null;
};

export type ChannelMessageUpdate = {
  content: string;
};

export const CHANNEL_MESSAGE_PAGE_SIZE = 50;

function messagesPath(groupId: string, channelId: string) {
  return `/v1/groups/${groupId}/channels/${channelId}/messages`;
}

export async function listChannelMessages(
  groupId: string,
  channelId: string,
  options: { offset?: number; limit?: number; signal?: AbortSignal } = {},
): Promise<ChannelMessage[]> {
  const offset = options.offset ?? 0;
  const limit = options.limit ?? CHANNEL_MESSAGE_PAGE_SIZE;
  const query = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  });
  return (
    await apiClient.get<ChannelMessage[]>(
      `${messagesPath(groupId, channelId)}?${query}`,
      { signal: options.signal },
    )
  ).data;
}

export async function createChannelMessage(
  groupId: string,
  channelId: string,
  payload: ChannelMessageCreate,
  signal?: AbortSignal,
): Promise<ChannelMessage> {
  return (
    await apiClient.post<ChannelMessage>(messagesPath(groupId, channelId), {
      body: payload,
      signal,
    })
  ).data;
}

export async function updateChannelMessage(
  groupId: string,
  channelId: string,
  messageId: string,
  payload: ChannelMessageUpdate,
  signal?: AbortSignal,
): Promise<ChannelMessage> {
  return (
    await apiClient.patch<ChannelMessage>(
      `${messagesPath(groupId, channelId)}/${messageId}`,
      { body: payload, signal },
    )
  ).data;
}

export async function deleteChannelMessage(
  groupId: string,
  channelId: string,
  messageId: string,
  signal?: AbortSignal,
): Promise<ChannelMessage> {
  return (
    await apiClient.del<ChannelMessage>(
      `${messagesPath(groupId, channelId)}/${messageId}`,
      { body: {}, signal },
    )
  ).data;
}
