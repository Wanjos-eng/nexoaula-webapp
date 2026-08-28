"use client";

import { Eye, EyeSlash } from "@phosphor-icons/react";
import type { InputHTMLAttributes } from "react";
import { useState } from "react";

import styles from "./Field.module.css";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
  hint?: string;
  label: string;
};

export function Field({ error, hint, id, label, type, ...props }: FieldProps) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const isPassword = type === "password";
  const descriptionId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <div className={styles.inputWrap}>
        <input
          aria-describedby={descriptionId}
          aria-invalid={Boolean(error)}
          className={styles.input}
          id={id}
          type={isPassword && isPasswordVisible ? "text" : type}
          {...props}
        />
        {isPassword ? (
          <button
            aria-label={isPasswordVisible ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={isPasswordVisible}
            className={styles.passwordToggle}
            onClick={() => setIsPasswordVisible((visible) => !visible)}
            type="button"
          >
            {isPasswordVisible ? <EyeSlash size={20} /> : <Eye size={20} />}
          </button>
        ) : null}
      </div>
      {error ? (
        <p className={styles.error} id={`${id}-error`}>
          {error}
        </p>
      ) : hint ? (
        <p className={styles.hint} id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
