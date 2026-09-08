"use client";

import {
  ArrowRight,
  CheckCircle,
  Info,
  NotePencil,
  TrendUp,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { useState } from "react";
import { academicProgressSummaries } from "@/mocks/academic/academicCatalog";

import { AcademicPreviewState, type AcademicViewState } from "./AcademicPreviewState";
import styles from "@/components/academic/AcademicPage.module.css";

export function AcademicProgressView({ state = "ready" }: { state?: AcademicViewState }) {
  const [reviewedTopics, setReviewedTopics] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState("");

  function toggleReview(disciplineId: string) {
    const next = !reviewedTopics[disciplineId];
    setReviewedTopics((prev) => ({ ...prev, [disciplineId]: next }));
    setFeedback(next ? "Revisão simulada no seu progresso pessoal, sem persistência." : "Marcação simulada removida.");
  }

  if (state === "loading" || state === "error") return <AcademicPreviewState state={state} />;
  const summaries = state === "empty" ? [] : academicProgressSummaries;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Acompanhamento</p>
          <h2>Meu progresso</h2>
          <p>Acompanhe sua rotina pessoal de estudos e identifique o próximo conteúdo para revisar.</p>
        </div>
      </header>

      <p>Prévia demonstrativa: dados fictícios, sem persistência.</p>
      {summaries.length === 0 ? <p>Sem registros pessoais nos seus grupos.</p> : null}
      {/* Non-official Disclaimer */}
      <div className={styles.disclaimerBox} role="status">
        <Info aria-hidden size={18} />
        <div>
          <strong>Registro Pessoal e Não Oficial:</strong> As estatísticas e marcações exibidas aqui pertencem ao seu acompanhamento privado. Elas não modificam a ata oficial da instituição nem o plano de ensino compartilhado do grupo.
        </div>
      </div>

      {feedback ? (
        <p aria-live="polite" className={styles.noticeText}>
          {feedback}
        </p>
      ) : null}

      <div className={styles.progressGrid}>
        {summaries.map((summary) => {
          const isReviewed = reviewedTopics[summary.groupId];

          return (
            <section className={styles.progressCard} key={summary.groupId}>
              <div className={styles.cardTitle}>
                <div>
                  <p className={styles.label}>Disciplina</p>
                  <h3>{summary.disciplineName}</h3>
                  <p>{summary.groupName}</p>
                  <p>
                    {summary.classGroup} · {summary.period}
                  </p>
                </div>
                <strong>{summary.progressPercentage}%</strong>
              </div>

              <div className={styles.track}>
                <span style={{ width: `${summary.progressPercentage}%` }} />
              </div>

              <ul>
                <li>
                  <CheckCircle aria-hidden size={19} /> {summary.heldLessonsCount} aulas realizadas
                </li>
                <li>
                  <NotePencil aria-hidden size={19} /> {summary.pendingTopicsCount} conteúdo pendente
                </li>
                <li>
                  <TrendUp aria-hidden size={19} /> Frequência pessoal em dia (privada)
                </li>
              </ul>

              <div className={styles.nextCard}>
                <p className={styles.label}>Próximo foco</p>
                <h4>{summary.nextFocusTopic}</h4>
                <p>Reserve um tempo para revisar este conteúdo antes da próxima aula.</p>
                <button
                  className={styles.outlineButton}
                  onClick={() => toggleReview(summary.groupId)}
                  type="button"
                >
                  {isReviewed ? "✓ Revisado (Pessoal)" : "Marcar como revisado"}
                </button>
              </div>

              <Link
                className={styles.linkAction}
                href={`/disciplinas/${summary.disciplineId}?group=${summary.groupId}`}
              >
                Abrir disciplina <ArrowRight aria-hidden size={16} />
              </Link>
            </section>
          );
        })}
      </div>
    </div>
  );
}
