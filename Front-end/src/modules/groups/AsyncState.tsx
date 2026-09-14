"use client";
import Link from "next/link";
import { ApiError } from "@/lib/api";
import { errorMessage } from "./api";
import s from "./AcademicCommunity.module.css";

export function Failure({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <div role="alert" className={s.error}>
      {errorMessage(error)}
      <div className={s.actions}>
        {error instanceof ApiError && error.status === 401 ? (
          <Link className={s.primary} href="/login">
            Entrar novamente
          </Link>
        ) : retry ? (
          <button type="button" className={s.secondary} onClick={retry}>
            Tentar novamente
          </button>
        ) : null}
      </div>
    </div>
  );
}
export function Loading() {
  return (
    <div className={s.state} role="status" aria-busy="true">
      Carregando dados…
    </div>
  );
}
