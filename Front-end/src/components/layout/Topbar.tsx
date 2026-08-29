"use client";

import { Bell, List, MagnifyingGlass, UserPlus, X } from "@phosphor-icons/react";
import type { FormEvent, RefObject } from "react";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "./AppShell.module.css";

type TopbarProps = {
  menuButtonRef: RefObject<HTMLButtonElement | null>;
  onMenuOpen: () => void;
};

export function Topbar({ menuButtonRef, onMenuOpen }: TopbarProps) {
  const [feedback, setFeedback] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === "/inicio";
  const canCreateGroup = pathname === "/inicio" || pathname === "/grupos";
  const pageContext = isHome
    ? { title: "Olá, Lucas", subtitle: "Acompanhe suas disciplinas e próximos encontros" }
    : pathname.startsWith("/grupos")
      ? { title: "Área de grupos", subtitle: "Comunidade acadêmica e colaboração" }
      : { title: "Área acadêmica", subtitle: "Organize sua rotina de estudos" };

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = new FormData(event.currentTarget).get("search");
    setFeedback(
      query
        ? `Busca simulada por “${String(query)}”.`
        : "Digite um termo para buscar no protótipo.",
    );
  }

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
          <List aria-hidden size={24} />
        </button>
        <div>
          <div className={styles.greetingLine}>
            <h1>{pageContext.title}</h1>
            {isHome ? <span>Dados simulados</span> : null}
          </div>
          <p>{pageContext.subtitle}</p>
        </div>
      </div>

      <div className={styles.topbarActions}>
        {isSearchOpen ? (
          <form className={styles.search} onSubmit={handleSearch} role="search">
            <label className="sr-only" htmlFor="dashboard-search">
              Buscar no nexoAula
            </label>
            <MagnifyingGlass aria-hidden size={20} />
            <input
              autoFocus
              id="dashboard-search"
              name="search"
              placeholder="Buscar no nexoAula..."
              type="search"
            />
            <button aria-label="Fechar busca" className={styles.searchClose} onClick={() => setIsSearchOpen(false)} type="button">
              <X aria-hidden size={16} />
            </button>
          </form>
        ) : (
          <button aria-expanded={isSearchOpen} aria-label="Abrir busca global" className={styles.searchTrigger} onClick={() => setIsSearchOpen(true)} type="button">
            <MagnifyingGlass aria-hidden size={18} />
            <span>Buscar</span>
            <kbd>⌘ K</kbd>
          </button>
        )}
        <button
          aria-label="Ver notificações"
          className={styles.iconButton}
          onClick={() => setFeedback("Você não tem novas notificações nesta demonstração.")}
          type="button"
        >
          <Bell aria-hidden size={21} />
        </button>
        {canCreateGroup ? (
          <Link
            aria-label="Criar grupo"
            className={styles.createGroupButton}
            href="/grupos/novo"
          >
            <UserPlus aria-hidden size={18} weight="bold" />
            <span>Criar grupo</span>
          </Link>
        ) : null}
      </div>
      <p aria-live="polite" className={styles.topbarFeedback} role="status">
        {feedback}
      </p>
    </header>
  );
}
