"use client";

import {
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

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import type { AcademicCalendarEvent } from "@/modules/academic/types";
import { listMyMeetings, type Meeting } from "@/modules/groups/meetings.api";
import {
  academicGroups,
  readAll,
  type Lesson,
} from "@/modules/groups/schedule";
import { useRemote } from "@/modules/groups/useRemote";
import styles from "./AcademicCalendar.module.css";

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
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function category(event: AcademicCalendarEvent) {
  if (event.type === "Encontro") return "meeting";
  if (event.type === "Mentoria/Tutoria") return "tutoring";
  return "class";
}

function categoryLabel(event: AcademicCalendarEvent) {
  if (event.type === "Mentoria/Tutoria") return "Tutoria";

  if (event.type === "Encontro") {
    if (event.eventStatus === "cancelled") return "Encontro (Cancelado)";
    if (event.eventStatus === "postponed") return "Encontro (Adiado)";
    if (event.eventStatus === "completed") return "Encontro (Realizado)";
  }

  return event.type;
}

export function AcademicCalendarView() {
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [month, setMonth] = useState<Date>(() => new Date());

  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  first.setDate(first.getDate() - first.getDay());
  const last = new Date(first);
  last.setDate(last.getDate() + 42);
  const start = first.toISOString();
  const end = last.toISOString();

  const fetcher = useCallback(
    async (signal: AbortSignal) => {
      const [groups, meetings, bookings] = await Promise.all([
        academicGroups(signal),
        listMyMeetings(start, end, signal),
        readAll<TutorBookingForCalendar>(
          "marketplace/bookings/mine",
          signal,
        ),
      ]);

      const query = new URLSearchParams({ start, end });
      const lessons = groups.length
        ? await readAll<Lesson>(`groups/me/lessons?${query}`, signal)
        : [];

      const byId = new Map(groups.map((group) => [group.id, group]));

      const lessonEvents = lessons.flatMap(
        (lesson): AcademicCalendarEvent[] => {
          const group = byId.get(lesson.groupId);
          if (!group) return [];
          const date = new Date(lesson.scheduledAt);
          return [
            {
              id: lesson.id,
              groupName: group.name,
              title: lesson.title,
              type: "Aula",
              date: formatDateKey(date),
              time: date.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              }),
              context: `${group.subject} · ${group.section} · ${group.term}`,
              occurrenceStatus: "scheduled",
              href: `/grupos/${group.id}#aula-${lesson.id}`,
            },
          ];
        },
      );

      const meetingEvents = meetings.flatMap(
        (meeting: Meeting): AcademicCalendarEvent[] => {
          const group = byId.get(meeting.groupId);
          if (!group) return [];
          const date = new Date(meeting.startsAt);
          return [
            {
              id: `meeting-${meeting.id}`,
              groupName: group.name,
              title: meeting.title,
              type: "Encontro",
              date: formatDateKey(date),
              time: `${date.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}${
                meeting.endsAt
                  ? `–${new Date(meeting.endsAt).toLocaleTimeString(
                      "pt-BR",
                      {
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    )}`
                  : ""
              }`,
              context: `${group.subject} · ${group.section}`,
              eventStatus: meeting.status,
              href: `/grupos/${group.id}#encontros`,
            },
          ];
        },
      );

      const tutoringEvents = bookings.flatMap(
        (booking): AcademicCalendarEvent[] => {
          if (
            booking.status !== "confirmed" ||
            booking.session.status !== "scheduled"
          ) {
            return [];
          }

          const date = new Date(booking.session.starts_at);
          return [
            {
              id: `tutoring-${booking.booking_id}`,
              groupName: booking.session.tutor_name,
              title: booking.session.title,
              type: "Mentoria/Tutoria",
              date: formatDateKey(date),
              time: `${date.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}–${new Date(booking.session.ends_at).toLocaleTimeString(
                "pt-BR",
                { hour: "2-digit", minute: "2-digit" },
              )}`,
              context: booking.session.subject_name,
              eventStatus: booking.session.status,
              href: `/sessoes/${booking.session_id}`,
            },
          ];
        },
      );

      const events = [
        ...lessonEvents,
        ...meetingEvents,
        ...tutoringEvents,
      ].sort((left, right) =>
        `${left.date}T${left.time}`.localeCompare(
          `${right.date}T${right.time}`,
        ),
      );

      return { groups, events };
    },
    [start, end],
  );

  const remote = useRemote(`calendar-${start}/${end}`, fetcher, true);

  const eventsByDate = useMemo(() => {
    const map: Record<string, AcademicCalendarEvent[]> = {};
    (remote.data?.events ?? []).forEach((event) => {
      if (!map[event.date]) map[event.date] = [];
      map[event.date].push(event);
    });
    return map;
  }, [remote.data]);

  const eventDays = useMemo(
    () => Object.keys(eventsByDate).map(parseDateKey),
    [eventsByDate],
  );

  const selectedEvents =
    eventsByDate[formatDateKey(selectedDate)] ?? [];
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
    setMonth(
      (current) =>
        new Date(
          current.getFullYear(),
          current.getMonth() + offset,
          1,
        ),
    );
  }

  function goToToday() {
    const today = new Date();
    setMonth(
      new Date(today.getFullYear(), today.getMonth(), 1),
    );
    setSelectedDate(today);
  }

  return (
    <div className={styles.page}>
      <PageHeader
        actions={
          <Button
            onClick={remote.reload}
            size="sm"
            type="button"
            variant="secondary"
          >
            Atualizar calendário
          </Button>
        }
        description="Aulas, encontros das suas comunidades e tutorias confirmadas em uma única agenda."
        eyebrow="Agenda acadêmica"
        title="Calendário"
      />

      {remote.loading ? (
        <div className={styles.loading} role="status" aria-label="Carregando calendário">
          <span className="sr-only">Carregando calendário...</span>
          <Skeleton variant="row" />
          <div className={styles.calendarLayout}>
            <Skeleton variant="card" />
            <Skeleton variant="card" />
          </div>
        </div>
      ) : remote.error ? (
        <Card className={styles.stateCard} role="alert">
          <CalendarBlank aria-hidden size={36} />
          <div>
            <h2>Não foi possível carregar o calendário</h2>
            <p>Atualize a agenda para tentar novamente.</p>
          </div>
          <Button
            onClick={remote.reload}
            size="sm"
            type="button"
            variant="secondary"
          >
            Tentar novamente
          </Button>
        </Card>
      ) : !remote.data?.groups.length &&
        !remote.data?.events.length ? (
        <Card
          className={styles.stateCard}
          data-testid="calendar-empty-state"
        >
          <CalendarBlank aria-hidden size={38} />
          <div>
            <h2>Sua agenda está vazia</h2>
            <p>
              Aulas, encontros e tutorias confirmadas aparecerão aqui assim que fizerem parte da sua rotina.
            </p>
          </div>
          <Link
            className={styles.primaryLink}
            href="/grupos?view=discover"
          >
            Descobrir comunidades
          </Link>
        </Card>
      ) : (
        <>
          <section
            aria-label="Controles do calendário"
            className={styles.toolbar}
          >
            <div className={styles.toolbarLeft}>
              <Button
                onClick={goToToday}
                size="sm"
                type="button"
                variant="secondary"
              >
                Hoje ({todayLabel})
              </Button>
              <div className={styles.monthNav}>
                <button
                  aria-label="Mês anterior"
                  onClick={() => moveMonth(-1)}
                  type="button"
                >
                  <CaretLeft aria-hidden size={19} />
                </button>
                <button
                  aria-label="Próximo mês"
                  onClick={() => moveMonth(1)}
                  type="button"
                >
                  <CaretRight aria-hidden size={19} />
                </button>
              </div>
              <h2>
                {monthLabel.charAt(0).toUpperCase() +
                  monthLabel.slice(1)}
              </h2>
            </div>

            <div className={styles.legend} aria-label="Legenda">
              <span>
                <i className={styles.classDot} /> Aula
              </span>
              <span>
                <i className={styles.meetingDot} /> Encontro
              </span>
              <span>
                <i className={styles.tutoringDot} /> Tutoria
              </span>
            </div>
          </section>

          {remote.data.groups.length ? (
            <nav
              aria-label="Comunidades no calendário"
              className={styles.communityLinks}
            >
              {remote.data.groups.map((group) => (
                <Link
                  href={`/grupos/${group.id}#cronograma`}
                  key={group.id}
                >
                  <span>{group.name}</span>
                  <small>{group.subject} · {group.term}</small>
                </Link>
              ))}
            </nav>
          ) : null}

          <div className={styles.calendarLayout}>
            <Card className={styles.calendarBoard}>
              <div className={styles.calendarBoardHeader}>
                <div>
                  <p className={styles.label}>Atividades agendadas</p>
                  <p>
                    Selecione uma data para visualizar os detalhes.
                  </p>
                </div>
                <Badge>Visão mensal</Badge>
              </div>

              <div className={styles.calendarShell}>
                <DayPicker
                  aria-label="Calendário acadêmico"
                  components={{
                    DayButton: (props) => (
                      <CalendarDayButton
                        {...props}
                        eventsByDate={eventsByDate}
                      />
                    ),
                  }}
                  fixedWeeks
                  hideNavigation
                  locale={ptBR}
                  mode="single"
                  modifiers={{ hasEvent: eventDays }}
                  month={month}
                  onMonthChange={setMonth}
                  onSelect={(date) => {
                    if (date) {
                      setSelectedDate(date);
                      setMonth(
                        new Date(
                          date.getFullYear(),
                          date.getMonth(),
                          1,
                        ),
                      );
                    }
                  }}
                  selected={selectedDate}
                  showOutsideDays
                />
              </div>
            </Card>

            <Card className={styles.dayPanel}>
              <div className={styles.dayHeading}>
                <p className={styles.label}>Agenda do dia</p>
                <h2>
                  {selectedLabel.charAt(0).toUpperCase() +
                    selectedLabel.slice(1)}
                </h2>
                <Badge>
                  {selectedEvents.length}{" "}
                  {selectedEvents.length === 1 ? "item" : "itens"}
                </Badge>
              </div>

              {selectedEvents.length ? (
                <div className={styles.dayEvents}>
                  {selectedEvents.map((event) => {
                    const eventCategory = category(event);
                    return (
                      <article
                        className={styles.dayEvent}
                        key={event.id}
                      >
                        <div
                          className={`${styles.eventIcon} ${
                            styles[
                              `${eventCategory}Icon` as
                                | "classIcon"
                                | "meetingIcon"
                                | "tutoringIcon"
                            ]
                          }`}
                        >
                          {eventCategory === "class" ? (
                            <BookOpenText
                              aria-hidden
                              size={19}
                            />
                          ) : eventCategory === "meeting" ? (
                            <UsersThree
                              aria-hidden
                              size={19}
                            />
                          ) : (
                            <GraduationCap
                              aria-hidden
                              size={19}
                            />
                          )}
                        </div>

                        <div className={styles.eventCopy}>
                          <Badge
                            variant={
                              event.eventStatus === "cancelled"
                                ? "danger"
                                : eventCategory === "meeting"
                                  ? "warning"
                                  : eventCategory === "tutoring"
                                    ? "info"
                                    : "success"
                            }
                          >
                            {categoryLabel(event)}
                          </Badge>
                          <h3>{event.title}</h3>
                          <p>
                            <Clock aria-hidden size={15} />{" "}
                            {event.time}
                          </p>
                          <small>
                            {event.context} · {event.groupName}
                          </small>
                          {event.href ? (
                            <Link href={event.href}>
                              {eventCategory === "class"
                                ? "Detalhar aula na comunidade"
                                : eventCategory === "meeting"
                                  ? "Ver encontro na comunidade"
                                  : "Ver detalhes da tutoria"}
                            </Link>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className={styles.emptyDay}>
                  <CalendarBlank aria-hidden size={28} />
                  <h3>Dia livre</h3>
                  <p>Nenhuma atividade agendada para esta data.</p>
                </div>
              )}

              <Link className={styles.dayAction} href="/disciplinas">
                Ver minhas disciplinas
              </Link>
            </Card>
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
}: DayButtonProps & {
  eventsByDate: Record<string, AcademicCalendarEvent[]>;
}) {
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
          className={`${styles.dayEventChip} ${
            styles[
              `${category(event)}Chip` as
                | "classChip"
                | "meetingChip"
                | "tutoringChip"
            ]
          }`}
          key={event.id}
          title={`${categoryLabel(event)}: ${event.title} · ${event.time}`}
        >
          {event.time.split("–")[0]}
        </span>
      ))}

      {events.length > 2 ? (
        <span className={styles.moreEvents}>
          +{events.length - 2}
        </span>
      ) : null}
    </button>
  );
}
