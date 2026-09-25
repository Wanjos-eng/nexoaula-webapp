import type { ButtonHTMLAttributes, ReactNode } from "react";

import styles from "./Button.module.css";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  fullWidth?: boolean;
  icon?: ReactNode;
  loading?: boolean;
  size?: "sm" | "md";
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export function Button({
  children,
  className = "",
  disabled,
  fullWidth = false,
  icon,
  loading = false,
  size = "md",
  variant = "primary",
  ...props
}: ButtonProps) {
  const classes = [
    styles.button,
    styles[variant],
    styles[size],
    fullWidth ? styles.fullWidth : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      aria-busy={loading || undefined}
      className={classes}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <span aria-hidden className={styles.spinner} /> : icon}
      <span>{children}</span>
    </button>
  );
}
