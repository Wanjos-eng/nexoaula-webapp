"use client";

import {
  CalendarBlank,
  MagnifyingGlass,
  MapPin,
  Storefront,
  UsersThree,
  Video,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { mockSessions } from "@/modules/marketplace/marketplace.mock";
import { formatCents } from "@/modules/marketplace/marketplace.types";
import styles from "./page.module.css";

export default function SessoesPage() {
  const [query, setQuery] = useState("");

  const sessions = useMemo(() => {
    if (!query.trim()) return mockSessions;
    const q = query.toLowerCase();
    return mockSessions.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.subject_name.toLowerCase().includes(q) ||
        s.tutor_name.toLowerCase().includes(q),
    );
  }, [query]);

  const scheduled = sessions.filter((s) => s.status === "scheduled");

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.eyebrow}>
          <Storefront aria-hidden size={18} weight="fill" />
          Sessões de Tutoria
        </div>
        <h1 className={styles.title}>Encontre uma sessão</h1>
        <p className={styles.subtitle}>
          Sessões publicadas por tutores da comunidade nexoAula. Inscreva-se e
          estude com quem já domina o conteúdo.
        </p>
        <div
          className={styles.simulationBanner}
          role="note"
          aria-label="Aviso de simulação acadêmica"
        >
          🎓 <strong>Demonstração acadêmica.</strong> Nenhum pagamento real
          será realizado. Os valores exibidos são apenas demonstrativos.
        </div>
      </header>

      <div className={styles.searchBar}>
        <label className={styles.searchLabel} htmlFor="session-search">
          <MagnifyingGlass aria-hidden size={20} />
          <span className="sr-only">Buscar sessão por título, disciplina ou tutor</span>
          <input
            id="session-search"
            className={styles.searchInput}
            placeholder="Buscar por título, disciplina ou tutor…"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>

      {scheduled.length === 0 ? (
        <div className={styles.empty}>
          <Storefront aria-hidden size={40} />
          <p>Nenhuma sessão encontrada para sua busca.</p>
        </div>
      ) : (
        <ul className={styles.sessionGrid} aria-label="Sessões disponíveis">
          {scheduled.map((session) => {
            const isFull = session.enrolled_count >= session.capacity;
            const starts = new Date(session.starts_at);
            return (
              <li key={session.id} className={styles.sessionCard}>
                <div className={styles.cardTop}>
                  <span className={styles.subject}>{session.subject_name}</span>
                  {isFull && (
                    <span className={styles.fullBadge} aria-label="Vagas esgotadas">
                      Lotada
                    </span>
                  )}
                </div>
                <h2 className={styles.sessionTitle}>{session.title}</h2>
                <p className={styles.tutor}>por {session.tutor_name}</p>
                {session.description && (
                  <p className={styles.description}>{session.description}</p>
                )}
                <dl className={styles.facts}>
                  <div>
                    <dt>
                      <CalendarBlank aria-hidden size={14} /> Data
                    </dt>
                    <dd>
                      {starts.toLocaleDateString("pt-BR", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </dd>
                  </div>
                  <div>
                    <dt>
                      {session.modality === "online" ? (
                        <Video aria-hidden size={14} />
                      ) : (
                        <MapPin aria-hidden size={14} />
                      )}{" "}
                      Formato
                    </dt>
                    <dd>
                      {session.modality === "online"
                        ? "Online"
                        : session.modality === "in_person"
                          ? "Presencial"
                          : "Híbrido"}
                    </dd>
                  </div>
                  <div>
                    <dt>
                      <UsersThree aria-hidden size={14} /> Vagas
                    </dt>
                    <dd>
                      {session.enrolled_count}/{session.capacity}
                    </dd>
                  </div>
                </dl>
                <div className={styles.cardFooter}>
                  <p className={styles.price}>
                    {formatCents(session.price_cents, session.currency)}{" "}
                    <small>(simulado)</small>
                  </p>
                  <Link
                    href={`/sessoes/${session.id}`}
                    className={isFull ? styles.disabledButton : styles.enrollButton}
                    aria-disabled={isFull}
                  >
                    {isFull ? "Vagas esgotadas" : "Ver detalhes"}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
