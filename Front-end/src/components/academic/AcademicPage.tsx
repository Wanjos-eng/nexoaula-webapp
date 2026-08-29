import { ArrowRight, BookOpenText, CheckCircle, Clock, NotePencil, Plus, TrendUp } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import styles from "./AcademicPage.module.css";

type AcademicPageProps = { variant: "disciplines" | "calendar" | "progress" };

const lessons = [
  { date: "31", month: "Ago", title: "Modelo Conceitual de Sistemas de Fila M/M/1 — continuação", time: "14h–16h" },
  { date: "02", month: "Set", title: "Modelo Conceitual de Sistemas de Fila M/M/1 e seus algoritmos", time: "14h–16h" },
  { date: "07", month: "Set", title: "Modelo Computacional de Fila M/M/1", time: "14h–16h" },
];

export function AcademicPage({ variant }: AcademicPageProps) {
  if (variant === "calendar") {
    return <div className={styles.page}><Header eyebrow="Agenda acadêmica" title="Calendário" description="Veja suas próximas aulas e encontros em uma linha do tempo simples." action="/grupos/comunidade-msd-c8" actionLabel="Ver encontros" /><section className={styles.calendarCard} aria-label="Próximas aulas">{lessons.map((lesson, index) => <article className={styles.lesson} key={lesson.date}><div className={styles.date}><span>{lesson.month}</span><strong>{lesson.date}</strong></div><div className={styles.lessonBody}><p className={styles.lessonLabel}>{index === 0 ? "Próxima aula" : "Aula programada"}</p><h3>{lesson.title}</h3><p><Clock aria-hidden size={16} /> {lesson.time} · Modelagem e Simulação Discreta · Turma C8</p></div><button className={styles.detailButton} type="button">Detalhes <ArrowRight aria-hidden size={16} /></button></article>)}</section></div>;
  }

  if (variant === "progress") {
    return <div className={styles.page}><Header eyebrow="Acompanhamento" title="Meu progresso" description="Acompanhe sua rotina e identifique o próximo conteúdo para revisar." /><div className={styles.progressGrid}><section className={styles.progressCard}><div className={styles.cardTitle}><div><p className={styles.label}>Disciplina</p><h3>Modelagem e Simulação Discreta</h3><p>C8 · 2026.2</p></div><strong>45%</strong></div><div className={styles.track}><span style={{ width: "45%" }} /></div><ul><li><CheckCircle aria-hidden size={19} /> 2 aulas realizadas</li><li><NotePencil aria-hidden size={19} /> 1 conteúdo pendente</li><li><TrendUp aria-hidden size={19} /> Frequência em dia</li></ul><Link className={styles.linkAction} href="/disciplinas">Abrir disciplina <ArrowRight aria-hidden size={16} /></Link></section><section className={styles.nextCard}><p className={styles.label}>Próximo foco</p><h3>Modelo Analítico de Sistemas de Fila M/M/1</h3><p>Reserve um tempo para revisar este conteúdo antes do próximo encontro.</p><button className={styles.outlineButton} type="button">Marcar como revisado</button></section></div></div>;
  }

  return <div className={styles.page}><Header eyebrow="Organização acadêmica" title="Minhas disciplinas" description="Centralize conteúdos, aulas e o progresso de cada turma." action="/grupos" actionLabel="Ver grupos" /><section className={styles.disciplineCard}><div className={styles.subjectIcon}><BookOpenText aria-hidden size={25} /></div><div className={styles.subjectHeading}><div><h3>Modelagem e Simulação Discreta</h3><p>Turma C8 · 2026.2 · Seg e Qua, 14h–16h</p></div><span>Em andamento</span></div><div className={styles.subjectMeta}><div><span>Próxima aula</span><strong>31 Ago · 14h–16h</strong></div><div><span>Professor</span><strong>Brauliro Gonçalves Leal</strong></div><div><span>Progresso</span><strong>45%</strong></div></div><div className={styles.subjectActions}><Link className={styles.primaryButton} href="/progresso">Ver progresso</Link><Link className={styles.outlineButton} href="/calendario">Abrir calendário</Link></div></section><section className={styles.tip}><Plus aria-hidden size={19} /><div><strong>Adicionar uma disciplina</strong><p>Deixe sua agenda completa para acompanhar as próximas aulas.</p></div><button className={styles.textButton} type="button">Em breve</button></section></div>;
}

function Header({ action, actionLabel, description, eyebrow, title }: { action?: string; actionLabel?: string; description: string; eyebrow: string; title: string }) { return <header className={styles.header}><div><p className={styles.eyebrow}>{eyebrow}</p><h2>{title}</h2><p>{description}</p></div>{action && actionLabel ? <Link className={styles.primaryButton} href={action}>{actionLabel}</Link> : null}</header>; }
