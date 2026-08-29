"use client";

import { ArrowRight, BookOpenText, CalendarBlank, CheckCircle, Clock, NotePencil, Plus, TrendUp, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { DayPicker } from "react-day-picker";
import { ptBR } from "react-day-picker/locale";
import "react-day-picker/style.css";
import Link from "next/link";
import { useMemo, useState } from "react";

import styles from "./AcademicPage.module.css";

type AcademicPageProps = { variant: "disciplines" | "calendar" | "progress" };

const lessons = [
  { date: "31", month: "Ago", title: "Modelo Conceitual de Sistemas de Fila M/M/1 — continuação", time: "14h–16h" },
  { date: "02", month: "Set", title: "Modelo Conceitual de Sistemas de Fila M/M/1 e seus algoritmos", time: "14h–16h" },
  { date: "07", month: "Set", title: "Modelo Computacional de Fila M/M/1", time: "14h–16h" },
];

const calendarEvents: Record<string, { title: string; type: "Aula" | "Encontro"; time: string; context: string }[]> = {
  "2026-08-31": [{ title: "Modelo Conceitual de Sistemas de Fila M/M/1", type: "Aula", time: "14h–16h", context: "Modelagem e Simulação Discreta · Turma C8" }, { title: "Revisão de Filas M/M/1", type: "Encontro", time: "19h–20h", context: "Comunidade MSD — C8 · Online" }],
  "2026-09-02": [{ title: "Modelo Conceitual de Sistemas de Fila M/M/1 e seus algoritmos", type: "Aula", time: "14h–16h", context: "Modelagem e Simulação Discreta · Turma C8" }],
  "2026-09-07": [{ title: "Modelo Computacional de Fila M/M/1", type: "Aula", time: "14h–16h", context: "Modelagem e Simulação Discreta · Turma C8" }],
  "2026-09-08": [{ title: "Formulário semanal", type: "Encontro", time: "Até 23h59", context: "Sprint 1 · Entrega acadêmica" }],
};

export function AcademicPage({ variant }: AcademicPageProps) {
  if (variant === "calendar") {
    return <CalendarView />;
  }

  if (variant === "progress") {
    return <div className={styles.page}><Header eyebrow="Acompanhamento" title="Meu progresso" description="Acompanhe sua rotina e identifique o próximo conteúdo para revisar." /><div className={styles.progressGrid}><section className={styles.progressCard}><div className={styles.cardTitle}><div><p className={styles.label}>Disciplina</p><h3>Modelagem e Simulação Discreta</h3><p>C8 · 2026.2</p></div><strong>45%</strong></div><div className={styles.track}><span style={{ width: "45%" }} /></div><ul><li><CheckCircle aria-hidden size={19} /> 2 aulas realizadas</li><li><NotePencil aria-hidden size={19} /> 1 conteúdo pendente</li><li><TrendUp aria-hidden size={19} /> Frequência em dia</li></ul><Link className={styles.linkAction} href="/disciplinas">Abrir disciplina <ArrowRight aria-hidden size={16} /></Link></section><section className={styles.nextCard}><p className={styles.label}>Próximo foco</p><h3>Modelo Analítico de Sistemas de Fila M/M/1</h3><p>Reserve um tempo para revisar este conteúdo antes do próximo encontro.</p><button className={styles.outlineButton} type="button">Marcar como revisado</button></section></div></div>;
  }

  return <div className={styles.page}><Header eyebrow="Organização acadêmica" title="Minhas disciplinas" description="Centralize conteúdos, aulas e o progresso de cada turma." action="/grupos" actionLabel="Ver grupos" /><section className={styles.disciplineCard}><div className={styles.subjectIcon}><BookOpenText aria-hidden size={25} /></div><div className={styles.subjectHeading}><div><h3>Modelagem e Simulação Discreta</h3><p>Turma C8 · 2026.2 · Seg e Qua, 14h–16h</p></div><span>Em andamento</span></div><div className={styles.subjectMeta}><div><span>Próxima aula</span><strong>31 Ago · 14h–16h</strong></div><div><span>Professor</span><strong>Brauliro Gonçalves Leal</strong></div><div><span>Progresso</span><strong>45%</strong></div></div><div className={styles.subjectActions}><Link className={styles.primaryButton} href="/progresso">Ver progresso</Link><Link className={styles.outlineButton} href="/calendario">Abrir calendário</Link></div></section><section className={styles.tip}><Plus aria-hidden size={19} /><div><strong>Adicionar uma disciplina</strong><p>Deixe sua agenda completa para acompanhar as próximas aulas.</p></div><button className={styles.textButton} type="button">Em breve</button></section></div>;
}

function CalendarView() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(2026, 7, 31));
  const [month, setMonth] = useState<Date>(new Date(2026, 7, 1));
  const eventDays = useMemo(() => Object.keys(calendarEvents).map((key) => parseDateKey(key)), []);
  const selectedEvents = calendarEvents[formatDateKey(selectedDate)] ?? [];
  const selectedLabel = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(selectedDate);

  return <div className={styles.page}><Header eyebrow="Agenda acadêmica" title="Calendário" description="Visualize sua rotina inteira e abra uma data para ver tudo o que acontece naquele dia." action="/grupos/comunidade-msd-c8" actionLabel="Ver encontros" /><div className={styles.calendarLayout}><section className={styles.calendarCard} aria-label="Calendário mensal"><div className={styles.calendarHeading}><div><p className={styles.label}>Visão mensal</p><h3>Aulas e encontros</h3></div><span><CalendarBlank aria-hidden size={16} /> 2026.2</span></div><div className={styles.calendarShell}><DayPicker aria-label="Calendário acadêmico" fixedWeeks mode="single" month={month} modifiers={{ hasEvent: eventDays }} modifiersClassNames={{ hasEvent: styles.hasEvent }} onMonthChange={setMonth} onSelect={(date) => date && setSelectedDate(date)} locale={ptBR} selected={selectedDate} showOutsideDays /></div><div className={styles.calendarLegend}><span><i className={styles.dotClass} /> Aula</span><span><i className={styles.dotMeeting} /> Encontro</span><span>Selecione uma data para ver os detalhes</span></div></section><section className={styles.dayPanel} aria-live="polite"><div className={styles.dayHeading}><p className={styles.label}>Agenda do dia</p><h3>{selectedLabel.charAt(0).toUpperCase() + selectedLabel.slice(1)}</h3><span>{selectedEvents.length} {selectedEvents.length === 1 ? "item" : "itens"}</span></div>{selectedEvents.length > 0 ? <div className={styles.dayEvents}>{selectedEvents.map((event) => <article className={styles.dayEvent} key={`${event.title}-${event.time}`}><div className={event.type === "Aula" ? styles.eventIconClass : styles.eventIconMeeting}>{event.type === "Aula" ? <BookOpenText aria-hidden size={20} /> : <UsersThreeIcon />}</div><div><span className={event.type === "Aula" ? styles.eventTypeClass : styles.eventTypeMeeting}>{event.type}</span><h4>{event.title}</h4><p><Clock aria-hidden size={15} /> {event.time}</p><small>{event.context}</small></div></article>)}</div> : <div className={styles.emptyDay}><CalendarBlank aria-hidden size={25} /><h4>Nada agendado</h4><p>Esse dia está livre. Você pode usá-lo para revisar ou combinar um encontro.</p></div>}<Link className={styles.dayAction} href="/progresso">Ver meu progresso <ArrowRight aria-hidden size={15} /></Link></section></div><section className={styles.upcoming}><div className={styles.upcomingHeading}><div><p className={styles.label}>Próximas datas</p><h3>Não perca o ritmo</h3></div><Link href="/grupos/comunidade-msd-c8">Abrir comunidade <ArrowRight aria-hidden size={15} /></Link></div><div className={styles.upcomingGrid}>{lessons.map((lesson) => <button className={styles.upcomingItem} key={lesson.date} onClick={() => { const date = parseDateKey(`2026-${lesson.month === "Ago" ? "08" : "09"}-${lesson.date}`); setSelectedDate(date); setMonth(new Date(date.getFullYear(), date.getMonth(), 1)); }} type="button"><span>{lesson.month}</span><strong>{lesson.date}</strong><small>{lesson.time}</small><em>{lesson.title}</em></button>)}</div></section></div>;
}

function Header({ action, actionLabel, description, eyebrow, title }: { action?: string; actionLabel?: string; description: string; eyebrow: string; title: string }) { return <header className={styles.header}><div><p className={styles.eyebrow}>{eyebrow}</p><h2>{title}</h2><p>{description}</p></div>{action && actionLabel ? <Link className={styles.primaryButton} href={action}>{actionLabel}</Link> : null}</header>; }
function parseDateKey(key: string) { const [year, month, day] = key.split("-").map(Number); return new Date(year, month - 1, day); }
function formatDateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function UsersThreeIcon() { return <UsersThree aria-hidden size={20} />; }
