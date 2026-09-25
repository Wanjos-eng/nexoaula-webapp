import type { HTMLAttributes, ReactNode } from "react";

import styles from "./Badge.module.css";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  variant?: "neutral" | "success" | "warning" | "danger" | "info";
};

export function Badge({
  children,
  className = "",
  variant = "neutral",
  ...props
}: BadgeProps) {
  return (
    <span className={[styles.badge, styles[variant], className].filter(Boolean).join(" ")} {...props}>
      {children}
    </span>
  );
}
