"use client";

import { ArrowLeft } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

import { Button } from "./Button";

type BackButtonProps = {
  children?: ReactNode;
  fallback: string;
};

export function BackButton({ children = "Voltar", fallback }: BackButtonProps) {
  const router = useRouter();

  function goBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallback);
  }

  return (
    <Button
      icon={<ArrowLeft aria-hidden size={18} />}
      onClick={goBack}
      size="sm"
      type="button"
      variant="ghost"
    >
      {children}
    </Button>
  );
}
