import { useCallback } from "react";
import { useRemote } from "./useRemote";
import { listChannels } from "./api";

export function useChannels(groupId: string) {
  const fetcher = useCallback(
    (signal: AbortSignal) => listChannels(groupId, signal),
    [groupId],
  );
  const remote = useRemote(groupId + "/channels", fetcher, true);

  return {
    channels: remote.data,
    loading: remote.loading,
    error: remote.error,
    reload: remote.reload,
  };
}
