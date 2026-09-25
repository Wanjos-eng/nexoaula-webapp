"use client";

import { MagnifyingGlass, Plus, UsersThree } from "@phosphor-icons/react";
import Link from "next/link";
import { useCallback, useState, type FormEvent } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  errorMessage,
  read,
  PAGE_SIZE,
  entryLabels,
  type Group,
} from "./api";
import { AcademicFilters, emptyFilters } from "./AcademicFilters";
import { useRemote } from "./useRemote";
import styles from "./CommunityDirectory.module.css";

export function GroupDirectory({
  initialView = "mine",
}: {
  initialView?: "mine" | "discover";
}) {
  const [view, setView] = useState(initialView);
  const [offset, setOffset] = useState(0);
  const [filters, setFilters] = useState(emptyFilters);
  const [query, setQuery] = useState("");

  const path = `groups${view === "mine" ? "/mine" : ""}?limit=${PAGE_SIZE + 1}&offset=${offset}${
    view === "discover" && query ? `&${query}` : ""
  }`;

  const fetcher = useCallback(
    (signal: AbortSignal) => read<Group[]>(path, signal),
    [path],
  );
  const remote = useRemote(path, fetcher, true);

  function search(event: FormEvent) {
    event.preventDefault();
    setOffset(0);
    const params = new URLSearchParams(
      Object.entries(filters).filter(([, value]) => value.trim()),
    );
    setQuery(params.toString());
  }

  function clearFilters() {
    setFilters(emptyFilters);
    setQuery("");
    setOffset(0);
  }

  function switchView(next: "mine" | "discover") {
    setView(next);
    setOffset(0);
  }

  const visibleGroups = remote.data?.slice(0, PAGE_SIZE) ?? [];
  const hasMore = (remote.data?.length ?? 0) > PAGE_SIZE;

  return (
    <div className={styles.page}>
      <PageHeader
        actions={
          <Link className={styles.createLink} href="/grupos/novo">
            <Plus aria-hidden size={18} weight="bold" />
            Criar comunidade
          </Link>
        }
        description="Participe de espaços de estudo, acompanhe cronogramas e encontre pessoas estudando os mesmos assuntos."
        eyebrow="Comunidades"
        title="Estude com outras pessoas"
      />

      <div className={styles.tabs} role="tablist" aria-label="Visualização de comunidades">
        <button
          aria-selected={view === "mine"}
          className={view === "mine" ? styles.tabActive : ""}
          onClick={() => switchView("mine")}
          role="tab"
          type="button"
        >
          Minhas comunidades
        </button>
        <button
          aria-selected={view === "discover"}
          className={view === "discover" ? styles.tabActive : ""}
          onClick={() => switchView("discover")}
          role="tab"
          type="button"
        >
          Descobrir
        </button>
      </div>

      {view === "discover" ? (
        <Card className={styles.filterCard}>
          <form onSubmit={search} role="search" aria-label="Buscar comunidades">
            <div className={styles.filterHeading}>
              <div className={styles.filterIcon}>
                <MagnifyingGlass aria-hidden size={19} />
              </div>
              <div>
                <h2>Encontrar comunidades</h2>
                <p>Combine texto e referências acadêmicas para refinar a busca.</p>
              </div>
            </div>

            <div className={styles.textFilters}>
              {(
                [
                  ["topic", "Assunto ou nome", "Ex.: revisão para a prova"],
                  ["subject", "Disciplina", "Ex.: Cálculo"],
                  ["period", "Período", "Ex.: 2026.2"],
                ] as const
              ).map(([field, label, placeholder]) => (
                <label className={styles.field} key={field}>
                  <span>{label}</span>
                  <input
                    maxLength={field === "period" ? 80 : 200}
                    value={filters[field]}
                    placeholder={placeholder}
                    onChange={(event) =>
                      setFilters({
                        ...filters,
                        [field]: event.target.value,
                        ...(field === "subject"
                          ? {
                              subjectId: "",
                              classSectionId: "",
                              teacherId: "",
                              subjectTopicId: "",
                            }
                          : {}),
                        ...(field === "period"
                          ? { classSectionId: "", teacherId: "" }
                          : {}),
                        ...(field === "topic" ? { subjectTopicId: "" } : {}),
                      })
                    }
                  />
                </label>
              ))}
            </div>

            <AcademicFilters filters={filters} onChange={setFilters} />

            <div className={styles.filterActions}>
              <Button disabled={remote.loading} type="submit">
                Buscar comunidades
              </Button>
              <Button
                disabled={remote.loading}
                onClick={clearFilters}
                type="button"
                variant="secondary"
              >
                Limpar filtros
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {remote.loading ? (
        <div
          aria-label="Carregando comunidades"
          className={styles.grid}
          role="status"
        >
          <span className="sr-only">Carregando comunidades...</span>
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} variant="card" />
          ))}
        </div>
      ) : remote.error ? (
        <Card className={styles.stateCard}>
          <UsersThree aria-hidden size={36} />
          <div>
            <h2>Não foi possível carregar as comunidades</h2>
            <p>{errorMessage(remote.error)}</p>
          </div>
          <Button onClick={remote.reload} size="sm" type="button" variant="secondary">
            Tentar novamente
          </Button>
        </Card>
      ) : visibleGroups.length ? (
        <>
          <div className={styles.resultHeading}>
            <div>
              <h2>
                {view === "mine"
                  ? "Suas comunidades"
                  : "Comunidades para descobrir"}
              </h2>
              <p>
                {view === "mine"
                  ? "Continue de onde parou."
                  : "Explore espaços relacionados ao seu contexto acadêmico."}
              </p>
            </div>
            <span>Página {Math.floor(offset / PAGE_SIZE) + 1}</span>
          </div>

          <div className={styles.grid}>
            {visibleGroups.map((group) => (
              <Card className={styles.communityCard} interactive key={group.id}>
                <div className={styles.cardTop}>
                  <Badge variant="success">
                    {group.subjectName ?? "Comunidade acadêmica"}
                  </Badge>
                  {view === "mine" ? <Badge>Participando</Badge> : null}
                </div>

                <div className={styles.cardCopy}>
                  <h3><Link href={`/grupos/${group.id}`}>{group.name}</Link></h3>
                  <p>
                    {group.description ||
                      "O organizador ainda não adicionou uma descrição."}
                  </p>
                </div>

                <div className={styles.cardMeta}>
                  {group.period ? <span>{group.period}</span> : null}
                  <span>{entryLabels[group.joinPolicy]}</span>
                </div>

                <Link className={styles.cardAction} href={`/grupos/${group.id}`}>
                  Ver comunidade
                </Link>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <Card className={styles.stateCard}>
          <UsersThree aria-hidden size={38} />
          <div>
            <h2>
              {view === "mine"
                ? "Você ainda não participa de comunidades"
                : "Nenhuma comunidade encontrada"}
            </h2>
            <p>
              {view === "mine"
                ? "Descubra uma comunidade da sua disciplina ou crie um novo espaço de estudo."
                : "Ajuste os filtros ou crie uma comunidade para reunir colegas."}
            </p>
          </div>
          <div className={styles.stateActions}>
            {view === "mine" ? (
              <Button
                onClick={() => switchView("discover")}
                type="button"
                variant="secondary"
              >
                Descobrir
              </Button>
            ) : (
              <Button onClick={clearFilters} type="button" variant="secondary">
                Limpar filtros
              </Button>
            )}
            <Link className={styles.createLink} href="/grupos/novo">
              Criar comunidade
            </Link>
          </div>
        </Card>
      )}

      {!remote.loading &&
      !remote.error &&
      (offset > 0 || hasMore) ? (
        <nav className={styles.pagination} aria-label="Paginação de comunidades">
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
            disabled={!hasMore}
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
