import {
  ArrowRight,
  CalendarBlank,
  CheckCircle,
  Clock,
  Hash,
  NotePencil,
  UserCheck,
  UsersThree,
  Warning,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";

import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Início",
};

const upcomingClasses = [
  {
    day: "31",
    month: "Ago",
    time: "14h–16h",
    title: "Modelo Conceitual de Sistemas de Fila M/M/1 — continuação",
  },
  {
    day: "02",
    month: "Set",
    time: "14h–16h",
    title: "Modelo Conceitual de Sistemas de Fila M/M/1 e seus algoritmos",
  },
  {
    day: "07",
    month: "Set",
    time: "14h–16h",
    title: "Modelo Computacional de Fila M/M/1 — software SF.MM1.cpp",
  },
];

export default function InicioPage() {
  return (
    <div className={styles.dashboard}>
      <div className={styles.mainColumn}>
        <section aria-labelledby="proxima-aula-title">
          <h2 className={styles.sectionTitle} id="proxima-aula-title">
            Próxima aula
          </h2>
          <article className={`${styles.card} ${styles.nextClassCard}`}>
            <div className={styles.cardHeadingRow}>
              <div>
                <h3>Modelagem e Simulação Discreta</h3>
                <p>Turma C8 • Professor: Brauliro Gonçalves Leal</p>
              </div>
              <span className={styles.statusBadge}>Programada</span>
            </div>

            <div className={styles.classSummary}>
              <time className={styles.dateTile} dateTime="2026-08-31">
                <span>Ago</span>
                <strong>31</strong>
              </time>
              <div>
                <p className={styles.timeLine}>
                  <Clock aria-hidden size={17} />
                  <strong>14h – 16h</strong>
                </p>
                <p>
                  <strong>Conteúdo:</strong> Modelo Conceitual de Sistemas de Fila M/M/1
                </p>
              </div>
            </div>

            <div className={styles.cardActions}>
              <Link className={styles.secondaryAction} href="#disciplinas">
                Abrir disciplina
              </Link>
              <Link className={styles.primaryAction} href="#calendario">
                Detalhes da aula
              </Link>
            </div>
          </article>
        </section>

        <section aria-labelledby="disciplinas-title" id="disciplinas">
          <h2 className={styles.sectionTitle} id="disciplinas-title">
            Minhas disciplinas
          </h2>
          <article className={styles.card} id="progresso">
            <div className={styles.progressHeading}>
              <div>
                <h3>Modelagem e Simulação Discreta</h3>
                <p>C8 • 2026.2 • Seg e Qua, 14h–16h</p>
              </div>
              <strong>45%</strong>
            </div>
            <div
              aria-label="Progresso da disciplina: 45 por cento"
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={45}
              className={styles.progressTrack}
              role="progressbar"
            >
              <span style={{ width: "45%" }} />
            </div>
            <ul className={styles.progressDetails}>
              <li>
                <CheckCircle aria-hidden size={20} />
                <span>2 aulas realizadas</span>
              </li>
              <li>
                <NotePencil aria-hidden size={20} />
                <span>1 conteúdo pendente</span>
              </li>
              <li>
                <UserCheck aria-hidden size={20} />
                <span>Nenhuma ausência</span>
              </li>
            </ul>
          </article>
        </section>

        <section aria-labelledby="calendario-title" id="calendario">
          <div className={styles.sectionHeadingRow}>
            <h2 className={styles.sectionTitle} id="calendario-title">
              Próximas aulas
            </h2>
            <Link href="#calendario">Abrir calendário</Link>
          </div>
          <div className={`${styles.card} ${styles.lessonList}`}>
            {upcomingClasses.map((lesson) => (
              <article className={styles.lessonRow} key={`${lesson.month}-${lesson.day}`}>
                <time className={styles.compactDate} dateTime="2026-09-02">
                  <span>{lesson.month}</span>
                  <strong>{lesson.day}</strong>
                  <small>{lesson.time}</small>
                </time>
                <div className={styles.lessonInfo}>
                  <h3>{lesson.title}</h3>
                  <span className={styles.statusBadge}>Programada</span>
                </div>
                <Link className={styles.secondaryAction} href="#calendario">
                  Detalhes da aula
                </Link>
              </article>
            ))}
          </div>
        </section>
      </div>

      <aside className={styles.sideColumn} aria-label="Resumo e alertas">
        <section className={styles.attentionCard} id="alertas">
          <div className={styles.attentionTitle}>
            <Warning aria-hidden size={22} weight="fill" />
            <h2>Requer atenção</h2>
          </div>
          <ul>
            <li>
              <strong>Aula de 27/08 adiada</strong>
              <span>Nova data ainda não informada.</span>
            </li>
            <li>
              <strong>Modelo Analítico de Sistemas de Fila M/M/1 está pendente</strong>
            </li>
          </ul>
          <Link href="#calendario">
            Detalhes da alteração <ArrowRight aria-hidden size={16} />
          </Link>
        </section>

        <section aria-labelledby="grupos-title" id="grupos">
          <h2 className={styles.sectionTitle} id="grupos-title">
            Meus grupos de estudo
          </h2>
          <article className={`${styles.card} ${styles.groupCard}`}>
            <div className={styles.groupHeading}>
              <h3>Comunidade MSD — C8</h3>
              <span>Organizador</span>
            </div>
            <p className={styles.groupStats}>
              <span>
                <UsersThree aria-hidden size={17} /> 12 membros
              </span>
              <span>
                <Hash aria-hidden size={17} /> 4 canais
              </span>
            </p>
            <div className={styles.meetingBox}>
              <span>Próximo encontro</span>
              <strong>Revisão de Filas M/M/1</strong>
              <p>
                <CalendarBlank aria-hidden size={16} /> 31/08/2026, 19h–20h • Online
              </p>
            </div>
            <div className={styles.topics}>
              <h4>Assuntos em discussão</h4>
              <Link href="#grupos"># geral</Link>
              <Link href="#grupos"># filas-mm1</Link>
              <Link href="#grupos"># modelo-analitico</Link>
            </div>
            <div className={styles.groupActions}>
              <Link className={styles.primaryAction} href="#grupos">
                Abrir grupo
              </Link>
              <Link className={styles.secondaryAction} href="#grupos">
                Detalhes do encontro
              </Link>
            </div>
          </article>
        </section>
      </aside>
    </div>
  );
}
