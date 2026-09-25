"use client";
import { useEffect, useState } from "react";

/** A changing key hides stale data immediately; aborted requests never overwrite the current view. */
export function useRemote<T>(
  key: string,
  fetcher: (signal: AbortSignal) => Promise<T>,
  revalidate = false,
) {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!revalidate) return;
    const refresh = () => setRevision((r) => r + 1);
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    window.addEventListener("nexoaula:groups-changed", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
      window.removeEventListener("nexoaula:groups-changed", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [revalidate]);
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
