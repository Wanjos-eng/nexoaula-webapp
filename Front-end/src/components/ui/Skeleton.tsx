import type { HTMLAttributes } from "react";

import styles from "./Skeleton.module.css";

type SkeletonProps = HTMLAttributes<HTMLDivElement> & {
  variant?: "text" | "title" | "card" | "row" | "avatar";
};

export function Skeleton({
  className = "",
  variant = "text",
  ...props
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={[styles.skeleton, styles[variant], className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}
