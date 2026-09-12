"use client";

import {
  BookOpenText,
  CaretDown,
  CloudArrowUp,
  Eye,
  FilePdf,
  GraduationCap,
  MagnifyingGlass,
  Money,
  PencilSimple,
  ShieldCheck,
  Star,
  Storefront,
  UsersThree,
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import Link from "next/link";

import styles from "./page.module.css";

type Material = {
  category: string;
  description: string;
  id: number;
  pages: number;
  sales: number;
  groupName: string;
  groupHref: string;
  title: string;
};

const materials: Material[] = [
  { id: 1, title: "Lista comentada: Teoria de Filas", category: "Cálculo Diferencial e Integral II", description: "Resoluções e explicações preparadas para os participantes da monitoria.", pages: 42, sales: 19, groupName: "Comunidade MSD — C8", groupHref: "/grupos/comunidade-msd-c8" },
  { id: 2, title: "Resumo de Simplex e Dualidade", category: "Pesquisa Operacional I", description: "Roteiro de revisão exclusivo, associado aos encontros e canais privados.", pages: 31, sales: 9, groupName: "Comunidade MSD — C8", groupHref: "/grupos/comunidade-msd-c8" },
];

const tabs = ["Materiais da biblioteca", "Meus materiais", "Rascunhos"] as const;

export function MateriaisPage() {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Meus materiais");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const visibleMaterials = useMemo(() => materials.filter((item) => `${item.title} ${item.category}`.toLowerCase().includes(query.toLowerCase())), [query]);

  return (
    <div className={styles.page}>
      <div className={styles.crumbs}><span>nexoAula</span><b>›</b><span>Minha biblioteca</span><b>›</b><strong>Materiais de estudo</strong><span className={styles.protection}><ShieldCheck size={13} weight="fill" /> Proteção e carimbo ativo: CPF 492.•••.•••-18</span></div>

      <section className={styles.hero} aria-labelledby="materiais-title">
        <div>
          <p className={styles.eyebrow}><BookOpenText size={14} weight="fill" /> Biblioteca acadêmica</p>
          <h1 id="materiais-title">Organize seus materiais de estudo</h1>
          <p>Centralize resumos, listas e materiais usados nos seus estudos. Comunidades privadas e seus planos são configurados na área de Grupos.</p>
        </div>
        <Link className={styles.publishButton} href="/grupos/comunidade-msd-c8"><CloudArrowUp size={20} weight="bold" /><span>Gerenciar materiais do grupo<small>Os conteúdos pertencem a uma comunidade</small></span></Link>
      </section>

      <section className={styles.achievement} aria-label="Conquistas acadêmicas">
        <div className={styles.achievementIcon}><GraduationCap size={27} weight="fill" /></div>
        <div><strong>Materiais vinculados aos seus grupos</strong><span>Privada</span><p>Para disponibilizar conteúdo em um grupo privado, configure a comunidade e seu acesso na área de Grupos.</p></div>
        <Link href="/grupos">ⓘ Gerenciar grupos</Link>
      </section>

      <section className={styles.stats} aria-label="Resumo das publicações">
        <Stat icon={<Money weight="fill" />} label="Organização" value="Premium" detail="Configure comunidades em Grupos" />
        <Stat icon={<Storefront weight="fill" />} label="Materiais salvos" value="28" detail="↗ +6 nesta semana" />
        <Stat icon={<Star weight="fill" />} label="Materiais de estudo" value="4" detail="Disponíveis para membros" />
        <Stat icon={<Eye weight="fill" />} label="Acessos da comunidade" value="142" detail="Dados simulados" />
      </section>

      <section className={styles.library} aria-label="Lista de materiais">
        <div className={styles.toolbar}>
          <div className={styles.tabs} role="tablist" aria-label="Status dos materiais">{tabs.map((tab, index) => <button aria-selected={activeTab === tab} className={activeTab === tab ? styles.activeTab : ""} key={tab} onClick={() => setActiveTab(tab)} role="tab" type="button">{tab}<span>{index === 0 ? 4 : index === 1 ? 2 : 1}</span></button>)}</div>
          <label className={styles.filter}><MagnifyingGlass size={17} /><span className="sr-only">Filtrar materiais</span><input onChange={(event) => setQuery(event.target.value)} placeholder="Filtrar por código ou tema..." value={query} /><CaretDown size={16} /></label>
        </div>
        <div className={styles.materialGrid}>
          <article className={styles.uploadCard}><div className={styles.uploadIcon}><FilePdf size={25} weight="fill" /></div><strong>Adicionar material a um grupo</strong><p>Escolha a comunidade que receberá PDFs, resumos e listas resolvidas.</p><Link href="/grupos/comunidade-msd-c8">Abrir grupo <span>→</span></Link><small>Todo material fica vinculado ao grupo</small></article>
          {activeTab === "Meus materiais" && visibleMaterials.map((material) => <MaterialCard item={material} key={material.id} onAction={setMessage} />)}
          {activeTab !== "Meus materiais" && <div className={styles.emptyState}><BookOpenText size={28} /><strong>Nenhum conteúdo nesta categoria</strong><p>Publique um conteúdo ou alterne para os conteúdos da comunidade.</p></div>}
        </div>
      </section>

      <footer className={styles.footer}><ShieldCheck size={25} weight="fill" /><div><strong>Diretrizes de materiais de estudo</strong><p>Publique apenas materiais próprios ou autorizados. Use conteúdos próprios ou autorizados e compartilhe-os de acordo com as regras dos seus grupos.</p></div><button onClick={() => setMessage("Termos de conteúdo disponíveis nesta demonstração.")} type="button">Ver Termos de Conteúdo</button></footer>
      <p aria-live="polite" className={styles.feedback}>{message}</p>
    </div>
  );
}

export default MateriaisPage;

function Stat({ detail, icon, label, value }: { detail: string; icon: React.ReactNode; label: string; value: string }) {
  return <article className={styles.stat}><div><span>{label}</span><i>{icon}</i></div><strong>{value}</strong><small>{detail}</small></article>;
}

function MaterialCard({ item, onAction }: { item: Material; onAction: (message: string) => void }) {
  return <article className={styles.materialCard}><div className={`${styles.cover} ${item.id === 2 ? styles.coverSecond : ""}`}><span>● Material da biblioteca</span><b>Acesso</b><div><FilePdf size={13} weight="fill" /> {item.pages} páginas · PDF</div><small>Vinculado a {item.groupName}</small></div><div className={styles.materialBody}><p><em>GRUPO</em>{item.groupName}</p><h2>{item.title}</h2><span>{item.description}</span><div className={styles.sales}><UsersThree size={15} weight="fill" /> {item.sales} acessos <b>★ 4.9 (14)</b><small>Material de estudo</small></div></div><div className={styles.materialActions}><Link href={item.groupHref}> <Eye size={15} /> Ver no grupo</Link><button onClick={() => onAction(`Edição do material de “${item.title}” aberta.`)} type="button"><PencilSimple size={15} /> Editar Conteúdo</button></div></article>;
}
