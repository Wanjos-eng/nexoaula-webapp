"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  CHANNEL_MESSAGE_PAGE_SIZE,
  createChannelMessage,
  deleteChannelMessage,
  listChannelMessages,
  type ChannelMessage,
  type ChannelMessageCreate,
  updateChannelMessage,
} from "./messages.api";

const POLL_INTERVAL_MS = 5_000;

type MessageState = {
  key: string;
  messages: ChannelMessage[];
  loading: boolean;
  loadingOlder: boolean;
  refreshing: boolean;
  mutating: boolean;
  error?: unknown;
  mutationError?: unknown;
  hasOlder: boolean;
};

function sortMessages(messages: ChannelMessage[]) {
  return [...messages].sort((left, right) => {
    const time = left.createdAt.localeCompare(right.createdAt);
    return time || left.id.localeCompare(right.id);
  });
}

function mergeMessages(
  current: ChannelMessage[],
  incoming: ChannelMessage[],
): ChannelMessage[] {
  const merged = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) merged.set(message.id, message);
  return sortMessages([...merged.values()]);
}

export function useChannelMessages(groupId: string, channelId?: string) {
  const key = `${groupId}/${channelId ?? "none"}`;
  const generationRef = useRef(0);
  const initialControllerRef = useRef<AbortController | null>(null);
  const pollControllerRef = useRef<AbortController | null>(null);
  const pollingRef = useRef(false);
  const messagesRef = useRef<ChannelMessage[]>([]);

  const [state, setState] = useState<MessageState>({
    key,
    messages: [],
    loading: Boolean(channelId),
    loadingOlder: false,
    refreshing: false,
    mutating: false,
    hasOlder: false,
  });

  useEffect(() => {
    messagesRef.current = state.key === key ? state.messages : [];
  }, [key, state.key, state.messages]);

  const loadInitial = useCallback(async () => {
    generationRef.current += 1;
    const generation = generationRef.current;
    initialControllerRef.current?.abort();
    pollControllerRef.current?.abort();
    pollingRef.current = false;

    if (!channelId) {
      messagesRef.current = [];
      setState({
        key,
        messages: [],
        loading: false,
        loadingOlder: false,
        refreshing: false,
        mutating: false,
        hasOlder: false,
      });
      return;
    }

    const controller = new AbortController();
    initialControllerRef.current = controller;
    messagesRef.current = [];
    setState({
      key,
      messages: [],
      loading: true,
      loadingOlder: false,
      refreshing: false,
      mutating: false,
      hasOlder: false,
    });

    try {
      const page = await listChannelMessages(groupId, channelId, {
        limit: CHANNEL_MESSAGE_PAGE_SIZE,
        signal: controller.signal,
      });
      if (controller.signal.aborted || generation !== generationRef.current) return;
      messagesRef.current = page;
      setState({
        key,
        messages: page,
        loading: false,
        loadingOlder: false,
        refreshing: false,
        mutating: false,
        hasOlder: page.length === CHANNEL_MESSAGE_PAGE_SIZE,
      });
    } catch (error) {
      if (controller.signal.aborted || generation !== generationRef.current) return;
      setState({
        key,
        messages: [],
        loading: false,
        loadingOlder: false,
        refreshing: false,
        mutating: false,
        error,
        hasOlder: false,
      });
    } finally {
      if (initialControllerRef.current === controller) {
        initialControllerRef.current = null;
      }
    }
  }, [channelId, groupId, key]);

  useEffect(() => {
    void loadInitial();
    return () => {
      generationRef.current += 1;
      initialControllerRef.current?.abort();
      pollControllerRef.current?.abort();
      pollingRef.current = false;
    };
  }, [loadInitial]);

  const refresh = useCallback(
    async (silent = true) => {
      if (!channelId || pollingRef.current) return;
      pollingRef.current = true;
      const generation = generationRef.current;
      const controller = new AbortController();
      pollControllerRef.current = controller;

      if (!silent) {
        setState((current) =>
          current.key === key
            ? { ...current, refreshing: true, error: undefined }
            : current,
        );
      }

      try {
        const page = await listChannelMessages(groupId, channelId, {
          limit: CHANNEL_MESSAGE_PAGE_SIZE,
          signal: controller.signal,
        });
        if (controller.signal.aborted || generation !== generationRef.current) return;
        setState((current) => {
          if (current.key !== key) return current;
          const messages = mergeMessages(current.messages, page);
          messagesRef.current = messages;
          return {
            ...current,
            messages,
            refreshing: false,
            hasOlder:
              current.hasOlder || page.length === CHANNEL_MESSAGE_PAGE_SIZE,
          };
        });
      } catch (error) {
        if (controller.signal.aborted || generation !== generationRef.current) return;
        if (!silent) {
          setState((current) =>
            current.key === key
              ? { ...current, refreshing: false, error }
              : current,
          );
        }
      } finally {
        if (pollControllerRef.current === controller) {
          pollControllerRef.current = null;
        }
        pollingRef.current = false;
      }
    },
    [channelId, groupId, key],
  );

  useEffect(() => {
    if (!channelId) return;

    const poll = () => {
      if (document.visibilityState === "visible") void refresh(true);
    };
    const interval = window.setInterval(poll, POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", poll);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", poll);
      pollControllerRef.current?.abort();
      pollingRef.current = false;
    };
  }, [channelId, refresh]);

  const loadOlder = useCallback(async () => {
    if (!channelId) return;
    const offset = messagesRef.current.length;
    setState((current) =>
      current.key === key
        ? { ...current, loadingOlder: true, error: undefined }
        : current,
    );
    try {
      const page = await listChannelMessages(groupId, channelId, {
        offset,
        limit: CHANNEL_MESSAGE_PAGE_SIZE,
      });
      if (generationRef.current < 1) return;
      setState((current) => {
        if (current.key !== key) return current;
        const messages = mergeMessages(page, current.messages);
        messagesRef.current = messages;
        return {
          ...current,
          messages,
          loadingOlder: false,
          hasOlder: page.length === CHANNEL_MESSAGE_PAGE_SIZE,
        };
      });
    } catch (error) {
      setState((current) =>
        current.key === key
          ? { ...current, loadingOlder: false, error }
          : current,
      );
    }
  }, [channelId, groupId, key]);

  const sendMessage = useCallback(
    async (payload: ChannelMessageCreate) => {
      if (!channelId) throw new Error("Nenhum canal selecionado.");
      setState((current) =>
        current.key === key
          ? { ...current, mutating: true, mutationError: undefined }
          : current,
      );
      try {
        const message = await createChannelMessage(groupId, channelId, payload);
        setState((current) => {
          if (current.key !== key) return current;
          const messages = mergeMessages(current.messages, [message]);
          messagesRef.current = messages;
          return { ...current, messages, mutating: false };
        });
        return message;
      } catch (error) {
        setState((current) =>
          current.key === key
            ? { ...current, mutating: false, mutationError: error }
            : current,
        );
        throw error;
      }
    },
    [channelId, groupId, key],
  );

  const editMessage = useCallback(
    async (messageId: string, content: string) => {
      if (!channelId) throw new Error("Nenhum canal selecionado.");
      const previous = messagesRef.current.find((item) => item.id === messageId);
      if (!previous) throw new Error("Mensagem não encontrada.");

      const optimistic: ChannelMessage = {
        ...previous,
        content: content.trim(),
        editedAt: new Date().toISOString(),
      };
      setState((current) =>
        current.key === key
          ? {
              ...current,
              messages: current.messages.map((item) =>
                item.id === messageId ? optimistic : item,
              ),
              mutating: true,
              mutationError: undefined,
            }
          : current,
      );

      try {
        const saved = await updateChannelMessage(
          groupId,
          channelId,
          messageId,
          { content },
        );
        setState((current) => {
          if (current.key !== key) return current;
          const messages = current.messages.map((item) =>
            item.id === messageId ? saved : item,
          );
          messagesRef.current = messages;
          return { ...current, messages, mutating: false };
        });
        return saved;
      } catch (error) {
        setState((current) => {
          if (current.key !== key) return current;
          const messages = current.messages.map((item) =>
            item.id === messageId ? previous : item,
          );
          messagesRef.current = messages;
          return {
            ...current,
            messages,
            mutating: false,
            mutationError: error,
          };
        });
        throw error;
      }
    },
    [channelId, groupId, key],
  );

  const removeMessage = useCallback(
    async (messageId: string) => {
      if (!channelId) throw new Error("Nenhum canal selecionado.");
      const previous = messagesRef.current.find((item) => item.id === messageId);
      if (!previous) throw new Error("Mensagem não encontrada.");

      const optimistic: ChannelMessage = {
        ...previous,
        content: null,
        deletedAt: new Date().toISOString(),
      };
      setState((current) =>
        current.key === key
          ? {
              ...current,
              messages: current.messages.map((item) =>
                item.id === messageId ? optimistic : item,
              ),
              mutating: true,
              mutationError: undefined,
            }
          : current,
      );

      try {
        const removed = await deleteChannelMessage(
          groupId,
          channelId,
          messageId,
        );
        setState((current) => {
          if (current.key !== key) return current;
          const messages = current.messages.map((item) =>
            item.id === messageId ? removed : item,
          );
          messagesRef.current = messages;
          return { ...current, messages, mutating: false };
        });
        return removed;
      } catch (error) {
        setState((current) => {
          if (current.key !== key) return current;
          const messages = current.messages.map((item) =>
            item.id === messageId ? previous : item,
          );
          messagesRef.current = messages;
          return {
            ...current,
            messages,
            mutating: false,
            mutationError: error,
          };
        });
        throw error;
      }
    },
    [channelId, groupId, key],
  );

  const current =
    state.key === key
      ? state
      : {
          key,
          messages: [],
          loading: Boolean(channelId),
          loadingOlder: false,
          refreshing: false,
          mutating: false,
          hasOlder: false,
        };

  return {
    ...current,
    reload: loadInitial,
    refresh: () => refresh(false),
    loadOlder,
    sendMessage,
    editMessage,
    removeMessage,
  };
}
