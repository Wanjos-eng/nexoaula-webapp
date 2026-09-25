"use client";

import {
  ArrowRight,
  BookOpenText,
  CalendarBlank,
  Clock,
  GraduationCap,
  Storefront,
  UsersThree,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useCallback, useMemo } from "react";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuthSession } from "@/modules/auth";
import { listMyMeetings, type Meeting } from "@/modules/groups/meetings.api";
import {
  academicGroups,
  readAll,
  type AcademicGroup,
  type Lesson,
} from "@/modules/groups/schedule";
import { useRemote } from "@/modules/groups/useRemote";
import styles from "./page.module.css";

type TutorBooking = {
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

type HomeEvent = {
  id: string;
  title: string;
  context: string;
  startsAt: string;
  href: string;
  type: "Aula" | "Encontro" | "Tutoria";
};

type HomeData = {
  groups: AcademicGroup[];
  events: HomeEvent[];
  tutoring: TutorBooking[];
};

export default function InicioPage() {
  const { user } = useAuthSession();

  const fetcher = useCallback(async (signal: AbortSignal): Promise<HomeData> => {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 45);
    const start = now.toISOString();
    const end = endDate.toISOString();

    const [groups, meetings, bookings] = await Promise.all([
      academicGroups(signal),
      listMyMeetings(start, end, signal),
      readAll<TutorBooking>("marketplace/bookings/mine", signal),
    ]);

    const lessons = groups.length
      ? await readAll<Lesson>(
          `groups/me/lessons?${new URLSearchParams({ start, end })}`,
          signal,
        )
      : [];

    const groupsById = new Map(groups.map((group) => [group.id, group]));

    const lessonEvents: HomeEvent[] = lessons.map((lesson) => {
      const group = groupsById.get(lesson.groupId);
      return {
        id: `lesson-${lesson.id}`,
        title: lesson.title,
        context: group
          ? `${group.subject} · ${group.name}`
          : "Aula agendada",
        startsAt: lesson.scheduledAt,
        href: `/grupos/${lesson.groupId}#aula-${lesson.id}`,
        type: "Aula",
      };
    });

    const meetingEvents: HomeEvent[] = meetings
      .filter((meeting) => meeting.status === "scheduled")
      .map((meeting: Meeting) => {
        const group = groupsById.get(meeting.groupId);
        return {
          id: `meeting-${meeting.id}`,
          title: meeting.title,
          context: group ? group.name : "Encontro de comunidade",
          startsAt: meeting.startsAt,
          href: `/grupos/${meeting.groupId}#encontros`,
          type: "Encontro",
        };
      });

    const upcomingTutoring = bookings.filter(
      (booking) =>
        booking.status === "confirmed" &&
        booking.session.status === "scheduled" &&
        new Date(booking.session.starts_at).getTime() >= now.getTime(),
    );

    const tutoringEvents: HomeEvent[] = upcomingTutoring
      .filter(
        (booking) =>
          new Date(booking.session.starts_at).getTime() <= endDate.getTime(),
      )
      .map((booking) => ({
        id: `tutoring-${booking.booking_id}`,
        title: booking.session.title,
        context: `${booking.session.subject_name} · ${booking.session.tutor_name}`,
        startsAt: booking.session.starts_at,
        href: `/sessoes/${booking.session_id}`,
        type: "Tutoria",
      }));

    const events = [...lessonEvents, ...meetingEvents, ...tutoringEvents]
      .filter((event) => new Date(event.startsAt).getTime() >= now.getTime())
      .sort(
        (left, right) =>
          new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
      );

    return {
      groups,
      events,
      tutoring: upcomingTutoring.sort(
        (left, right) =>
          new Date(left.session.starts_at).getTime() -
          new Date(right.session.starts_at).getTime(),
      ),
    };
  }, []);

  const remote = useRemote("home-dashboard", fetcher, true);
  const data = remote.data;
  const nextEvent = data?.events[0];
  const agenda = useMemo(() => data?.events.slice(1, 5) ?? [], [data?.events]);
  const firstName = user.fullName?.split(" ")[0] || "estudante";

  return (
    <div className={styles.page}>
      <PageHeader
        description="Acompanhe seus próximos compromissos e acesse rapidamente o que importa na sua rotina acadêmica."
        eyebrow="Visão geral"
        title={`Olá, ${firstName}`}
      />

      {remote.loading ? (
        <div className={styles.dashboard} role="status" aria-label="Carregando início">
          <span className="sr-only">Carregando seu painel...</span>
          <div className={styles.mainColumn}>
            <Skeleton variant="card" />
            <Skeleton variant="card" />
          </div>
          <div className={styles.sideColumn}>
            <Skeleton variant="card" />
            <Skeleton variant="card" />
          </div>
        </div>
      ) : remote.error ? (
        <Card className={styles.stateCard}>
          <CalendarBlank aria-hidden size={34} />
          <div>
            <h2>Não foi possível carregar seu resumo</h2>
            <p>Atualize a página ou tente novamente em instantes.</p>
          </div>
          <button className={styles.retryButton} onClick={remote.reload} type="button">
            Tentar novamente
          </button>
        </Card>
      ) : (
        <div className={styles.dashboard}>
          <div className={styles.mainColumn}>
            <section className={styles.section} aria-labelledby="next-event-title">
              <div className={styles.sectionHeading}>
                <div>
                  <p className={styles.sectionEyebrow}>Sua agenda</p>
                  <h2 id="next-event-title">Próximo compromisso</h2>
                </div>
                <Link href="/calendario">Abrir calendário</Link>
              </div>

              {nextEvent ? (
                <Card className={styles.nextCard}>
                  <div className={styles.nextTop}>
                    <Badge variant={nextEvent.type === "Tutoria" ? "info" : "success"}>
                      {nextEvent.type}
                    </Badge>
                    <time dateTime={nextEvent.startsAt}>
                      {formatLongDate(nextEvent.startsAt)}
                    </time>
                  </div>
                  <div className={styles.nextCopy}>
                    <h3>{nextEvent.title}</h3>
                    <p>{nextEvent.context}</p>
                    <span>
                      <Clock aria-hidden size={17} />
                      {formatTime(nextEvent.startsAt)}
                    </span>
                  </div>
                  <Link className={styles.primaryLink} href={nextEvent.href}>
                    Ver detalhes <ArrowRight aria-hidden size={16} />
                  </Link>
                </Card>
              ) : (
                <Card className={styles.emptyCard}>
                  <CalendarBlank aria-hidden size={32} />
                  <div>
                    <h3>Sua agenda está livre</h3>
                    <p>
                      Quando houver aulas, encontros ou tutorias confirmadas, o próximo compromisso aparecerá aqui.
                    </p>
                  </div>
                  <Link className={styles.secondaryLink} href="/calendario">
                    Ver calendário
                  </Link>
                </Card>
              )}
            </section>

            <section className={styles.section} aria-labelledby="agenda-title">
              <div className={styles.sectionHeading}>
                <div>
                  <p className={styles.sectionEyebrow}>Próximos dias</p>
                  <h2 id="agenda-title">Agenda</h2>
                </div>
              </div>

              {agenda.length ? (
                <Card className={styles.agendaCard}>
                  {agenda.map((event) => (
                    <Link className={styles.agendaRow} href={event.href} key={event.id}>
                      <div className={styles.eventIcon}>
                        {event.type === "Aula" ? (
                          <BookOpenText aria-hidden size={19} />
                        ) : event.type === "Encontro" ? (
                          <UsersThree aria-hidden size={19} />
                        ) : (
                          <GraduationCap aria-hidden size={19} />
                        )}
                      </div>
                      <div>
                        <strong>{event.title}</strong>
                        <span>{event.context}</span>
                      </div>
                      <time dateTime={event.startsAt}>
                        {formatCompactDate(event.startsAt)}
                        <small>{formatTime(event.startsAt)}</small>
                      </time>
                    </Link>
                  ))}
                </Card>
              ) : (
                <p className={styles.inlineEmpty}>
                  Nenhum outro compromisso agendado nos próximos 45 dias.
                </p>
              )}
            </section>
          </div>

          <aside className={styles.sideColumn}>
            <section className={styles.section} aria-labelledby="groups-title">
              <div className={styles.sectionHeading}>
                <div>
                  <p className={styles.sectionEyebrow}>Estudo em grupo</p>
                  <h2 id="groups-title">Minhas comunidades</h2>
                </div>
                <Link href="/grupos">Ver todas</Link>
              </div>

              {data?.groups.length ? (
                <div className={styles.compactList}>
                  {data.groups.slice(0, 3).map((group) => (
                    <Card className={styles.compactCard} key={group.id}>
                      <div>
                        <strong>{group.name}</strong>
                        <span>{group.subject}</span>
                        <small>{group.section} · {group.term}</small>
                      </div>
                      <Link href={`/grupos/${group.id}`}>Abrir</Link>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className={styles.emptyCard}>
                  <UsersThree aria-hidden size={30} />
                  <div>
                    <h3>Nenhuma comunidade ainda</h3>
                    <p>Encontre grupos relacionados às disciplinas que você estuda.</p>
                  </div>
                  <Link className={styles.secondaryLink} href="/grupos?view=discover">
                    Descobrir comunidades
                  </Link>
                </Card>
              )}
            </section>

            <section className={styles.section} aria-labelledby="tutoring-title">
              <div className={styles.sectionHeading}>
                <div>
                  <p className={styles.sectionEyebrow}>Apoio acadêmico</p>
                  <h2 id="tutoring-title">Próximas tutorias</h2>
                </div>
                <Link href="/sessoes">Explorar</Link>
              </div>

              {data?.tutoring.length ? (
                <div className={styles.compactList}>
                  {data.tutoring.slice(0, 2).map((booking) => (
                    <Card className={styles.compactCard} key={booking.booking_id}>
                      <div>
                        <strong>{booking.session.title}</strong>
                        <span>{booking.session.subject_name}</span>
                        <small>
                          {formatCompactDate(booking.session.starts_at)} · {formatTime(booking.session.starts_at)}
                        </small>
                      </div>
                      <Link href={`/sessoes/${booking.session_id}`}>Abrir</Link>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className={styles.emptyCard}>
                  <Storefront aria-hidden size={30} />
                  <div>
                    <h3>Nenhuma tutoria reservada</h3>
                    <p>Explore o marketplace quando precisar de apoio em uma disciplina.</p>
                  </div>
                  <Link className={styles.secondaryLink} href="/sessoes">
                    Explorar tutorias
                  </Link>
                </Card>
              )}
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}

function formatLongDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "long",
  });
}

function formatCompactDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
