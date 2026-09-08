"use client";

import { CheckCircle, Info, WarningCircle } from "@phosphor-icons/react";
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
  type: "success" | "error" | "info";
  message: string;
} | null;

export function RegisterForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<RegisterFormErrors>({});
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
    if (submissionRef.current) return;
    setBanner(null);

    if (isLoading) return;

    const form = event.currentTarget;
    const data = new FormData(form);

    const validation = validateRegisterForm(data);
    setErrors(validation.errors);

    if (!validation.isValid && validation.firstErrorField) {
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
      await authService.register({ fullName, email, password }, controller.signal);
      if (!isMountedRef.current) return;

      setIsLoading(false);
      setBanner({
        type: "success",
        message: "Conta criada com sucesso! Redirecionando para login...",
      });

      // Atrasa a navegação para que o banner de sucesso seja perceptível
      navTimeoutRef.current = setTimeout(() => {
        router.push("/login");
      }, 1500);
    } catch (error) {
      if (!isMountedRef.current || error instanceof RequestAbortedError) return;
      setIsLoading(false);

      if (error instanceof ApiError) {
        if (error.status === 409) {
          setBanner({
            type: "error",
            message: "Este e-mail já está em uso.",
          });
          setErrors((prev) => ({ ...prev, email: "Este e-mail já está em uso." }));
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
        <p>Preencha seus dados para começar a usar o nexoAula.</p>
      </div>

      {banner ? (
        <div
          aria-live="polite"
          className={`${styles.banner} ${banner.type === "success"
            ? styles.bannerSuccess
            : banner.type === "error"
              ? styles.bannerError
              : styles.bannerInfo
            }`}
          role="status"
        >
          {banner.type === "success" && <CheckCircle aria-hidden size={20} />}
          {banner.type === "error" && <WarningCircle aria-hidden size={20} />}
          {banner.type === "info" && <Info aria-hidden size={20} />}
          <span>{banner.message}</span>
        </div>
      ) : null}

      <form className={styles.form} noValidate onSubmit={handleSubmit}>
        <Field
          autoComplete="name"
          disabled={isLoading}
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
          disabled={isLoading}
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
          disabled={isLoading}
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
          disabled={isLoading}
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
              disabled={isLoading}
              name="terms"
              type="checkbox"
            />
            <span>
              Li e concordo com os <a href="#termos">Termos de Uso</a> e a{" "}
              <a href="#termos">Política de Privacidade</a>.
            </span>
          </label>
          {errors.terms ? (
            <p className={styles.error} id="terms-error">
              {errors.terms}
            </p>
          ) : null}
        </div>

        <Button disabled={isLoading} fullWidth type="submit">
          {isLoading ? "Criando conta..." : "Criar conta"}
        </Button>
      </form>

      <p className={styles.switchAuth}>
        Já possui uma conta? <Link href="/login">Entrar</Link>
      </p>
    </div>
  );
}
