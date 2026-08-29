"use client";

import { ArrowRight, BookOpenText, CalendarBlank, CaretDown, CaretLeft, CaretRight, CheckCircle, Clock, MagnifyingGlass, NotePencil, TrendUp, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { DayPicker } from "react-day-picker";
import { ptBR } from "react-day-picker/locale";
import type { DayButtonProps } from "react-day-picker";
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

const disciplines = [
  { name: "Modelagem e Simulação Discreta", professor: "Brauliro Gonçalves Leal", progress: 45, schedule: "Seg e Qua, 14h–16h", lessons: "2 aulas realizadas", pending: "1 conteúdo pendente", absences: "Nenhuma ausência", available: true },
  { name: "Engenharia de Software II", professor: "Ana Carolina Mota", progress: 62, schedule: "Ter e Qui, 10h–12h", lessons: "4 aulas realizadas", pending: "0 conteúdos pendentes", absences: "Nenhuma ausência", available: false },
  { name: "Banco de Dados Avançado", professor: "Ricardo Souza", progress: 30, schedule: "Sex, 8h–10h", lessons: "1 aula realizada", pending: "2 conteúdos pendentes", absences: "Nenhuma ausência", available: false },
];

export function AcademicPage({ variant }: AcademicPageProps) {
  if (variant === "disciplines") {
    return <DisciplinesView />;
  }

  if (variant === "calendar") {
    return <CalendarView />;
  }

  if (variant === "progress") {
    return <div className={styles.page}><Header eyebrow="Acompanhamento" title="Meu progresso" description="Acompanhe sua rotina e identifique o próximo conteúdo para revisar." /><div className={styles.progressGrid}><section className={styles.progressCard}><div className={styles.cardTitle}><div><p className={styles.label}>Disciplina</p><h3>Modelagem e Simulação Discreta</h3><p>C8 · 2026.2</p></div><strong>45%</strong></div><div className={styles.track}><span style={{ width: "45%" }} /></div><ul><li><CheckCircle aria-hidden size={19} /> 2 aulas realizadas</li><li><NotePencil aria-hidden size={19} /> 1 conteúdo pendente</li><li><TrendUp aria-hidden size={19} /> Frequência em dia</li></ul><Link className={styles.linkAction} href="/disciplinas/modelagem-simulacao">Abrir disciplina <ArrowRight aria-hidden size={16} /></Link></section><section className={styles.nextCard}><p className={styles.label}>Próximo foco</p><h3>Modelo Analítico de Sistemas de Fila M/M/1</h3><p>Reserve um tempo para revisar este conteúdo antes do próximo encontro.</p><button className={styles.outlineButton} type="button">Marcar como revisado</button></section></div></div>;
  }

  return null;
}

function DisciplinesView() {
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const filteredDisciplines = disciplines.filter((discipline) => discipline.name.toLowerCase().includes(query.trim().toLowerCase()));

  return <div className={`${styles.page} ${styles.disciplinesPage}`}>
    <header className={styles.disciplinesHeader}>
      <div><h2>Minhas disciplinas</h2><p>Gerencie suas disciplinas e acompanhe seu progresso acadêmico.</p></div>
      <div className={styles.disciplineControls}>
        <label className={styles.disciplineSearch}><MagnifyingGlass aria-hidden size={16} /><span className="sr-only">Buscar disciplina</span><input onChange={(event) => setQuery(event.target.value)} placeholder="Buscar disciplina..." value={query} /></label>
        <label className={styles.termFilter}><span className="sr-only">Filtrar período</span><select aria-label="Filtrar período" defaultValue="C8 · 2026.2"><option>C8 · 2026.2</option></select><CaretDown aria-hidden size={14} /></label>
      </div>
    </header>
    {filteredDisciplines.length > 0 ? <section aria-label="Disciplinas matriculadas" className={styles.disciplineGrid}>{filteredDisciplines.map((discipline) => <DisciplineTile discipline={discipline} key={discipline.name} onUnavailable={() => setNotice(`O detalhe de ${discipline.name} será conectado em uma próxima etapa.`)} />)}</section> : <div className={styles.noDisciplines}><MagnifyingGlass aria-hidden size={22} /><h3>Nenhuma disciplina encontrada</h3><p>Tente buscar por outro nome.</p></div>}
    {notice ? <p aria-live="polite" className={styles.disciplineNotice}>{notice}</p> : null}
  </div>;
}

type Discipline = (typeof disciplines)[number];

function DisciplineTile({ discipline, onUnavailable }: { discipline: Discipline; onUnavailable: () => void }) {
  const tileContent = <>
    <div className={styles.tileTop}><span className={styles.termBadge}>C8 · 2026.2</span><strong>{discipline.progress}%</strong></div>
    <h3 id={`discipline-${discipline.progress}`}>{discipline.name}</h3>
    <p className={styles.tileProfessor}>Prof. {discipline.professor}</p>
    <div aria-label={`Progresso: ${discipline.progress}%`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={discipline.progress} className={styles.tileProgress} role="progressbar"><span style={{ width: `${discipline.progress}%` }} /></div>
    <ul className={styles.tileMetrics}>
      <li><Clock aria-hidden size={18} /><span>{discipline.schedule}</span></li>
      <li><CheckCircle aria-hidden size={18} /><span>{discipline.lessons}</span></li>
      <li><NotePencil aria-hidden size={18} /><span>{discipline.pending}</span></li>
      <li><TrendUp aria-hidden size={18} /><span>{discipline.absences}</span></li>
    </ul>
    <div className={styles.tileActions}>{discipline.available ? <><Link className={styles.outlineButton} href="/disciplinas/modelagem-simulacao">Ver notas</Link><Link className={styles.primaryButton} href="/disciplinas/modelagem-simulacao">Abrir disciplina</Link></> : <><button className={styles.outlineButton} onClick={onUnavailable} type="button">Ver notas</button><button className={styles.primaryButton} onClick={onUnavailable} type="button">Abrir disciplina</button></>}</div>
  </>;

  return <article aria-labelledby={`discipline-${discipline.progress}`} className={styles.disciplineTile}>{tileContent}</article>;
}

function CalendarView() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(2026, 7, 31));
  const [month, setMonth] = useState<Date>(new Date(2026, 7, 1));
  const eventDays = useMemo(() => Object.keys(calendarEvents).map((key) => parseDateKey(key)), []);
  const selectedEvents = calendarEvents[formatDateKey(selectedDate)] ?? [];
  const selectedLabel = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(selectedDate);
  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(month);

  function moveMonth(offset: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  function goToToday() {
    const today = new Date(2026, 7, 28);
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(today);
  }

  return <div className={styles.page}><Header eyebrow="Agenda acadêmica" title="Calendário" description="Aulas, encontros e entregas organizados em uma visão mensal." action="/grupos/comunidade-msd-c8" actionLabel="Ver encontros" /><section aria-label="Controles do calendário" className={styles.calendarToolbar}><div className={styles.calendarToolbarGroup}><button className={styles.outlineButton} onClick={goToToday} type="button">Hoje</button><div className={styles.calendarNav}><button aria-label="Mês anterior" className={styles.calendarNavButton} onClick={() => moveMonth(-1)} type="button"><CaretLeft aria-hidden size={19} /></button><button aria-label="Próximo mês" className={styles.calendarNavButton} onClick={() => moveMonth(1)} type="button"><CaretRight aria-hidden size={19} /></button></div><h3>{monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</h3></div><div className={styles.calendarViewLabel}><CalendarBlank aria-hidden size={16} /> Visão mensal</div></section><div className={styles.calendarLayout}><section aria-label="Calendário mensal" className={styles.calendarBoard}><div className={styles.calendarBoardHeader}><div><p className={styles.label}>Aulas e encontros</p><p className={styles.calendarBoardHint}>Selecione uma data para abrir os detalhes.</p></div><div className={styles.calendarLegend}><span><i className={styles.dotClass} /> Aula</span><span><i className={styles.dotMeeting} /> Encontro</span></div></div><div className={styles.calendarShell}><DayPicker aria-label="Calendário acadêmico" components={{ DayButton: CalendarDayButton }} fixedWeeks hideNavigation mode="single" month={month} modifiers={{ hasEvent: eventDays }} modifiersClassNames={{ hasEvent: styles.hasEvent }} onMonthChange={setMonth} onSelect={(date) => { if (date) { setSelectedDate(date); setMonth(new Date(date.getFullYear(), date.getMonth(), 1)); } }} locale={ptBR} selected={selectedDate} showOutsideDays /></div></section><aside className={styles.calendarAside}><section className={styles.dayPanel} aria-live="polite"><div className={styles.dayHeading}><p className={styles.label}>Agenda do dia</p><h3>{selectedLabel.charAt(0).toUpperCase() + selectedLabel.slice(1)}</h3><span>{selectedEvents.length} {selectedEvents.length === 1 ? "item" : "itens"}</span></div>{selectedEvents.length > 0 ? <div className={styles.dayEvents}>{selectedEvents.map((event) => <article className={styles.dayEvent} key={`${event.title}-${event.time}`}><div className={event.type === "Aula" ? styles.eventIconClass : styles.eventIconMeeting}>{event.type === "Aula" ? <BookOpenText aria-hidden size={20} /> : <UsersThreeIcon />}</div><div><span className={event.type === "Aula" ? styles.eventTypeClass : styles.eventTypeMeeting}>{event.type}</span><h4>{event.title}</h4><p><Clock aria-hidden size={15} /> {event.time}</p><small>{event.context}</small></div></article>)}</div> : <div className={styles.emptyDay}><CalendarBlank aria-hidden size={25} /><h4>Nada agendado</h4><p>Esse dia está livre. Você pode usá-lo para revisar ou combinar um encontro.</p></div>}<Link className={styles.dayAction} href="/progresso">Ver meu progresso <ArrowRight aria-hidden size={15} /></Link></section><section className={styles.upcomingPanel}><div className={styles.upcomingHeading}><div><p className={styles.label}>Próximas datas</p><h3>Não perca o ritmo</h3></div><Link href="/grupos/comunidade-msd-c8" aria-label="Abrir comunidade"> <ArrowRight aria-hidden size={15} /></Link></div><div className={styles.upcomingList}>{lessons.map((lesson) => <button className={styles.upcomingItem} key={lesson.date} onClick={() => { const date = parseDateKey(`2026-${lesson.month === "Ago" ? "08" : "09"}-${lesson.date}`); setSelectedDate(date); setMonth(new Date(date.getFullYear(), date.getMonth(), 1)); }} type="button"><span>{lesson.month}</span><strong>{lesson.date}</strong><small>{lesson.time}</small><em>{lesson.title}</em></button>)}</div></section></aside></div></div>;
}

function CalendarDayButton({ children, className, day, modifiers, ...buttonProps }: DayButtonProps) {
  const events = calendarEvents[formatDateKey(day.date)] ?? [];
  const dayClassName = [className, styles.dayButton, modifiers.outside ? styles.dayButtonOutside : ""].filter(Boolean).join(" ");

  return <button {...buttonProps} className={dayClassName}><span className={styles.dayNumber}>{children}</span>{events.slice(0, 2).map((event) => <span className={event.type === "Aula" ? styles.dayEventClass : styles.dayEventMeeting} key={`${event.title}-${event.time}`} title={`${event.type}: ${event.title} · ${event.time}`}>{event.time.split("–")[0]}</span>)}{events.length > 2 ? <span className={styles.dayEventMore}>+{events.length - 2} itens</span> : null}</button>;
}

function Header({ action, actionLabel, description, eyebrow, title }: { action?: string; actionLabel?: string; description: string; eyebrow: string; title: string }) { return <header className={styles.header}><div><p className={styles.eyebrow}>{eyebrow}</p><h2>{title}</h2><p>{description}</p></div>{action && actionLabel ? <Link className={styles.primaryButton} href={action}>{actionLabel}</Link> : null}</header>; }
function parseDateKey(key: string) { const [year, month, day] = key.split("-").map(Number); return new Date(year, month - 1, day); }
function formatDateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function UsersThreeIcon() { return <UsersThree aria-hidden size={20} />; }
