"use client";

import {
  ArrowRight,
  BookOpenText,
  CalendarBlank,
  CaretLeft,
  CaretRight,
  Clock,
  GraduationCap,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import type { DayButtonProps } from "react-day-picker";
import { ptBR } from "react-day-picker/locale";
import "react-day-picker/style.css";

import type { AcademicCalendarEvent } from "@/modules/academic/types";
import { academicGroups, readAll, type Lesson } from "@/modules/groups/schedule";
import { listMyMeetings, type Meeting } from "@/modules/groups/meetings.api";
import { useRemote } from "@/modules/groups/useRemote";
import { Failure, Loading } from "@/modules/groups/AsyncState";
import styles from "@/components/academic/AcademicPage.module.css";

type TutorBookingForCalendar = {
  booking_id: string;
  session_id: string;
  status: "confirmed" | "cancelled";
  session: {
    title: string;
    tutor_name: string;
    subject_name: string;
    starts_at: string;
    ends_at: string;
    status: "draft" | "scheduled" | "completed" | "cancelled";
  };
};

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function parseDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function AcademicCalendarView() {
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [month, setMonth] = useState<Date>(() => new Date());
  // Include outside days displayed in the six-week calendar grid.
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  first.setDate(first.getDate() - first.getDay());
  const last = new Date(first);
  last.setDate(last.getDate() + 42);
  const start = first.toISOString(), end = last.toISOString();
  const fetcher = useCallback(async (signal: AbortSignal) => {
    const [groups, meetings, bookings] = await Promise.all([
      academicGroups(signal),
      listMyMeetings(start, end, signal),
      readAll<TutorBookingForCalendar>("marketplace/bookings/mine", signal),
    ]);
    const query = new URLSearchParams({ start, end });
    const lessons = groups.length
      ? await readAll<Lesson>(`groups/me/lessons?${query}`, signal)
      : [];
    const byId = new Map(groups.map((group) => [group.id, group]));
    const lessonEvents = lessons.flatMap((lesson): AcademicCalendarEvent[] => {
      const group = byId.get(lesson.groupId);
      if (!group) return [];
      const date = new Date(lesson.scheduledAt);
      return [{
        id: lesson.id, groupName: group.name, title: lesson.title, type: "Aula",
        date: formatDateKey(date),
        time: date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        context: `${group.subject} · ${group.section} · ${group.term}`,
        occurrenceStatus: "scheduled",
        href: `/grupos/${group.id}#aula-${lesson.id}`,
      }];
    });
    const meetingEvents = meetings.flatMap((meeting): AcademicCalendarEvent[] => {
      const group = byId.get(meeting.groupId);
      if (!group) return [];
      const date = new Date(meeting.startsAt);
      return [{
        id: `meeting-${meeting.id}`,
        groupName: group.name,
        title: meeting.title,
        type: "Encontro",
        date: formatDateKey(date),
        time: `${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}${meeting.endsAt ? `–${new Date(meeting.endsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}`,
        context: `${group.subject} · ${group.section}`,
        eventStatus: meeting.status,
        href: `/grupos/${group.id}#encontros`,
      }];
    });
    const tutoringEvents = bookings.flatMap((booking): AcademicCalendarEvent[] => {
      if (booking.status !== "confirmed" || booking.session.status !== "scheduled") return [];
      const date = new Date(booking.session.starts_at);
      return [{
        id: `tutoring-${booking.booking_id}`,
        groupName: booking.session.tutor_name,
        title: booking.session.title,
        type: "Mentoria/Tutoria",
        date: formatDateKey(date),
        time: `${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}–${new Date(booking.session.ends_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
        context: booking.session.subject_name,
        eventStatus: booking.session.status,
        href: `/sessoes/${booking.session_id}`,
      }];
    });
    const events = [...lessonEvents, ...meetingEvents, ...tutoringEvents].sort(
      (left, right) => `${left.date}T${left.time}`.localeCompare(`${right.date}T${right.time}`),
    );
    return { groups, events };
  }, [start, end]);
  const remote = useRemote(`${start}/${end}`, fetcher, true);

  const eventsByDate = useMemo(() => {
    const map: Record<string, AcademicCalendarEvent[]> = {};
    (remote.data?.events ?? []).forEach((evt) => {
      if (!map[evt.date]) map[evt.date] = [];
      map[evt.date].push(evt);
    });
    return map;
  }, [remote.data]);

  const eventDays = useMemo(
    () => Object.keys(eventsByDate).map((key) => parseDateKey(key)),
    [eventsByDate],
  );

  const selectedEvents = eventsByDate[formatDateKey(selectedDate)] ?? [];
  const selectedLabel = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(selectedDate);
  const monthLabel = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(month);

  const todayLabel = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date());

  function moveMonth(offset: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  function goToToday() {
    const today = new Date();
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(today);
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Agenda acadêmica</p>
          <h2>Calendário</h2>
          <p>Aulas, encontros dos grupos ativos e mentorias com inscrição confirmada.</p>
        </div>
        <Link className={styles.primaryButton} href="/grupos">
          Ver meus grupos
        </Link>
      </header>
      <button className={styles.outlineButton} onClick={remote.reload} type="button">Atualizar calendário</button>

      {/* Toolbar */}
      <section aria-label="Controles do calendário" className={styles.calendarToolbar}>
        <div className={styles.calendarToolbarGroup}>
          <button className={styles.outlineButton} onClick={goToToday} type="button">
            Hoje ({todayLabel})
          </button>
          <div className={styles.calendarNav}>
            <button
              aria-label="Mês anterior"
              className={styles.calendarNavButton}
              onClick={() => moveMonth(-1)}
              type="button"
            >
              <CaretLeft aria-hidden size={19} />
            </button>
            <button
              aria-label="Próximo mês"
              className={styles.calendarNavButton}
              onClick={() => moveMonth(1)}
              type="button"
            >
              <CaretRight aria-hidden size={19} />
            </button>
          </div>
          <h3>{monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</h3>
        </div>
        <div className={styles.calendarViewLabel}>
          <CalendarBlank aria-hidden size={16} /> Visão mensal
        </div>
      </section>

      {/* Layout */}
      {remote.loading ? <Loading /> : remote.error ? <Failure error={remote.error} retry={remote.reload} /> : !remote.data?.groups.length && !remote.data?.events.length ? (
        <section className={styles.emptyDay} data-testid="calendar-empty-state" aria-labelledby="calendar-empty-title">
          <h2 id="calendar-empty-title">Você ainda não participa de grupos</h2>
          <p>Entre em um grupo para visualizar seus próximos encontros.</p>
          <Link className={styles.primaryButton} href="/grupos?view=discover">Descobrir grupos</Link>
        </section>
      ) : (
      <>
      <nav aria-label="Grupos no calendário">
        {remote.data.groups.map((group) => <p key={group.id}><Link href={`/grupos/${group.id}#cronograma`}>{group.name}</Link> · {group.subject} · {group.term}</p>)}
      </nav>
      <div className={styles.calendarLayout}>
        <section aria-label="Calendário mensal" className={styles.calendarBoard}>
          <div className={styles.calendarBoardHeader}>
            <div>
              <p className={styles.label}>Atividades agendadas</p>
              <p className={styles.calendarBoardHint}>
                Selecione uma data para visualizar os detalhes da agenda.
              </p>
            </div>
            <div className={styles.calendarLegend}>
              <span>
                <i className={styles.dotClass} /> Aula
              </span>
              <span><i className={styles.dotMeeting} /> Encontro</span>
              <span><i className={styles.dotTutoring} /> Mentoria/Tutoria</span>
            </div>
          </div>

          <div className={styles.calendarShell}>
            <DayPicker
              aria-label="Calendário acadêmico"
              components={{
                DayButton: (props) => (
                  <CalendarDayButton {...props} eventsByDate={eventsByDate} />
                ),
              }}
              fixedWeeks
              hideNavigation
              locale={ptBR}
              mode="single"
              modifiers={{ hasEvent: eventDays }}
              modifiersClassNames={{ hasEvent: styles.hasEvent }}
              month={month}
              onMonthChange={setMonth}
              onSelect={(date) => {
                if (date) {
                  setSelectedDate(date);
                  setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
                }
              }}
              selected={selectedDate}
              showOutsideDays
            />
          </div>
        </section>

        <aside className={styles.calendarAside}>
          <section aria-live="polite" className={styles.dayPanel}>
            <div className={styles.dayHeading}>
              <p className={styles.label}>Agenda do dia</p>
              <h3>{selectedLabel.charAt(0).toUpperCase() + selectedLabel.slice(1)}</h3>
              <span>
                {selectedEvents.length} {selectedEvents.length === 1 ? "item" : "itens"}
              </span>
            </div>

            {selectedEvents.length > 0 ? (
              <div className={styles.dayEvents}>
                {selectedEvents.map((event) => (
                  <article
                    className={styles.dayEvent}
                    key={event.id}
                  >
                    <div
                      className={
                        event.type === "Aula" || event.type === "Entrega" ? styles.eventIconClass : event.type === "Encontro" ? styles.eventIconMeeting : styles.eventIconTutoring
                      }
                    >
                      {event.type === "Aula" || event.type === "Entrega" ? (
                        <BookOpenText aria-hidden size={20} />
                      ) : event.type === "Encontro" ? (
                        <UsersThree aria-hidden size={20} />
                      ) : (
                        <GraduationCap aria-hidden size={20} />
                      )}
                    </div>
                    <div>
                      <span
                        className={
                          event.type === "Aula" || event.type === "Entrega" ? styles.eventTypeClass : event.type === "Encontro" ? styles.eventTypeMeeting : styles.eventTypeTutoring
                        }
                      >
                        {event.type}
                        {event.occurrenceStatus === "postponed"
                          ? " (Adiada)"
                          : event.occurrenceStatus === "held"
                          ? " (Realizada)"
                          : event.occurrenceStatus === "cancelled"
                          ? " (Cancelada)"
                          : event.eventStatus === "cancelled"
                          ? " (Cancelado)"
                          : event.eventStatus === "completed"
                          ? " (Encerrado)"
                          : event.eventStatus === "postponed"
                          ? " (Adiado)"
                          : ""}
                      </span>
                      <h4>{event.title}</h4>
                      <p>
                        <Clock aria-hidden size={15} /> {event.time}
                      </p>
                      <small>
                        {event.context} · {event.groupName}
                      </small>
                      {event.href ? <p><Link href={event.href}>{event.type === "Aula" ? "Detalhar aula no grupo" : event.type === "Encontro" ? "Ver encontro no grupo" : "Ver detalhes da mentoria"}</Link></p> : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.emptyDay}>
                <CalendarBlank aria-hidden size={25} />
                <h4>Dia livre</h4>
                <p>Nenhuma atividade agendada para esta data.</p>
              </div>
            )}
            <Link className={styles.dayAction} href="/disciplinas">
              Ver minhas disciplinas <ArrowRight aria-hidden size={15} />
            </Link>
          </section>
        </aside>
      </div>
      </>
      )}
    </div>
  );
}

function CalendarDayButton({
  children,
  className,
  day,
  modifiers,
  eventsByDate,
  ...buttonProps
}: DayButtonProps & { eventsByDate: Record<string, AcademicCalendarEvent[]> }) {
  const events = eventsByDate[formatDateKey(day.date)] ?? [];
  const dayClassName = [
    className,
    styles.dayButton,
    modifiers.outside ? styles.dayButtonOutside : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button {...buttonProps} className={dayClassName}>
      <span className={styles.dayNumber}>{children}</span>
      {events.slice(0, 2).map((event) => (
        <span
          className={
            event.type === "Aula" || event.type === "Entrega" ? styles.dayEventClass : event.type === "Encontro" ? styles.dayEventMeeting : styles.dayEventTutoring
          }
          key={event.id}
          title={`${event.type}: ${event.title} · ${event.time}`}
        >
          {event.time.split("–")[0]}
        </span>
      ))}
      {events.length > 2 ? (
        <span className={styles.dayEventMore}>+{events.length - 2} itens</span>
      ) : null}
    </button>
  );
}
