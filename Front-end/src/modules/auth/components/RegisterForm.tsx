"use client";

import { CheckCircle, Info, WarningCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { validateRegisterForm, type RegisterFormErrors } from "../schemas/authSchemas";

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

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

    setIsLoading(true);
    setBanner(null);

    // Simulação de submissão assíncrona com feedback visual
    setTimeout(() => {
      setIsLoading(false);
      setBanner({
        type: "success",
        message: "Conta demonstrativa criada com sucesso! Redirecionando para o painel...",
      });
      router.push("/inicio");
    }, 600);
  }

  return (
    <div>
      <div className={styles.header}>
        <span className={styles.demoBadge}>Ambiente de demonstração</span>
        <h2>Crie sua conta</h2>
        <p>Preencha seus dados para começar a usar o nexoAula.</p>
      </div>

      {banner ? (
        <div
          aria-live="polite"
          className={`${styles.banner} ${
            banner.type === "success"
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
