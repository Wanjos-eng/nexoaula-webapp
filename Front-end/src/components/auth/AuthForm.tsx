"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

import styles from "./AuthForm.module.css";

type AuthFormProps = {
  mode: "login" | "signup";
};

type FormErrors = Partial<
  Record<"confirmPassword" | "email" | "fullName" | "password" | "terms", string>
>;

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [errors, setErrors] = useState<FormErrors>({});
  const [message, setMessage] = useState("");
  const isSignup = mode === "signup";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const data = new FormData(form);
    const nextErrors: FormErrors = {};
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");

    if (!email || !email.includes("@")) {
      nextErrors.email = "Informe um e-mail válido.";
    }

    if (password.length < (isSignup ? 8 : 1)) {
      nextErrors.password = isSignup
        ? "A senha deve ter pelo menos 8 caracteres."
        : "Informe sua senha.";
    }

    if (isSignup) {
      const fullName = String(data.get("fullName") ?? "").trim();
      const confirmPassword = String(data.get("confirmPassword") ?? "");

      if (fullName.length < 3) {
        nextErrors.fullName = "Informe seu nome completo.";
      }
      if (password !== confirmPassword) {
        nextErrors.confirmPassword = "As senhas precisam ser iguais.";
      }
      if (data.get("terms") !== "on") {
        nextErrors.terms = "Aceite os termos para continuar na demonstração.";
      }
    }

    setErrors(nextErrors);

    const firstError = Object.keys(nextErrors)[0];
    if (firstError) {
      form.querySelector<HTMLElement>(`[name="${firstError}"]`)?.focus();
      return;
    }

    setMessage(
      isSignup
        ? "Conta simulada criada. Abrindo o início…"
        : "Acesso simulado confirmado. Abrindo o início…",
    );
    router.push("/inicio");
  }

  return (
    <div>
      <div className={styles.header}>
        <span className={styles.demoBadge}>Ambiente de demonstração</span>
        <h2>{isSignup ? "Crie sua conta" : "Acesse sua conta"}</h2>
        <p>
          {isSignup
            ? "Preencha seus dados para começar a usar o nexoAula."
            : "Entre para acompanhar suas disciplinas, aulas e grupos de estudo."}
        </p>
      </div>

      <form className={styles.form} noValidate onSubmit={handleSubmit}>
        {isSignup ? (
          <Field
            autoComplete="name"
            error={errors.fullName}
            id="fullName"
            label="Nome completo"
            name="fullName"
            placeholder="Digite seu nome completo"
            required
            type="text"
          />
        ) : null}

        <Field
          autoComplete="email"
          error={errors.email}
          id="email"
          label="E-mail"
          name="email"
          placeholder="seuemail@exemplo.com"
          required
          type="email"
        />

        <Field
          autoComplete={isSignup ? "new-password" : "current-password"}
          error={errors.password}
          hint={isSignup ? "Use pelo menos 8 caracteres." : undefined}
          id="password"
          label="Senha"
          minLength={isSignup ? 8 : undefined}
          name="password"
          placeholder={isSignup ? "Crie uma senha" : "Digite sua senha"}
          required
          type="password"
        />

        {isSignup ? (
          <Field
            autoComplete="new-password"
            error={errors.confirmPassword}
            id="confirmPassword"
            label="Confirmar senha"
            name="confirmPassword"
            placeholder="Digite a senha novamente"
            required
            type="password"
          />
        ) : (
          <div className={styles.actionsRow}>
            <label className={styles.checkboxLabel}>
              <input name="remember" type="checkbox" />
              <span>Manter-me conectado</span>
            </label>
            <button
              className={styles.textButton}
              onClick={() =>
                setMessage(
                  "A recuperação de senha será conectada ao backend em uma etapa futura.",
                )
              }
              type="button"
            >
              Esqueci minha senha
            </button>
          </div>
        )}

        {isSignup ? (
          <div className={styles.terms} id="termos">
            <label className={styles.checkboxLabel}>
              <input aria-describedby="terms-error" name="terms" type="checkbox" />
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
        ) : null}

        <Button fullWidth type="submit">
          {isSignup ? "Criar conta" : "Entrar"}
        </Button>

        <p aria-live="polite" className={styles.message} role="status">
          {message}
        </p>
      </form>

      <p className={styles.switchAuth}>
        {isSignup ? "Já possui uma conta?" : "Ainda não tem uma conta?"}{" "}
        <Link href={isSignup ? "/login" : "/cadastro"}>
          {isSignup ? "Entrar" : "Criar conta"}
        </Link>
      </p>
    </div>
  );
}
