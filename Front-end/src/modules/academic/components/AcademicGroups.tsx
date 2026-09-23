"use client";
import Link from "next/link";
import { useState } from "react";
import { academicGroups } from "@/modules/groups/schedule";
import { useRemote } from "@/modules/groups/useRemote";
import { Failure, Loading } from "@/modules/groups/AsyncState";
import s from "@/modules/groups/AcademicCommunity.module.css";

export function AcademicGroups() {
  const remote = useRemote("academic-groups", academicGroups, true);
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const groups = remote.data ?? [];
  const filtered = groups.filter((group) =>
    (!term || group.term === term) &&
    `${group.name} ${group.subject}`.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR")));
  return <div className={s.page}>
    <header className={s.header}><div><h1>Minhas disciplinas</h1><p>Acompanhe o contexto e o cronograma de cada grupo em que você participa.</p></div>
      <Link className={s.secondary} href="/calendario">Abrir calendário</Link>
    </header>
    {remote.loading ? <Loading /> : remote.error ? <Failure error={remote.error} retry={remote.reload} /> : !groups.length ? (
      <section className={s.state}><h2>Você ainda não participa de grupos</h2><p>Suas disciplinas aparecerão aqui ao entrar em um grupo.</p>
        <Link className={s.primary} href="/grupos?view=discover">Descobrir grupos</Link></section>
    ) : <>
      <div className={s.fields}>
        <label className={s.field}>Buscar disciplina ou grupo<input value={query} onChange={(e) => setQuery(e.target.value)} /></label>
        <label className={s.field}>Filtrar período<select value={term} onChange={(e) => setTerm(e.target.value)}>
          <option value="">Todos os períodos</option>
          {[...new Set(groups.map((group) => group.term))].map((label) => <option key={label}>{label}</option>)}
        </select></label>
      </div>
      <section className={s.grid} aria-label="Disciplinas por grupo">
        {filtered.map((group) => <article className={s.panel} key={group.id}>
          <h2>{group.subject}</h2><h3>{group.name}</h3><p>{group.section} · {group.term}</p>
          <Link className={s.primary} href={`/grupos/${group.id}#cronograma`}>Abrir cronograma de {group.name}</Link>
        </article>)}
      </section>
      {!filtered.length && <p>Nenhum grupo corresponde aos filtros.</p>}
    </>}
  </div>;
}
