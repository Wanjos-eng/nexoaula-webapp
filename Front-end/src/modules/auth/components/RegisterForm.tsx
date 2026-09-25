"use client";

import { WarningCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { ApiError, NetworkError, RequestAbortedError, TimeoutError } from "@/lib/api";
import { validateRegisterForm, type RegisterFormErrors } from "../schemas/authSchemas";
import { authService } from "../services/auth.service";

import styles from "./AuthForm.module.css";

type BannerState = {
  type: "error";
  message: string;
} | null;

export function RegisterForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<RegisterFormErrors>({});
  const [banner, setBanner] = useState<BannerState>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  const registeredCredentials = useRef<{ email: string; password: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const submissionRef = useRef(false);


  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionRef.current || isLoading) return;

    setBanner(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    const validation = validateRegisterForm(data);
    setErrors(accountCreated ? {} : validation.errors);

    if (!accountCreated && !validation.isValid && validation.firstErrorField) {
      if (validation.firstErrorField === "terms") {
        form.querySelector<HTMLElement>('input[name="terms"]')?.focus();
      } else {
        form.querySelector<HTMLElement>(`[name="${validation.firstErrorField}"]`)?.focus();
      }
      return;
    }

    const fullName = String(data.get("fullName") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const controller = new AbortController();

    submissionRef.current = true;
    abortRef.current = controller;
    setIsLoading(true);

    try {
      if (!registeredCredentials.current) {
        await authService.register({ fullName, email, password }, controller.signal);
        if (!isMountedRef.current) return;
        registeredCredentials.current = { email, password };
        setAccountCreated(true);
      }
      await authService.login(registeredCredentials.current, controller.signal);
      if (!isMountedRef.current) return;

      router.replace("/inicio");
    } catch (error) {
      if (!isMountedRef.current || error instanceof RequestAbortedError) return;
      setIsLoading(false);

      if (registeredCredentials.current) {
        setBanner({ type: "error", message: "Sua conta foi criada, mas não conseguimos iniciar a sessão. Tente entrar novamente." });
        return;
      }

      if (error instanceof ApiError) {
        if (error.status === 409) {
          setBanner({ type: "error", message: "Este e-mail já está em uso." });
          setErrors((previous) => ({ ...previous, email: "Este e-mail já está em uso." }));
          form.querySelector<HTMLElement>('[name="email"]')?.focus();
          return;
        }

        if (error.status === 422) {
          setBanner({
            type: "error",
            message: "Os dados enviados são inválidos. Verifique os campos.",
          });
          return;
        }

        if (error.status === 503) {
          setBanner({
            type: "error",
            message: "O cadastro está temporariamente indisponível. Tente novamente mais tarde.",
          });
          return;
        }
      }

      if (error instanceof NetworkError || error instanceof TimeoutError) {
        setBanner({
          type: "error",
          message: "Falha na conexão. Verifique sua internet e tente novamente.",
        });
        return;
      }

      setBanner({
        type: "error",
        message: "Ocorreu um erro inesperado. Tente novamente mais tarde.",
      });
    } finally {
      submissionRef.current = false;
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  return (
    <div>
      <div className={styles.header}>
        <h2>Crie sua conta</h2>
        <p>Comece a organizar sua rotina acadêmica em poucos passos.</p>
      </div>

      {banner ? (
        <div
          aria-live="polite"
          className={`${styles.banner} ${styles.bannerError}`}
          role="alert"
        >
          <WarningCircle aria-hidden size={20} />
          <span>{banner.message}</span>
        </div>
      ) : null}

      <form className={styles.form} noValidate onSubmit={handleSubmit}>
        <Field
          autoComplete="name"
          disabled={isLoading || accountCreated}
          error={errors.fullName}
          id="fullName"
          label="Nome completo"
          maxLength={120}
          name="fullName"
          placeholder="Digite seu nome completo"
          required
          type="text"
        />

        <Field
          autoComplete="email"
          disabled={isLoading || accountCreated}
          error={errors.email}
          id="email"
          label="E-mail"
          maxLength={320}
          name="email"
          placeholder="seuemail@exemplo.com"
          required
          type="email"
        />

        <Field
          autoComplete="new-password"
          disabled={isLoading || accountCreated}
          error={errors.password}
          hint="Use pelo menos 8 caracteres."
          id="password"
          label="Senha"
          maxLength={72}
          minLength={8}
          name="password"
          placeholder="Crie uma senha"
          required
          type="password"
        />

        <Field
          autoComplete="new-password"
          disabled={isLoading || accountCreated}
          error={errors.confirmPassword}
          id="confirmPassword"
          label="Confirmar senha"
          name="confirmPassword"
          placeholder="Digite a senha novamente"
          required
          type="password"
        />

        <div className={styles.terms} id="termos">
          <label className={styles.checkboxLabel}>
            <input
              aria-describedby={errors.terms ? "terms-error" : undefined}
              disabled={isLoading || accountCreated}
              name="terms"
              type="checkbox"
            />
            <span>
              Li e concordo com os termos de uso e a política de privacidade do ambiente.
            </span>
          </label>
          {errors.terms ? (
            <p className={styles.error} id="terms-error">
              {errors.terms}
            </p>
          ) : null}
        </div>

        <Button fullWidth loading={isLoading} type="submit">
          {isLoading ? (accountCreated ? "Entrando…" : "Criando conta…") : accountCreated ? "Tentar entrar novamente" : "Criar conta"}
        </Button>
      </form>

      <p className={styles.switchAuth}>
        Já possui uma conta? <Link href="/login">Entrar</Link>
      </p>
    </div>
  );
}
