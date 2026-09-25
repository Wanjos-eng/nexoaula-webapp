import { apiClient, ApiError } from "@/lib/api";

export type CatalogItem = {
  id: string;
  name?: string;
  label?: string;
  institutionId?: string;
  subjectId?: string;
  academicTermId?: string;
  fullName?: string;
  teacherId?: string;
  classSectionId?: string;
  topicId?: string;
};
export type Profile = {
  userId: string;
  displayName: string;
  institutionId: string | null;
  courseId: string | null;
  bio: string | null;
  avatarFileId?: string | null;
  avatarUrl?: string | null;
};
export type GroupInput = {
  name: string;
  description: string | null;
  rules: string | null;
  visibility: "public" | "unlisted" | "private";
  joinPolicy: "open" | "approval_required" | "invite_only";
  disciplineId: string;
  offeringId: string | null;
  subjectTopicIds?: string[];
};
export type Group = GroupInput & {
  id: string;
  ownerId: string;
  status: string;
  subjectName?: string;
  period?: string;
  capacity: number | null;
};
export type Participation = {
  status: string;
  role: string | null;
  canManage: boolean;
  memberCount: number;
};
export type Participant = {
  userId: string;
  displayName: string;
  status: string;
  role: string | null;
};
export const PAGE_SIZE = 12;
export const entryLabels = {
  open: "Entrada livre",
  approval_required: "Mediante aprovação",
  invite_only: "Somente por convite",
};
export const visibilityLabels = {
  public: "Público",
  unlisted: "Não listado",
  private: "Privado",
};
export async function read<T>(path: string, signal?: AbortSignal): Promise<T> {
  return (await apiClient.get<T>(`/v1/${path}`, { signal })).data;
}
export async function catalog(
  kind: string,
  signal?: AbortSignal,
): Promise<CatalogItem[]> {
  const items: CatalogItem[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await read<CatalogItem[]>(
      `academic/${kind}?limit=100&offset=${offset}`,
      signal,
    );
    items.push(...page);
    if (page.length < 100) return items;
  }
}
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401)
      return "Sua sessão expirou. Entre novamente para continuar.";
    if (error.status === 404)
      return "Este grupo não está disponível ou você não tem acesso a ele.";
    const body = error.body as { detail?: unknown; message?: unknown } | null;
    if (typeof body?.detail === "string") return body.detail;
    if (typeof body?.message === "string") return body.message;
    if (Array.isArray(body?.detail))
      return body.detail
        .map(
          (item: { loc?: string[]; msg?: string }) =>
            `${item.loc?.at(-1) ?? "Campo"}: ${item.msg ?? "valor inválido"}`,
        )
        .join(". ");
    if (error.status === 403)
      return "Você não tem permissão para realizar esta ação.";
    if (error.status === 409)
      return "Os dados mudaram. Confira o estado atualizado antes de tentar novamente.";
  }
  return "Não foi possível concluir. Confira sua conexão e tente novamente.";
}

// --- TASK #120: Canais ---
export type ChannelStatus = "active" | "archived";

export type Channel = {
  id: string;
  groupId: string;
  groupTopicId: string | null;
  topicName: string | null;
  name: string;
  description: string | null;
  createdBy: string;
  status: ChannelStatus;
  createdAt: string;
  archivedAt: string | null;
};

export type ChannelInput = {
  name: string;
  description: string | null;
  groupTopicId?: string | null;
};

export async function listChannels(groupId: string, signal?: AbortSignal): Promise<Channel[]> {
  return read<Channel[]>(`groups/${groupId}/channels`, signal);
}

export async function createChannel(groupId: string, payload: ChannelInput, signal?: AbortSignal): Promise<Channel> {
  return (await apiClient.post<Channel>(`/v1/groups/${groupId}/channels`, { body: payload, signal })).data;
}

export async function updateChannel(groupId: string, channelId: string, payload: Partial<Pick<ChannelInput, "name" | "description">>, signal?: AbortSignal): Promise<Channel> {
  return (await apiClient.patch<Channel>(`/v1/groups/${groupId}/channels/${channelId}`, { body: payload, signal })).data;
}

export async function archiveChannel(groupId: string, channelId: string, signal?: AbortSignal): Promise<Channel> {
  return (await apiClient.post<Channel>(`/v1/groups/${groupId}/channels/${channelId}/archive`, { body: {}, signal })).data;
}
