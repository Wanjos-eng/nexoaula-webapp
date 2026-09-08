"use client";

import {
  ArrowRight,
  BookOpenText,
  CalendarBlank,
  CaretLeft,
  CaretRight,
  Clock,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import type { DayButtonProps } from "react-day-picker";
import { ptBR } from "react-day-picker/locale";
import "react-day-picker/style.css";

import { calendarEventsList } from "@/mocks/academic/academicCatalog";
import type { AcademicCalendarEvent } from "@/modules/academic/types";
import styles from "@/components/academic/AcademicPage.module.css";

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
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(2026, 7, 31));
  const [month, setMonth] = useState<Date>(new Date(2026, 7, 1));

  const eventsByDate = useMemo(() => {
    const map: Record<string, AcademicCalendarEvent[]> = {};
    calendarEventsList.forEach((evt) => {
      if (!map[evt.date]) map[evt.date] = [];
      map[evt.date].push(evt);
    });
    return map;
  }, []);

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

  function moveMonth(offset: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  function goToToday() {
    const today = new Date(2026, 7, 31); // Anchor mock today
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(today);
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Agenda acadêmica</p>
          <h2>Calendário</h2>
          <p>Aulas, encontros de comunidades e entregas em uma visão integrada.</p>
        </div>
        <Link className={styles.primaryButton} href="/grupos/comunidade-msd-c8">
          Ver encontros de comunidades
        </Link>
      </header>

      {/* Toolbar */}
      <section aria-label="Controles do calendário" className={styles.calendarToolbar}>
        <div className={styles.calendarToolbarGroup}>
          <button className={styles.outlineButton} onClick={goToToday} type="button">
            Hoje
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
      <div className={styles.calendarLayout}>
        <section aria-label="Calendário mensal" className={styles.calendarBoard}>
          <div className={styles.calendarBoardHeader}>
            <div>
              <p className={styles.label}>Aulas e encontros</p>
              <p className={styles.calendarBoardHint}>
                Selecione uma data para visualizar os detalhes da agenda.
              </p>
            </div>
            <div className={styles.calendarLegend}>
              <span>
                <i className={styles.dotClass} /> Aula
              </span>
              <span>
                <i className={styles.dotMeeting} /> Encontro
              </span>
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
                    key={`${event.title}-${event.time}`}
                  >
                    <div
                      className={
                        event.type === "Aula"
                          ? styles.eventIconClass
                          : styles.eventIconMeeting
                      }
                    >
                      {event.type === "Aula" ? (
                        <BookOpenText aria-hidden size={20} />
                      ) : (
                        <UsersThree aria-hidden size={20} />
                      )}
                    </div>
                    <div>
                      <span
                        className={
                          event.type === "Aula"
                            ? styles.eventTypeClass
                            : styles.eventTypeMeeting
                        }
                      >
                        {event.type}
                        {event.occurrenceStatus === "postponed"
                          ? " (Adiada)"
                          : event.occurrenceStatus === "held"
                          ? " (Realizada)"
                          : ""}
                      </span>
                      <h4>{event.title}</h4>
                      <p>
                        <Clock aria-hidden size={15} /> {event.time}
                      </p>
                      <small>{event.context}</small>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.emptyDay}>
                <CalendarBlank aria-hidden size={25} />
                <h4>Dia livre</h4>
                <p>Nenhuma aula ou encontro agendado para esta data.</p>
              </div>
            )}
            <Link className={styles.dayAction} href="/progresso">
              Ver meu progresso <ArrowRight aria-hidden size={15} />
            </Link>
          </section>
        </aside>
      </div>
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
            event.type === "Aula" ? styles.dayEventClass : styles.dayEventMeeting
          }
          key={`${event.title}-${event.time}`}
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
