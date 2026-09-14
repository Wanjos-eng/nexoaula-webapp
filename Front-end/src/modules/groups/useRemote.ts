"use client";
import { useEffect, useState } from "react";

/** A changing key hides stale data immediately; aborted requests never overwrite the current view. */
export function useRemote<T>(
  key: string,
  fetcher: (signal: AbortSignal) => Promise<T>,
) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    revision: number;
    data?: T;
    error?: unknown;
  }>();
  useEffect(() => {
    const controller = new AbortController();
    fetcher(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult({ key, revision, data });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setResult({ key, revision, error });
      });
    return () => controller.abort();
  }, [key, revision, fetcher]);
  const current =
    result?.key === key && result.revision === revision ? result : undefined;
  return {
    data: current?.data,
    error: current?.error,
    loading: !current,
    reload: () => setRevision((r) => r + 1),
  };
}
