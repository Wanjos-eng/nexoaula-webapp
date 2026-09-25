"use client";

import { CheckCircle, WarningCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { ApiError, NetworkError, RequestAbortedError, TimeoutError } from "@/lib/api";
import { authService } from "../services/auth.service";
import { validateLoginForm, type LoginFormErrors } from "../schemas/authSchemas";

import styles from "./AuthForm.module.css";

type BannerState = {
  type: "success" | "error";
  message: string;
} | null;

export function LoginForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<LoginFormErrors>({});
  const [banner, setBanner] = useState<BannerState>(null);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const submissionRef = useRef(false);
  const navTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortRef.current?.abort();
      abortRef.current = null;
      if (navTimeoutRef.current) {
        clearTimeout(navTimeoutRef.current);
        navTimeoutRef.current = null;
      }
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionRef.current || isLoading) return;

    setBanner(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    const validation = validateLoginForm(data);
    setErrors(validation.errors);

    if (!validation.isValid && validation.firstErrorField) {
      form.querySelector<HTMLElement>(`[name="${validation.firstErrorField}"]`)?.focus();
      return;
    }

    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const controller = new AbortController();

    submissionRef.current = true;
    abortRef.current = controller;
    setIsLoading(true);

    try {
      await authService.login({ email, password }, controller.signal);
      if (!isMountedRef.current) return;

      setBanner({
        type: "success",
        message: "Acesso confirmado. Abrindo seu painel acadêmico...",
      });

      navTimeoutRef.current = setTimeout(() => {
        router.replace("/inicio");
      }, 450);
    } catch (error) {
      if (!isMountedRef.current || error instanceof RequestAbortedError) return;
      setIsLoading(false);

      if (error instanceof ApiError && error.status === 401) {
        setBanner({ type: "error", message: "E-mail ou senha incorretos." });
      } else if (error instanceof ApiError && error.status === 403) {
        setBanner({
          type: "error",
          message: "Não foi possível validar esta solicitação. Atualize a página e tente novamente.",
        });
      } else if (error instanceof ApiError && error.status === 503) {
        setBanner({
          type: "error",
          message: "O acesso está temporariamente indisponível. Tente novamente mais tarde.",
        });
      } else if (error instanceof NetworkError || error instanceof TimeoutError) {
        setBanner({
          type: "error",
          message: "Erro de conexão. Verifique sua internet e tente novamente.",
        });
      } else {
        setBanner({
          type: "error",
          message: "Ocorreu um erro inesperado. Tente novamente mais tarde.",
        });
      }
    } finally {
      submissionRef.current = false;
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  return (
    <div>
      <div className={styles.header}>
        <h2>Acesse sua conta</h2>
        <p>Entre para acompanhar sua rotina acadêmica e suas comunidades.</p>
      </div>

      {banner ? (
        <div
          aria-live="polite"
          className={`${styles.banner} ${
            banner.type === "success" ? styles.bannerSuccess : styles.bannerError
          }`}
          role="status"
        >
          {banner.type === "success" ? (
            <CheckCircle aria-hidden size={20} />
          ) : (
            <WarningCircle aria-hidden size={20} />
          )}
          <span>{banner.message}</span>
        </div>
      ) : null}

      <form className={styles.form} noValidate onSubmit={handleSubmit}>
        <Field
          autoComplete="email"
          disabled={isLoading}
          error={errors.email}
          id="email"
          label="E-mail"
          name="email"
          placeholder="seuemail@exemplo.com"
          required
          type="email"
        />

        <Field
          autoComplete="current-password"
          disabled={isLoading}
          error={errors.password}
          id="password"
          label="Senha"
          name="password"
          placeholder="Digite sua senha"
          required
          type="password"
        />

        <div className={styles.actionsRow}>
          <span>Sua sessão será iniciada com segurança.</span>
        </div>

        <Button fullWidth loading={isLoading} type="submit">
          Entrar
        </Button>
      </form>

      <p className={styles.switchAuth}>
        Ainda não tem uma conta? <Link href="/cadastro">Criar conta</Link>
      </p>
    </div>
  );
}
