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
import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { useMarketplace } from "@/modules/marketplace/useMarketplace";
import {
  marketplacePath,
  type PublishedSession,
} from "@/modules/marketplace/marketplace.api";
import { formatCents } from "@/modules/marketplace/marketplace.types";
import styles from "./page.module.css";

const PAGE_SIZE = 20;

export default function SessoesPage() {
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("");
  const [offset, setOffset] = useState(0);

  const params = new URLSearchParams({
    topic: query,
    limit: String(PAGE_SIZE),
    offset: String(offset),
  });
  if (subject) params.set("subject_id", subject);

  const {
    data: sessions = [],
    error,
    loading,
    refresh,
  } = useMarketplace<PublishedSession[]>(
    `${marketplacePath}/sessions?${params}`,
  );
  const { data: subjects = [] } = useMarketplace<{ id: string; name: string }[]>(
    "/v1/academic/subjects?limit=100",
  );

  const hasFilters = Boolean(query.trim() || subject);

  function clearFilters() {
    setQuery("");
    setSubject("");
    setOffset(0);
  }

  return (
    <div className={styles.page}>
      <PageHeader
        actions={
          <nav aria-label="Navegação de tutorias" className={styles.localNav}>
            <span aria-current="page">Explorar</span>
            <Link href="/sessoes/minhas">Minhas tutorias</Link>
          </nav>
        }
        description="Encontre apoio para as disciplinas que você está estudando e reserve uma vaga com um tutor da comunidade."
        eyebrow="Tutorias"
        title="Encontre a tutoria certa para você"
      />

      <div className={styles.demoNotice} role="note">
        <Storefront aria-hidden size={18} />
        <span>
          <strong>Ambiente demonstrativo.</strong> Nenhuma cobrança real será realizada.
        </span>
      </div>

      <section aria-label="Filtros de tutorias" className={styles.filters}>
        <label className={styles.searchField} htmlFor="session-search">
          <MagnifyingGlass aria-hidden size={20} />
          <span className="sr-only">Buscar tutoria por assunto</span>
          <input
            id="session-search"
            placeholder="Buscar por assunto..."
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOffset(0);
            }}
          />
        </label>

        <label className={styles.selectField}>
          <span>Disciplina</span>
          <select
            value={subject}
            onChange={(event) => {
              setSubject(event.target.value);
              setOffset(0);
            }}
          >
            <option value="">Todas as disciplinas</option>
            {subjects.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        {hasFilters ? (
          <Button onClick={clearFilters} size="sm" type="button" variant="ghost">
            Limpar filtros
          </Button>
        ) : null}
      </section>

      {loading ? (
        <div aria-label="Carregando tutorias" className={styles.sessionGrid} role="status">
          <span className="sr-only">Carregando tutorias...</span>
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} variant="card" />
          ))}
        </div>
      ) : error ? (
        <Card className={styles.stateCard}>
          <Storefront aria-hidden size={32} />
          <div>
            <h2>Não foi possível carregar as tutorias</h2>
            <p>{error}</p>
          </div>
          <Button onClick={refresh} size="sm" type="button" variant="secondary">
            Tentar novamente
          </Button>
        </Card>
      ) : sessions.length === 0 ? (
        <Card className={styles.stateCard}>
          <Storefront aria-hidden size={36} />
          <div>
            <h2>Nenhuma tutoria encontrada</h2>
            <p>
              {hasFilters
                ? "Tente ajustar os filtros para encontrar outras opções."
                : "Ainda não há tutorias publicadas para este contexto."}
            </p>
          </div>
          {hasFilters ? (
            <Button onClick={clearFilters} size="sm" type="button" variant="secondary">
              Limpar filtros
            </Button>
          ) : null}
        </Card>
      ) : (
        <ul className={styles.sessionGrid} aria-label="Tutorias disponíveis">
          {sessions.map((session) => {
            const isFull = session.available_seats <= 0;
            const hasFewSeats = !isFull && session.available_seats <= 3;
            const starts = new Date(session.starts_at);

            return (
              <li key={session.id}>
                <Card className={styles.sessionCard} interactive>
                  <div className={styles.cardTop}>
                    <Badge variant="success">{session.subject_name}</Badge>
                    {isFull ? (
                      <Badge variant="danger">Lotada</Badge>
                    ) : hasFewSeats ? (
                      <Badge variant="warning">Poucas vagas</Badge>
                    ) : (
                      <Badge>{session.available_seats} vagas</Badge>
                    )}
                  </div>

                  <div className={styles.cardCopy}>
                    <h2>{session.title}</h2>
                    <p className={styles.tutor}>com {session.tutor_name}</p>
                    {session.description ? (
                      <p className={styles.description}>{session.description}</p>
                    ) : null}
                  </div>

                  <dl className={styles.facts}>
                    <div>
                      <dt>
                        <CalendarBlank aria-hidden size={16} />
                        Quando
                      </dt>
                      <dd>
                        {starts.toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                        })}
                        {" · "}
                        {starts.toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </dd>
                    </div>
                    <div>
                      <dt>
                        {session.modality === "online" ? (
                          <Video aria-hidden size={16} />
                        ) : (
                          <MapPin aria-hidden size={16} />
                        )}
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
                        <UsersThree aria-hidden size={16} />
                        Vagas
                      </dt>
                      <dd>
                        {session.available_seats} de {session.capacity} disponíveis
                      </dd>
                    </div>
                  </dl>

                  <div className={styles.cardFooter}>
                    <p className={styles.price}>
                      <span>A partir de</span>
                      <strong>{formatCents(session.price_cents, session.currency)}</strong>
                    </p>
                    {isFull ? (
                      <span aria-disabled="true" className={styles.disabledAction}>
                        Vagas esgotadas
                      </span>
                    ) : (
                      <Link className={styles.primaryAction} href={`/sessoes/${session.id}`}>
                        Ver tutoria
                      </Link>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {!loading && !error && sessions.length > 0 ? (
        <nav aria-label="Paginação das tutorias" className={styles.pagination}>
          <Button
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            size="sm"
            type="button"
            variant="secondary"
          >
            Anterior
          </Button>
          <span>Página {Math.floor(offset / PAGE_SIZE) + 1}</span>
          <Button
            disabled={sessions.length < PAGE_SIZE}
            onClick={() => setOffset(offset + PAGE_SIZE)}
            size="sm"
            type="button"
            variant="secondary"
          >
            Próxima
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
