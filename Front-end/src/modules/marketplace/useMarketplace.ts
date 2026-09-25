"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { useAuthSession } from "@/modules/auth";
import { marketplaceError } from "./marketplace.api";

/** Per-view data from the API; no browser storage or shared account cache. */
export function useMarketplace<T>(path: string) {
  const { user } = useAuthSession();
  const [revision, setRevision] = useState(0);
  const key = `${user.id}:${path}:${revision}`;
  const [result, setResult] = useState<{ key: string; data?: T; error?: string }>({ key: "" });
  useEffect(() => {
    const controller = new AbortController();
    apiClient.get<T>(path, { signal: controller.signal }).then(({ data }) => {
      if (!controller.signal.aborted) setResult({ key, data });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setResult({ key, error: marketplaceError(error) });
    });
    return () => controller.abort();
  }, [key, path]);
  return {
    data: result.key === key ? result.data : undefined,
    error: result.key === key ? result.error : undefined,
    loading: result.key !== key,
    refresh: () => setRevision((value) => value + 1),
  };
}
