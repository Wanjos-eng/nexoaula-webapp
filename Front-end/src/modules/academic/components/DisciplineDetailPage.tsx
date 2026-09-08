"use client";

import {
  ArrowLeft,
  BookOpenText,
  CalendarBlank,
  CheckCircle,
  Clock,
  FileText,
  Info,
  Tag,
  UserCheck,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { useState } from "react";
import type {
  AcademicDiscipline,
  PersonalAttendanceStatus,
} from "@/modules/academic/types";

import styles from "./DisciplineDetailPage.module.css";

type DisciplineDetailPageProps = {
  discipline: AcademicDiscipline | null;
};

const tabs = ["Cronograma & Aulas", "Ementa & Plano", "Notas", "Materiais"] as const;

export function DisciplineDetailPage({ discipline }: DisciplineDetailPageProps) {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Cronograma & Aulas");
  const [personalAttendanceMap, setPersonalAttendanceMap] = useState<
    Record<string, PersonalAttendanceStatus>
  >(() => {
    if (!discipline) return {};
    const initial: Record<string, PersonalAttendanceStatus> = {};
    Object.entries(discipline.personalRecords).forEach(([occId, rec]) => {
      initial[occId] = rec.status;
    });
    return initial;
  });

  const [feedbackNotice, setFeedbackNotice] = useState("");

  if (!discipline) {
    return (
      <div className={styles.page}>
        <Link className={styles.back} href="/disciplinas">
          <ArrowLeft aria-hidden size={17} /> Voltar às disciplinas
        </Link>
        <div className={styles.singlePanel} role="alert">
          <h2>Disciplina não encontrada</h2>
          <p>A disciplina solicitada não existe ou não está disponível no seu catálogo.</p>
          <Link className={styles.back} href="/disciplinas">
            Ver todas as disciplinas
          </Link>
        </div>
      </div>
    );
  }

  function handleToggleAttendance(occurrenceId: string, status: PersonalAttendanceStatus) {
    setPersonalAttendanceMap((prev) => ({
      ...prev,
      [occurrenceId]: status,
    }));
    setFeedbackNotice(
      status === "present"
        ? "Presença registrada no seu controle pessoal (não oficial)."
        : status === "absent"
        ? "Falta registrada no seu controle pessoal (não oficial)."
        : "Registro pessoal atualizado.",
    );
  }

  return (
    <div className={styles.page}>
      <Link className={styles.back} href="/disciplinas">
        <ArrowLeft aria-hidden size={17} /> Voltar às disciplinas
      </Link>

      {/* Header */}
      <header className={styles.disciplineHeader}>
        <div className={styles.titleBlock}>
          <div>
            <h1>{discipline.name}</h1>
            <p>
              Prof. {discipline.professor} · Código: {discipline.code} · Semestre: {discipline.period} ({discipline.classGroup})
            </p>
          </div>
        </div>
        <span className={styles.activeBadge}>
          <span /> {discipline.schedule}
        </span>
        <section aria-label="Progresso do conteúdo" className={styles.progressStrip}>
          <span>Progresso do Conteúdo:</span>
          <div className={styles.progressTrack}>
            <span style={{ width: `${discipline.progressPercentage}%` }} />
          </div>
          <strong>{discipline.progressPercentage}% completo</strong>
        </section>
      </header>

      {/* Distinction Banner: PREVISTO vs REALIZADO vs MEU REGISTRO */}
      <section aria-label="Camadas de informação acadêmica" className={styles.layersBanner}>
        <div className={styles.layerCard}>
          <h4>
            <span className={styles.layerBadgePlanned}>PREVISTO</span> Plano de Ensino
          </h4>
          <p>Conteúdo e aulas planejados pelo grupo para a disciplina.</p>
        </div>
        <div className={styles.layerCard}>
          <h4>
            <span className={styles.layerBadgeOccurred}>REALIZADO</span> Ocorrência da Aula
          </h4>
          <p>Ocorrência efetiva da aula (Realizada, Cancelada ou Adiada).</p>
        </div>
        <div className={styles.layerCard}>
          <h4>
            <span className={styles.layerBadgePersonal}>MEU REGISTRO</span> Frequência Pessoal
          </h4>
          <p>Acompanhamento individual, privado e não oficial do aluno.</p>
        </div>
      </section>

      {/* Tabs */}
      <nav aria-label="Seções da disciplina" className={styles.tabs}>
        {tabs.map((tab) => (
          <button
            aria-current={activeTab === tab ? "page" : undefined}
            className={activeTab === tab ? styles.tabActive : ""}
            key={tab}
            onClick={() => setActiveTab(tab)}
            type="button"
          >
            {tab}
          </button>
        ))}
      </nav>

      {/* Disclaimer Box */}
      <div className={styles.disclaimerBox} role="status">
        <Info aria-hidden size={18} />
        <div>
          <strong>Aviso de Registro Pessoal e Privado:</strong> As marcações de presença/falta e progresso no <em>Meu Registro</em> são individuais, não oficiais e não alteram o plano de ensino do grupo nem a ata institucional.
        </div>
      </div>

      {feedbackNotice ? (
        <p aria-live="polite" className={styles.noticeText}>
          {feedbackNotice}
        </p>
      ) : null}

      {/* Tab: Cronograma & Aulas */}
      {activeTab === "Cronograma & Aulas" ? (
        <div className={styles.contentGrid}>
          <section aria-labelledby="lessons-title" className={styles.singlePanel}>
            <div className={styles.panelHeading}>
              <div>
                <p className={styles.panelKicker}>Aulas e ocorrências</p>
                <h2 id="lessons-title">Cronograma Previsto vs Realizado</h2>
              </div>
            </div>

            <div className={styles.timeline}>
              {discipline.occurrences.map((occ) => {
                const planned = discipline.plannedLessons.find(
                  (p) => p.id === occ.plannedLessonId,
                );
                const currentStatus = personalAttendanceMap[occ.id] || "unrecorded";

                const statusBadgeStyle =
                  occ.status === "held"
                    ? styles.statusHeld
                    : occ.status === "cancelled"
                    ? styles.statusCancelled
                    : styles.statusPostponed;

                const statusLabel =
                  occ.status === "held"
                    ? "Aula Realizada"
                    : occ.status === "cancelled"
                    ? "Aula Cancelada"
                    : "Aula Adiada";

                return (
                  <article className={styles.lessonCard} key={occ.id}>
                    <div className={styles.lessonHeader}>
                      <div>
                        <h3>{occ.title}</h3>
                      </div>
                      <span className={statusBadgeStyle}>{statusLabel}</span>
                    </div>

                    <div className={styles.lessonMeta}>
                      <span>
                        <CalendarBlank aria-hidden size={15} /> {occ.displayDate}
                      </span>
                      <span>
                        <Clock aria-hidden size={15} /> {occ.time}
                      </span>
                    </div>

                    {planned ? (
                      <p className={styles.lessonDesc}>{planned.description}</p>
                    ) : null}

                    {planned?.topics ? (
                      <div className={styles.topicTags}>
                        {planned.topics.map((t) => (
                          <span className={styles.topicTag} key={t}>
                            <Tag aria-hidden size={12} /> {t}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {occ.notes ? (
                      <p className={styles.lessonDesc}>
                        <em>Observação da aula: {occ.notes}</em>
                      </p>
                    ) : null}

                    {/* MEU REGISTRO Attendance Box */}
                    {occ.status === "held" ? (
                      <div className={styles.personalBox}>
                        <span>
                          <UserCheck aria-hidden size={16} /> Meu Registro (Não oficial):
                        </span>
                        <div className={styles.attendanceButtons}>
                          <button
                            className={
                              currentStatus === "present"
                                ? `${styles.attendanceBtn} ${styles.attendanceBtnActivePresent}`
                                : styles.attendanceBtn
                            }
                            onClick={() => handleToggleAttendance(occ.id, "present")}
                            type="button"
                          >
                            Presença
                          </button>
                          <button
                            className={
                              currentStatus === "absent"
                                ? `${styles.attendanceBtn} ${styles.attendanceBtnActiveAbsent}`
                                : styles.attendanceBtn
                            }
                            onClick={() => handleToggleAttendance(occ.id, "absent")}
                            type="button"
                          >
                            Falta
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className={styles.lessonDesc}>
                        <em>Frequência pessoal desabilitada para aulas adiadas ou canceladas.</em>
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          {/* Right Panel: Upcoming Activities */}
          <aside className={styles.upcomingPanel}>
            <div className={styles.panelHeading}>
              <h2>Próximas entregas</h2>
            </div>
            <div className={styles.upcomingList}>
              {discipline.evaluations.map((ev) => (
                <article key={ev.name}>
                  <span>{ev.status}</span>
                  <h3>{ev.name}</h3>
                  <p>Peso: {ev.weight} · Nota: {ev.grade}</p>
                </article>
              ))}
            </div>
          </aside>
        </div>
      ) : null}

      {/* Tab: Ementa & Plano */}
      {activeTab === "Ementa & Plano" ? (
        <section className={styles.singlePanel}>
          <div className={styles.panelHeading}>
            <div>
              <p className={styles.panelKicker}>Conteúdo programático</p>
              <h2>Ementa da Disciplina</h2>
            </div>
            <BookOpenText aria-hidden size={22} />
          </div>
          <p className={styles.lessonDesc}>
            Plano pedagógico oficial fornecido para a turma no início do período:
          </p>
          <div className={styles.topicList}>
            {discipline.syllabus.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </section>
      ) : null}

      {/* Tab: Notas */}
      {activeTab === "Notas" ? (
        <section aria-labelledby="notes-title" className={styles.notesPanel}>
          <div className={styles.panelHeading}>
            <div>
              <h2 id="notes-title">Avaliações e Notas</h2>
            </div>
          </div>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Avaliação / atividade</th>
                  <th>Peso</th>
                  <th>Nota</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {discipline.evaluations.map((ev) => (
                  <tr key={ev.name}>
                    <th scope="row">{ev.name}</th>
                    <td>{ev.weight}</td>
                    <td>{ev.grade}</td>
                    <td>
                      <span
                        className={
                          ev.status === "Entregue"
                            ? styles.statusDone
                            : styles.statusPending
                        }
                      >
                        {ev.status === "Entregue" ? (
                          <CheckCircle aria-hidden size={13} weight="fill" />
                        ) : (
                          <Clock aria-hidden size={13} />
                        )}
                        {ev.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* Tab: Materiais */}
      {activeTab === "Materiais" ? (
        <section className={styles.singlePanel}>
          <div className={styles.panelHeading}>
            <div>
              <p className={styles.panelKicker}>Arquivos</p>
              <h2>Materiais Didáticos</h2>
            </div>
            <FileText aria-hidden size={22} />
          </div>
          <div className={styles.materialList}>
            {discipline.materials.map((mat) => (
              <button key={mat.title} type="button">
                <FileText aria-hidden size={18} />
                <span>
                  <strong>{mat.title}</strong>
                  <small>
                    {mat.type} · {mat.info}
                  </small>
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
