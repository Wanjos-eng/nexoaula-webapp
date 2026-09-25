"use client";

import { CaretRight, List } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { RefObject } from "react";

import styles from "./AppShell.module.css";

type TopbarProps = {
  menuButtonRef: RefObject<HTMLButtonElement | null>;
  onMenuOpen: () => void;
};

type Crumb = {
  href?: string;
  label: string;
};

function breadcrumbs(pathname: string): Crumb[] {
  if (pathname === "/inicio") return [{ label: "Início" }];
  if (pathname === "/disciplinas") return [{ label: "Minhas Disciplinas" }];
  if (pathname.startsWith("/disciplinas/")) {
    return [
      { href: "/disciplinas", label: "Minhas Disciplinas" },
      { label: "Disciplina" },
    ];
  }
  if (pathname === "/grupos") return [{ label: "Comunidades" }];
  if (pathname === "/grupos/novo") {
    return [
      { href: "/grupos", label: "Comunidades" },
      { label: "Nova comunidade" },
    ];
  }
  if (pathname.startsWith("/grupos/")) {
    return [
      { href: "/grupos", label: "Comunidades" },
      { label: "Comunidade" },
    ];
  }
  if (pathname === "/calendario") return [{ label: "Calendário" }];
  if (pathname === "/sessoes") return [{ label: "Tutorias" }];
  if (pathname === "/sessoes/minhas") {
    return [
      { href: "/sessoes", label: "Tutorias" },
      { label: "Minhas tutorias" },
    ];
  }
  if (pathname.startsWith("/sessoes/")) {
    return [
      { href: "/sessoes", label: "Tutorias" },
      { label: "Detalhes" },
    ];
  }
  if (pathname === "/tutor") return [{ label: "Área do Tutor" }];
  if (pathname.startsWith("/tutor/")) {
    return [
      { href: "/tutor", label: "Área do Tutor" },
      { label: "Nova tutoria" },
    ];
  }
  if (pathname === "/progresso") return [{ label: "Meu Progresso" }];
  if (pathname === "/perfil") return [{ label: "Meu Perfil" }];
  return [{ label: "nexoAula" }];
}

export function Topbar({ menuButtonRef, onMenuOpen }: TopbarProps) {
  const pathname = usePathname();
  const crumbs = breadcrumbs(pathname);

  return (
    <header className={styles.topbar}>
      <div className={styles.titleArea}>
        <button
          aria-controls="navegacao-principal"
          aria-label="Abrir menu de navegação"
          className={styles.menuButton}
          onClick={onMenuOpen}
          ref={menuButtonRef}
          type="button"
        >
          <List aria-hidden size={22} />
        </button>

        <nav aria-label="Contexto da página" className={styles.breadcrumbs}>
          {crumbs.map((crumb, index) => (
            <span
              className={styles.breadcrumbItem}
              key={`${crumb.label}-${index}`}
            >
              {index > 0 ? <CaretRight aria-hidden size={14} /> : null}
              {crumb.href ? (
                <Link href={crumb.href}>{crumb.label}</Link>
              ) : (
                <strong>{crumb.label}</strong>
              )}
            </span>
          ))}
        </nav>
      </div>
    </header>
  );
}
