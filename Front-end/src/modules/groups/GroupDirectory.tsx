"use client";
import Link from "next/link";
import { useCallback, useState, type FormEvent } from "react";
import {
  read,
  PAGE_SIZE,
  entryLabels,
  visibilityLabels,
  type Group,
} from "./api";
import { AcademicFilters, emptyFilters } from "./AcademicFilters";
import { useRemote } from "./useRemote";
import { Failure, Loading } from "./AsyncState";
import s from "./AcademicCommunity.module.css";

export function GroupDirectory({
  initialView = "mine",
}: {
  initialView?: "mine" | "discover";
}) {
  const [view, setView] = useState(initialView);
  const [offset, setOffset] = useState(0);
  const [filters, setFilters] = useState(emptyFilters);
  const [query, setQuery] = useState("");
  const path = `groups${view === "mine" ? "/mine" : ""}?limit=${PAGE_SIZE + 1}&offset=${offset}${view === "discover" ? `&${query}` : ""}`;
  const fetcher = useCallback(
    (signal: AbortSignal) => read<Group[]>(path, signal),
    [path],
  );
  const remote = useRemote(path, fetcher, true);
  function search(event: FormEvent) {
    event.preventDefault();
    setOffset(0);
    setQuery(new URLSearchParams(Object.entries(filters).filter(([, value]) => value.trim())).toString());
    remote.reload();
  }
  function switchView(next: "mine" | "discover") {
    setView(next);
    setOffset(0);
  }
  return (
    <div className={s.page}>
      <header className={s.header}>
        <div>
          <p className={s.eyebrow}>Comunidade acadêmica</p>
          <h1>Estudar fica melhor juntos</h1>
          <p>Encontre companhia para aprender ou continue de onde parou.</p>
        </div>
        <Link className={s.primary} href="/grupos/novo">
          + Criar grupo
        </Link>
      </header>
      <nav className={s.tabs} aria-label="Visualização de grupos">
        <button
          className={view === "mine" ? s.primary : s.secondary}
          aria-pressed={view === "mine"}
          onClick={() => switchView("mine")}
        >
          Meus grupos
        </button>
        <button
          className={view === "discover" ? s.primary : s.secondary}
          aria-pressed={view === "discover"}
          onClick={() => switchView("discover")}
        >
          Descobrir grupos
        </button>
      </nav>
      {view === "discover" ? (
        <form
          className={s.panel}
          onSubmit={search}
          role="search"
          aria-label="Buscar grupos"
        >
          <div className={s.grid}>
            {(
              [
                ["topic", "Assunto ou nome", "Ex.: revisão para a prova"],
                ["subject", "Disciplina", "Ex.: Cálculo"],
                ["period", "Período", "Ex.: 2026.2"],
              ] as const
            ).map(([field, label, placeholder]) => (
              <label className={s.field} key={field}>
                {label}
                <input
                  maxLength={field === "period" ? 80 : 200}
                  value={filters[field]}
                  placeholder={placeholder}
                  onChange={(e) =>
                    setFilters({ ...filters, [field]: e.target.value,
                      ...(field === "subject" ? { subjectId: "", classSectionId: "", teacherId: "", subjectTopicId: "" } : {}),
                      ...(field === "period" ? { classSectionId: "", teacherId: "" } : {}),
                      ...(field === "topic" ? { subjectTopicId: "" } : {}),
                    })
                  }
                />
              </label>
            ))}
          </div>
          <AcademicFilters filters={filters} onChange={setFilters} />
          <div className={s.actions}>
            <button className={s.primary} disabled={remote.loading}>
              Buscar grupos
            </button>
            <button
              className={s.secondary}
              type="button"
              onClick={() => {
                setFilters(emptyFilters);
                setQuery("");
                setOffset(0);
              }}
            >
              Limpar filtros
            </button>
          </div>
        </form>
      ) : null}
      {remote.loading ? (
        <Loading />
      ) : remote.error ? (
        <Failure error={remote.error} retry={remote.reload} />
      ) : remote.data?.length ? (
        <>
          <div className={s.row}>
            <h2>
              {view === "mine"
                ? "Seus espaços de estudo"
                : "Grupos para descobrir"}
            </h2>
            <span role="status" className={s.muted}>
              Página {Math.floor(offset / PAGE_SIZE) + 1}
            </span>
          </div>
          <div className={s.grid}>
            {remote.data.slice(0, PAGE_SIZE).map((group) => (
              <article className={s.panel} key={group.id}>
                <span className={s.badge}>
                  {group.subjectName ?? visibilityLabels[group.visibility]}
                </span>
                <h3>
                  <Link href={`/grupos/${group.id}`}>{group.name}</Link>
                </h3>
                <p className={s.text}>
                  {group.description ||
                    "Um espaço para aprender e compartilhar conhecimento."}
                </p>
                <div className={s.muted}>
                  {group.period ? `${group.period} · ` : ""}
                  {entryLabels[group.joinPolicy]}
                </div>
                <Link className={s.secondary} href={`/grupos/${group.id}`}>
                  Conhecer grupo →
                </Link>
              </article>
            ))}
          </div>
        </>
      ) : (
        <section className={s.state}>
          <h2>
            {view === "mine"
              ? "Seu próximo grupo começa aqui"
              : "Nenhum grupo encontrado"}
          </h2>
          <p>
            {view === "mine"
              ? "Você ainda não participa de grupos. Descubra uma comunidade ou crie seu primeiro grupo."
              : "Tente outro assunto, remova os filtros ou reúna colegas em um novo grupo."}
          </p>
          <div className={s.actions}>
            {view === "mine" ? (
              <button
                className={s.secondary}
                onClick={() => switchView("discover")}
              >
                Descobrir grupos
              </button>
            ) : (
              <button
                className={s.secondary}
                onClick={() => {
                  setFilters(emptyFilters);
                  setQuery("");
                  setOffset(0);
                }}
              >
                Remover filtros
              </button>
            )}
            <Link href="/grupos/novo" className={s.primary}>
              Criar grupo
            </Link>
          </div>
        </section>
      )}
      {!remote.loading &&
      !remote.error &&
      (offset > 0 || (remote.data?.length ?? 0) > PAGE_SIZE) ? (
        <nav className={s.actions} aria-label="Paginação de grupos">
          <button
            className={s.secondary}
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          >
            Anterior
          </button>
          <button
            className={s.secondary}
            disabled={(remote.data?.length ?? 0) <= PAGE_SIZE}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            Próxima
          </button>
        </nav>
      ) : null}
    </div>
  );
}
