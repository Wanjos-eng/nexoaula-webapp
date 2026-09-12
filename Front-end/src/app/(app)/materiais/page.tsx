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
  earnings: string;
  id: number;
  pages: number;
  price: string;
  sales: number;
  title: string;
};

const materials: Material[] = [
  { id: 1, title: "Caderno Completo P1 + P2 Comentado", category: "Cálculo Diferencial e Integral II", description: "Resoluções passo a passo de todas as provas anteriores, teoremas de Green, Stokes e divergente.", pages: 42, sales: 19, price: "R$ 19,00", earnings: "R$ 16,72" },
  { id: 2, title: "Método Simplex & Dualidade – Resumo", category: "Pesquisa Operacional I", description: "Roteiro simplificado para montagem de matrizes Simplex, análise de sensibilidade e interpretação.", pages: 31, sales: 9, price: "R$ 24,00", earnings: "R$ 21,12" },
];

const tabs = ["Materiais comprados", "Meus materiais publicados", "Rascunhos"] as const;

export default function MateriaisPage() {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Meus materiais publicados");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const visibleMaterials = useMemo(() => materials.filter((item) => `${item.title} ${item.category}`.toLowerCase().includes(query.toLowerCase())), [query]);

  return (
    <div className={styles.page}>
      <div className={styles.crumbs}><span>nexoAula</span><b>›</b><span>Meus Materiais</span><b>›</b><strong>Materiais de Estudo</strong><span className={styles.protection}><ShieldCheck size={13} weight="fill" /> Proteção e carimbo ativo: CPF 492.•••.•••-18</span></div>

      <section className={styles.hero} aria-labelledby="materiais-title">
        <div>
          <p className={styles.eyebrow}><BookOpenText size={14} weight="fill" /> Gestão acadêmica & repasse direto</p>
          <h1 id="materiais-title">Minha Biblioteca & Publicações</h1>
          <p>Gerencie seus materiais adquiridos e compartilhe anotações e cadernos de matérias que você já cursou para monetizar.</p>
        </div>
        <Link className={styles.publishButton} href="/materiais/publicar"><CloudArrowUp size={20} weight="bold" /><span>+ Publicar Material Didático<small>Ganhe até 88% por venda via Pix</small></span></Link>
      </section>

      <section className={styles.achievement} aria-label="Conquistas acadêmicas">
        <div className={styles.achievementIcon}><GraduationCap size={27} weight="fill" /></div>
        <div><strong>Você já concluiu 8 disciplinas com aprovação</strong><span>Engenharia de Produção</span><p>Transforme seus resumos, listas comentadas e provas anteriores em cadernos com renda extra. Seus colegas de Engenharia estão procurando materiais de turmas passadas.</p></div>
        <button onClick={() => setMessage("O repasse funciona via Pix após a confirmação da compra.")} type="button">ⓘ Como funciona o repasse (88% via Pix)</button>
      </section>

      <section className={styles.stats} aria-label="Resumo das publicações">
        <Stat icon={<Money weight="fill" />} label="Ganhos Acumulados (Mês)" value="R$ 334,40" detail="↗ Repasse automático via chave ativa" />
        <Stat icon={<Storefront weight="fill" />} label="Vendas Totais" value="28" detail="↗ +6 esta semana" />
        <Stat icon={<Star weight="fill" />} label="Reputação de Autor" value="4.9 ★" detail="Baseado em 19 avaliações verificadas" />
        <Stat icon={<Eye weight="fill" />} label="Visualizações do Perfil" value="142" detail="↗ Top 5% na Eng. de Produção" />
      </section>

      <section className={styles.library} aria-label="Lista de materiais">
        <div className={styles.toolbar}>
          <div className={styles.tabs} role="tablist" aria-label="Status dos materiais">{tabs.map((tab, index) => <button aria-selected={activeTab === tab} className={activeTab === tab ? styles.activeTab : ""} key={tab} onClick={() => setActiveTab(tab)} role="tab" type="button">{tab}<span>{index === 0 ? 4 : index === 1 ? 2 : 1}</span></button>)}</div>
          <label className={styles.filter}><MagnifyingGlass size={17} /><span className="sr-only">Filtrar materiais</span><input onChange={(event) => setQuery(event.target.value)} placeholder="Filtrar por código ou tema..." value={query} /><CaretDown size={16} /></label>
        </div>
        <div className={styles.materialGrid}>
          <article className={styles.uploadCard}><div className={styles.uploadIcon}><FilePdf size={25} weight="fill" /></div><strong>Publicar Outro Caderno</strong><p>PDFs de anotações, resumos, ou listas resolvidas passo a passo.</p><Link href="/materiais/publicar">Iniciar envio <span>→</span></Link><small>Comissão fixa garantida: 88%</small></article>
          {activeTab === "Meus materiais publicados" && visibleMaterials.map((material) => <MaterialCard item={material} key={material.id} onAction={setMessage} />)}
          {activeTab !== "Meus materiais publicados" && <div className={styles.emptyState}><BookOpenText size={28} /><strong>Nenhum material nesta categoria</strong><p>Alterne para os materiais publicados ou envie um novo caderno.</p></div>}
        </div>
      </section>

      <footer className={styles.footer}><ShieldCheck size={25} weight="fill" /><div><strong>Diretrizes de Propriedade Intelectual & Repasse</strong><p>Todos os materiais passam pelo carimbo antifraude digital com CPF e ID do comprador em cada página do PDF. É vedada a venda de livros comerciais na íntegra.</p></div><button onClick={() => setMessage("Termos de autor disponíveis nesta demonstração.")} type="button">Ver Termos de Autor</button></footer>
      <p aria-live="polite" className={styles.feedback}>{message}</p>
    </div>
  );
}

function Stat({ detail, icon, label, value }: { detail: string; icon: React.ReactNode; label: string; value: string }) {
  return <article className={styles.stat}><div><span>{label}</span><i>{icon}</i></div><strong>{value}</strong><small>{detail}</small></article>;
}

function MaterialCard({ item, onAction }: { item: Material; onAction: (message: string) => void }) {
  return <article className={styles.materialCard}><div className={`${styles.cover} ${item.id === 2 ? styles.coverSecond : ""}`}><span>● Publicado na Vitrine</span><b>{item.price}</b><div><FilePdf size={13} weight="fill" /> {item.pages} páginas · PDF</div><small>Gera {item.earnings} líquido</small></div><div className={styles.materialBody}><p><em>PRO-3{item.id === 1 ? "101" : "304"}</em>{item.category}</p><h2>{item.title}</h2><span>{item.description}</span><div className={styles.sales}><UsersThree size={15} weight="fill" /> {item.sales} vendas <b>★ 4.9 (14)</b><small>Taxa: 12%</small></div></div><div className={styles.materialActions}><Link href="/comprar-materiais/caderno-resolucoes-p1"> <Eye size={15} /> Ver Vitrine</Link><button onClick={() => onAction(`Edição de preço de “${item.title}” aberta.`)} type="button"><PencilSimple size={15} /> Editar Preço</button></div></article>;
}
