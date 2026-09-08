"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { ApiError, RequestAbortedError } from "@/lib/api";
import { authService, type PublicUser } from "../services/auth.service";

import styles from "./AuthSessionProvider.module.css";

type AuthSession = {
  user: PublicUser;
  reload: () => Promise<void>;
};

const AuthSessionContext = createContext<AuthSession | null>(null);

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const { replace } = useRouter();
  const abortRef = useRef<AbortController | null>(null);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [status, setStatus] = useState<"loading" | "authenticated" | "error">("loading");

  const restoreSession = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await authService.me(controller.signal);
      if (controller.signal.aborted) return;
      setUser(response.data);
      setStatus("authenticated");
    } catch (error) {
      if (controller.signal.aborted || error instanceof RequestAbortedError) return;
      setUser(null);
      if (error instanceof ApiError && error.status === 401) {
        replace("/login");
        return;
      }
      setStatus("error");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [replace]);

  const reload = useCallback(async () => {
    setStatus("loading");
    await restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;

    authService.me(controller.signal).then((response) => {
      if (controller.signal.aborted) return;
      setUser(response.data);
      setStatus("authenticated");
    }).catch((error: unknown) => {
      if (controller.signal.aborted || error instanceof RequestAbortedError) return;
      setUser(null);
      if (error instanceof ApiError && error.status === 401) {
        replace("/login");
        return;
      }
      setStatus("error");
    });

    return () => controller.abort();
  }, [replace]);

  if (status === "loading") {
    return (
      <main aria-busy="true" className={styles.state}>
        <p>Verificando sua sessão…</p>
      </main>
    );
  }

  if (status === "error" || !user) {
    return (
      <main className={styles.state}>
        <h1>Não foi possível verificar sua sessão</h1>
        <p>Confira sua conexão e tente novamente.</p>
        <button onClick={() => void reload()} type="button">
          Tentar novamente
        </button>
      </main>
    );
  }

  return (
    <AuthSessionContext.Provider value={{ reload, user }}>
      {children}
    </AuthSessionContext.Provider>
  );
}

export function useAuthSession(): AuthSession {
  const session = useContext(AuthSessionContext);
  if (!session) throw new Error("useAuthSession must be used inside AuthSessionProvider");
  return session;
}
