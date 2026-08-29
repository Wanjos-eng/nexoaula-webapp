"use client";

import { ArrowRight, MagnifyingGlass, MapPin, UsersThree } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { useMemo, useState } from "react";

import styles from "./page.module.css";

const myGroups = [{ name: "Comunidade MSD — C8", discipline: "Modelagem e Simulação Discreta", details: "12 de 20 membros · 4 assuntos", role: "Organizador", href: "/grupos/comunidade-msd-c8" }];
const discoverGroups = [
  { name: "Engenharia de Software · Sprint 1", discipline: "Engenharia de Software", details: "18 de 30 membros · Encontro amanhã", location: "Remoto" },
  { name: "Estruturas de Dados — Monitoria", discipline: "Estruturas de Dados", details: "7 de 15 membros · Entrada livre", location: "UNIVASF" },
  { name: "Cálculo II: resolução colaborativa", discipline: "Cálculo II", details: "23 de 40 membros · 6 assuntos", location: "Remoto" },
];

export default function GruposPage() {
  const [view, setView] = useState<"mine" | "discover">("mine");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const filteredGroups = useMemo(() => discoverGroups.filter((group) => `${group.name} ${group.discipline}`.toLowerCase().includes(query.toLowerCase())), [query]);

  return <div className={styles.page}><header className={styles.heading}><div><p className={styles.eyebrow}>Comunidade acadêmica</p><h2>Grupos</h2><p>Estude com sua turma ou descubra comunidades abertas para aprender em conjunto.</p></div></header><div className={styles.switcher} role="tablist" aria-label="Visualização de grupos"><button aria-selected={view === "mine"} className={view === "mine" ? styles.switchActive : styles.switch} onClick={() => setView("mine")} role="tab" type="button">Meus grupos <span>1</span></button><button aria-selected={view === "discover"} className={view === "discover" ? styles.switchActive : styles.switch} onClick={() => setView("discover")} role="tab" type="button">Descobrir grupos</button></div>{view === "discover" ? <div className={styles.discoverTools}><label className={styles.searchField}><MagnifyingGlass aria-hidden size={19} /><span className="sr-only">Pesquisar grupos abertos</span><input onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar grupos abertos por disciplina ou nome..." value={query} /></label><span className={styles.openLabel}>Entrada livre</span></div> : null}{view === "mine" ? <div className={styles.grid}><GroupCard group={myGroups[0]} /><article className={`${styles.groupCard} ${styles.emptyCard}`}><div className={styles.groupIcon}><UsersThree aria-hidden size={25} /></div><h3>Crie um espaço para sua turma</h3><p>Grupos, canais e encontros ficam reunidos em um só lugar. Use “Criar grupo” no cabeçalho para começar.</p></article></div> : <div className={styles.discoverGrid}>{filteredGroups.map((group) => <article className={styles.discoverCard} key={group.name}><div className={styles.discoverIcon}><UsersThree aria-hidden size={22} /></div><div className={styles.discoverCopy}><div className={styles.discoverTitle}><div><h3>{group.name}</h3><p>{group.discipline}</p></div><span>Aberto</span></div><p className={styles.discoverDetails}>{group.details}</p><p className={styles.location}><MapPin aria-hidden size={15} /> {group.location}</p><button className={styles.joinButton} onClick={() => setNotice(`Solicitação para entrar em “${group.name}” registrada no protótipo.`)} type="button">Ver grupo <ArrowRight aria-hidden size={16} /></button></div></article>)}{filteredGroups.length === 0 ? <div className={styles.noResults}><MagnifyingGlass aria-hidden size={24} /><h3>Nenhum grupo encontrado</h3><p>Tente buscar por outra disciplina ou nome.</p></div> : null}</div>}{notice ? <p aria-live="polite" className={styles.notice}>{notice}</p> : null}</div>;
}

function GroupCard({ group }: { group: (typeof myGroups)[number] }) { return <article className={styles.groupCard}><div className={styles.groupIcon}><UsersThree aria-hidden size={25} /></div><div className={styles.groupTop}><div><h3>{group.name}</h3><p>{group.discipline}</p></div><span>{group.role}</span></div><div className={styles.stats}><span>{group.details}</span><span>Próximo encontro 31/08</span></div><Link className={styles.linkAction} href={group.href}>Abrir grupo <ArrowRight aria-hidden size={16} /></Link></article>; }
