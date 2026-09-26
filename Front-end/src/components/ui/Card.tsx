import type { HTMLAttributes, ReactNode } from "react";

import styles from "./Card.module.css";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  interactive?: boolean;
  variant?: "default" | "subtle";
};

export function Card({
  children,
  className = "",
  interactive = false,
  variant = "default",
  ...props
}: CardProps) {
  const classes = [
    styles.card,
    styles[variant],
    interactive ? styles.interactive : "",
    className,
  ].filter(Boolean).join(" ");

  return <div className={classes} {...props}>{children}</div>;
}
