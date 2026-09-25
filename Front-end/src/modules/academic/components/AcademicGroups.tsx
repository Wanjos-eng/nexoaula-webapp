"use client";

import { BookOpenText, MagnifyingGlass } from "@phosphor-icons/react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { fetchMyProgress } from "@/modules/academic/attendance";
import { catalog } from "@/modules/groups/api";
import {
  academicGroups,
  readAll,
  type Lesson,
} from "@/modules/groups/schedule";
import { useRemote } from "@/modules/groups/useRemote";
import styles from "./AcademicGroups.module.css";

export function AcademicGroups() {
  const fetcher = useCallback(async (signal: AbortSignal) => {
    const [groups, teachers, assignments, lessons, progress] = await Promise.all([
      academicGroups(signal),
      catalog("teachers", signal),
      catalog("class-section-teachers", signal),
      readAll<Lesson>("groups/me/lessons?period=future", signal),
      fetchMyProgress(undefined, signal),
    ]);
    return { groups, teachers, assignments, lessons, progress };
  }, []);

  const remote = useRemote("academic-groups", fetcher, true);
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");

  const groups = remote.data?.groups ?? [];
  const terms = useMemo(
    () => [...new Set(groups.map((group) => group.term))].filter(Boolean),
    [groups],
  );
  const filtered = groups.filter(
    (group) =>
      (!term || group.term === term) &&
      `${group.name} ${group.subject}`
        .toLocaleLowerCase("pt-BR")
        .includes(query.trim().toLocaleLowerCase("pt-BR")),
  );

  return (
    <div className={styles.page}>
      <PageHeader
        actions={
          <Link className={styles.calendarLink} href="/calendario">
            Abrir calendário
          </Link>
        }
        description="Acesse o contexto acadêmico e o cronograma das comunidades em que você participa."
        eyebrow="Vida acadêmica"
        title="Minhas Disciplinas"
      />

      {remote.loading ? (
        <div className={styles.grid} role="status" aria-label="Carregando disciplinas">
          <span className="sr-only">Carregando disciplinas...</span>
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} variant="card" />
          ))}
        </div>
      ) : remote.error ? (
        <Card className={styles.stateCard} role="alert">
          <BookOpenText aria-hidden size={36} />
          <div>
            <h2>Não foi possível carregar suas disciplinas</h2>
            <p>Atualize a consulta e tente novamente.</p>
          </div>
          <Button onClick={remote.reload} size="sm" type="button" variant="secondary">
            Tentar novamente
          </Button>
        </Card>
      ) : !groups.length ? (
        <Card className={styles.stateCard}>
          <BookOpenText aria-hidden size={38} />
          <div>
            <h2>Você ainda não participa de comunidades</h2>
            <p>
              As disciplinas aparecem aqui quando você participa de uma comunidade vinculada ao contexto acadêmico.
            </p>
          </div>
          <Link className={styles.primaryLink} href="/grupos?view=discover">
            Descobrir comunidades
          </Link>
        </Card>
      ) : (
        <>
          <section className={styles.filters} aria-label="Filtrar disciplinas">
            <label className={styles.searchField}>
              <MagnifyingGlass aria-hidden size={18} />
              <span className="sr-only">Buscar disciplina ou comunidade</span>
              <input
                placeholder="Buscar disciplina ou comunidade..."
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>

            <label className={styles.termField}>
              <span className="sr-only">Filtrar período</span>
              <select
                aria-label="Filtrar período"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
              >
                <option value="">Todos os períodos</option>
                {terms.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </section>

          {filtered.length ? (
            <section className={styles.grid} aria-label="Disciplinas por comunidade">
              {filtered.map((group) => {
                const assignment = remote.data?.assignments.find(
                  (item) => item.classSectionId === group.offeringId,
                );
                const teacher = remote.data?.teachers.find(
                  (item) => item.id === assignment?.teacherId,
                )?.fullName;
                const nextLesson = remote.data?.lessons
                  .filter((lesson) => lesson.groupId === group.id)
                  .sort(
                    (left, right) =>
                      new Date(left.scheduledAt).getTime() -
                      new Date(right.scheduledAt).getTime(),
                  )[0];
                const groupProgress =
                  remote.data?.progress.filter(
                    (record) => record.groupId === group.id,
                  ) ?? [];
                const mastered = groupProgress.filter(
                  (record) => record.status === "mastered",
                ).length;
                const reviewing = groupProgress.filter(
                  (record) => record.status === "reviewing",
                ).length;

                return (
                <Card className={styles.disciplineCard} interactive key={group.id}>
                  <div className={styles.cardTop}>
                    <Badge variant="success">{group.term}</Badge>
                    <BookOpenText aria-hidden size={21} />
                  </div>

                  <div className={styles.cardCopy}>
                    <h2>{group.subject}</h2>
                    <p>{group.name}</p>
                    <small>{group.section}</small>
                  </div>

                  <dl className={styles.cardMeta}>
                    {teacher ? (
                      <div>
                        <dt>Docente</dt>
                        <dd>{teacher}</dd>
                      </div>
                    ) : null}
                    {nextLesson ? (
                      <div>
                        <dt>Próxima aula</dt>
                        <dd>
                          {new Date(nextLesson.scheduledAt).toLocaleString(
                            "pt-BR",
                            {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </dd>
                      </div>
                    ) : null}
                    {groupProgress.length ? (
                      <div>
                        <dt>Meu progresso</dt>
                        <dd>
                          {mastered} concluído{mastered === 1 ? "" : "s"}
                          {reviewing
                            ? ` · ${reviewing} em revisão`
                            : ""}
                        </dd>
                      </div>
                    ) : null}
                  </dl>

                  <div className={styles.cardActions}>
                    <Link href={`/grupos/${group.id}`}>
                      Ver comunidade
                    </Link>
                    <Link className={styles.primaryLink} href={`/grupos/${group.id}#cronograma`}>
                      Abrir cronograma
                    </Link>
                  </div>
                </Card>
                );
              })}
            </section>
          ) : (
            <Card className={styles.filteredEmpty}>
              <p>Nenhuma disciplina corresponde aos filtros selecionados.</p>
              <Button
                onClick={() => {
                  setQuery("");
                  setTerm("");
                }}
                size="sm"
                type="button"
                variant="secondary"
              >
                Limpar filtros
              </Button>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
