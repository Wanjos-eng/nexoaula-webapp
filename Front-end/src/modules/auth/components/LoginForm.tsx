"use client";

import { CheckCircle, Info, WarningCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { validateLoginForm, type LoginFormErrors } from "../schemas/authSchemas";

import styles from "./AuthForm.module.css";

const DEMO_ERROR_EMAIL = "erro@demo.com";

type BannerState = {
  type: "success" | "error" | "info";
  message: string;
} | null;

export function LoginForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<LoginFormErrors>({});
  const [banner, setBanner] = useState<BannerState>(null);
  const [isLoading, setIsLoading] = useState(false);
  const hasSimulatedError = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (navTimeoutRef.current) {
        clearTimeout(navTimeoutRef.current);
        navTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (timeoutRef.current !== null) return;
    setBanner(null);

    if (isLoading) return;

    const form = event.currentTarget;
    const data = new FormData(form);

    const validation = validateLoginForm(data);
    setErrors(validation.errors);

    if (!validation.isValid && validation.firstErrorField) {
      form.querySelector<HTMLElement>(`[name="${validation.firstErrorField}"]`)?.focus();
      return;
    }

    const email = String(data.get("email") ?? "").trim();

    if (email === DEMO_ERROR_EMAIL && !hasSimulatedError.current) {
      hasSimulatedError.current = true;
      setIsLoading(true);
      setBanner(null);

      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        setIsLoading(false);
        setBanner({
          type: "error",
          message: "Falha simulada na conexão. Tente novamente.",
        });
      }, 600);
      return;
    }

    setIsLoading(true);

    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      setIsLoading(false);
      setBanner({
        type: "success",
        message: "Acesso demonstrativo confirmado. Redirecionando para o painel acadêmico...",
      });

      navTimeoutRef.current = setTimeout(() => {
        router.push("/inicio");
      }, 1500);
    }, 600);
  }

  function handleForgotPassword() {
    setBanner({
      type: "info",
      message: "Recuperação de senha: a funcionalidade será integrada ao backend em uma etapa futura.",
    });
  }

  return (
    <div>
      <div className={styles.header}>
        <span className={styles.demoBadge}>Ambiente de demonstração</span>
        <h2>Acesse sua conta</h2>
        <p>Entre para acompanhar suas disciplinas, aulas e grupos de estudo.</p>
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
          <label className={styles.checkboxLabel}>
            <input disabled={isLoading} name="remember" type="checkbox" />
            <span>Manter-me conectado</span>
          </label>
          <button
            className={styles.textButton}
            disabled={isLoading}
            onClick={handleForgotPassword}
            type="button"
          >
            Esqueci minha senha
          </button>
        </div>

        <Button disabled={isLoading} fullWidth type="submit">
          {isLoading ? "Entrando..." : "Entrar"}
        </Button>
      </form>

      <p className={styles.switchAuth}>
        Ainda não tem uma conta? <Link href="/cadastro">Criar conta</Link>
      </p>
    </div>
  );
}

