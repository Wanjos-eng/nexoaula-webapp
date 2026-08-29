"use client";

import { BookOpenText, CalendarBlank, CheckCircle, Clock, FileText } from "@phosphor-icons/react/dist/ssr";
import { useState } from "react";
import type { ReactNode } from "react";

import styles from "./DisciplineDetailPage.module.css";

const notes = [
  ["P1 - Prova Teórica 1", "30%", "8.5", "Entregue"],
  ["P2 - Prova Teórica 2", "30%", "9.0", "Entregue"],
  ["Trabalho 1 - Prático", "15%", "8.0", "Entregue"],
  ["Trabalho 2 - Final", "15%", "--", "Pendente"],
  ["Lista de Exercícios", "10%", "10.0", "Entregue"],
];

const upcoming = [
  { type: "ATIVIDADE", title: "Entrega Trabalho 2", date: "Prazo: 25/11 às 23:59", code: "CS-401" },
  { type: "ESTUDO", title: "Exercícios de Simulação", date: "Prazo: 30/11 às 14:00", code: "CS-401" },
];

const tabs = ["Ementa", "Materiais", "Notas", "Atividades"] as const;

export function DisciplineDetailPage() {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Notas");

  return (
    <div className={styles.page}>
      <header className={styles.disciplineHeader}>
        <div className={styles.titleBlock}>
          <div>
            <h1>Modelagem e Simulação Discreta</h1>
            <p>Prof. Dr. Ricardo Lima · Código: CS-401 · Semestre: 2026.1</p>
          </div>
        </div>
        <span className={styles.activeBadge}><span /> Ativa</span>
        <section className={styles.progressStrip} aria-label="Progresso do conteúdo">
          <span>Progresso do Conteúdo:</span>
          <div className={styles.progressTrack}><span style={{ width: "45%" }} /></div>
          <strong>45% completo</strong>
        </section>
      </header>

      <nav aria-label="Seções da disciplina" className={styles.tabs}>
        {tabs.map((tab) => (
          <button aria-current={activeTab === tab ? "page" : undefined} className={activeTab === tab ? styles.tabActive : ""} key={tab} onClick={() => setActiveTab(tab)} type="button">{tab}</button>
        ))}
      </nav>

      {activeTab === "Notas" ? (
        <div className={styles.contentGrid}>
          <section aria-labelledby="notes-title" className={styles.notesPanel}>
            <div className={styles.panelHeading}>
              <div><h2 id="notes-title">Notas Acadêmicas</h2></div>
            </div>
            <div className={styles.tableWrap}>
              <table>
                <thead><tr><th>Avaliação / atividade</th><th>Peso</th><th>Nota</th><th>Status</th></tr></thead>
                <tbody>{notes.map(([name, weight, grade, status]) => <tr key={name}><th scope="row">{name}</th><td>{weight}</td><td>{grade}</td><td><span className={status === "Entregue" ? styles.statusDone : styles.statusPending}>{status === "Entregue" ? <CheckCircle aria-hidden size={13} weight="fill" /> : <Clock aria-hidden size={13} />}{status}</span></td></tr>)}</tbody>
              </table>
            </div>
          </section>
          <UpcomingActivities />
        </div>
      ) : null}

      {activeTab === "Ementa" ? <section className={styles.singlePanel}><PanelTitle icon={<BookOpenText aria-hidden size={19} />} title="Ementa" /><p>Fundamentos de modelagem e simulação de sistemas discretos, processos de chegada e atendimento, filas M/M/1 e análise de desempenho.</p><div className={styles.topicList}><span>Modelos conceituais</span><span>Simulação de eventos discretos</span><span>Sistemas de filas</span><span>Interpretação de resultados</span></div></section> : null}

      {activeTab === "Materiais" ? <section className={styles.singlePanel}><PanelTitle icon={<FileText aria-hidden size={19} />} title="Materiais" /><div className={styles.materialList}><button type="button"><FileText aria-hidden size={18} /><span><strong>Plano de estudos da disciplina</strong><small>PDF · atualizado em 20/08/2026</small></span></button><button type="button"><FileText aria-hidden size={18} /><span><strong>Roteiro — filas M/M/1</strong><small>Documento · 4 páginas</small></span></button></div></section> : null}

      {activeTab === "Atividades" ? <section className={styles.singlePanel}><PanelTitle icon={<CalendarBlank aria-hidden size={19} />} title="Atividades" /><div className={styles.activityList}>{upcoming.map((item) => <article key={item.title}><span className={styles.activityIcon}><CalendarBlank aria-hidden size={18} /></span><div><small>{item.type} · {item.code}</small><h3>{item.title}</h3><p>{item.date}</p></div></article>)}</div></section> : null}
    </div>
  );
}

function UpcomingActivities() {
  return <aside aria-labelledby="upcoming-title" className={styles.upcomingPanel}><div className={styles.panelHeading}><div><h2 id="upcoming-title">Próximas atividades</h2></div></div><div className={styles.upcomingList}>{upcoming.map((item) => <article key={item.title}><div><span>{item.type}</span><small>{item.code}</small></div><h3>{item.title}</h3><p>{item.date}</p></article>)}</div></aside>;
}

function PanelTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return <div className={styles.panelHeading}><div><p className={styles.panelKicker}>Conteúdo</p><h2>{title}</h2></div><span className={styles.panelIcon}>{icon}</span></div>;
}
