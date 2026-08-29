"use client";

import { Bell, List, MagnifyingGlass, UserPlus } from "@phosphor-icons/react";
import type { FormEvent, RefObject } from "react";
import { useState } from "react";
import Link from "next/link";

import styles from "./AppShell.module.css";

type TopbarProps = {
  menuButtonRef: RefObject<HTMLButtonElement | null>;
  onMenuOpen: () => void;
};

export function Topbar({ menuButtonRef, onMenuOpen }: TopbarProps) {
  const [feedback, setFeedback] = useState("");

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
            <h1>Olá, Lucas</h1>
            <span>Dados simulados</span>
          </div>
          <p>Acompanhe suas disciplinas e próximos encontros</p>
        </div>
      </div>

      <div className={styles.topbarActions}>
        <form className={styles.search} onSubmit={handleSearch} role="search">
          <label className="sr-only" htmlFor="dashboard-search">
            Buscar no nexoAula
          </label>
          <MagnifyingGlass aria-hidden size={20} />
          <input
            id="dashboard-search"
            name="search"
            placeholder="Buscar no nexoAula..."
            type="search"
          />
        </form>
        <button
          aria-label="Ver notificações"
          className={styles.iconButton}
          onClick={() => setFeedback("Você não tem novas notificações nesta demonstração.")}
          type="button"
        >
          <Bell aria-hidden size={21} />
        </button>
        <Link
          aria-label="Criar grupo"
          className={styles.createGroupButton}
          href="/grupos/novo"
        >
          <UserPlus aria-hidden size={18} weight="bold" />
          <span>Criar grupo</span>
        </Link>
      </div>
      <p aria-live="polite" className={styles.topbarFeedback} role="status">
        {feedback}
      </p>
    </header>
  );
}
