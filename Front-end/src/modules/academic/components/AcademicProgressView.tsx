"use client";

import {
  ArrowRight,
  CheckCircle,
  Info,
  NotePencil,
  TrendUp,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { useEffect, useState } from "react";
import { academicProgressSummaries } from "@/mocks/academic/academicCatalog";
import { fetchMyAttendance, fetchMyProgress, updateMyProgress } from "../attendance";
import { academicGroups, type AcademicGroup } from "@/modules/groups/schedule";
import type { PersonalAttendanceRecord, StudentTopicProgressRecord } from "../types";
import { AcademicPreviewState, type AcademicViewState } from "./AcademicPreviewState";
import styles from "@/components/academic/AcademicPage.module.css";

export function AcademicProgressView({ state = "ready" }: { state?: AcademicViewState }) {
  const [reviewedTopics, setReviewedTopics] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState("");
  const [realGroups, setRealGroups] = useState<AcademicGroup[] | null>(null);
  const [attendances, setAttendances] = useState<PersonalAttendanceRecord[]>([]);
  const [progressRecords, setProgressRecords] = useState<StudentTopicProgressRecord[]>([]);

  useEffect(() => {
    if (state !== "ready") return;
    let active = true;
    Promise.all([
      academicGroups().catch(() => []),
      fetchMyAttendance().catch(() => []),
      fetchMyProgress().catch(() => []),
    ]).then(([groups, atts, progs]) => {
      if (!active) return;
      if (groups && groups.length > 0) {
        setRealGroups(groups);
      }
      setAttendances(atts || []);
      setProgressRecords(progs || []);
    });
    return () => {
      active = false;
    };
  }, [state]);

  async function toggleReview(groupId: string, topicId?: string) {
    const next = !reviewedTopics[groupId];
    setReviewedTopics((prev) => ({ ...prev, [groupId]: next }));

    if (topicId) {
      try {
        const nextStatus = next ? "mastered" : "pending";
        const updated = await updateMyProgress(topicId, nextStatus);
        setProgressRecords((prev) => [
          ...prev.filter((p) => p.groupTopicId !== topicId),
          updated,
        ]);
        setFeedback(next ? "Tópico marcado como dominado no seu progresso pessoal." : "Marcação de progresso removida.");
        return;
      } catch {
        // fallback
      }
    }

    setFeedback(next ? "Revisão simulada no seu progresso pessoal, sem persistência." : "Marcação simulada removida.");
  }

  if (state === "loading" || state === "error") return <AcademicPreviewState state={state} />;
  if (state === "empty") {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Acompanhamento</p>
            <h2>Meu progresso</h2>
            <p>Acompanhe sua rotina pessoal de estudos e identifique o próximo conteúdo para revisar.</p>
          </div>
        </header>
        <p>Sem registros pessoais nos seus grupos.</p>
      </div>
    );
  }

  // Calculate summaries: prefer real data if loaded, otherwise fallback to academicProgressSummaries
  const summaries = realGroups && realGroups.length > 0
    ? realGroups.map((g) => {
        const groupAtts = attendances.filter((a) => a.groupId === g.id);
        const groupProgs = progressRecords.filter((p) => p.groupId === g.id);
        const heldCount = groupAtts.filter((a) => a.status === "present").length;
        const masteredCount = groupProgs.filter((p) => p.status === "mastered").length;
        const pendingCount = groupProgs.filter((p) => p.status !== "mastered").length;
        const totalTopics = groupProgs.length;
        const progressPercentage = totalTopics > 0 ? Math.round((masteredCount / totalTopics) * 100) : 0;
        const nextFocus = groupProgs.find((p) => p.status === "pending")?.notes || "Revisão dos conceitos fundamentais";

        return {
          groupId: g.id,
          groupName: g.name,
          disciplineId: g.disciplineId,
          disciplineName: g.subject,
          classGroup: g.section,
          period: g.term,
          progressPercentage,
          heldLessonsCount: heldCount,
          pendingTopicsCount: pendingCount,
          nextFocusTopic: nextFocus,
        };
      })
    : academicProgressSummaries;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Acompanhamento</p>
          <h2>Meu progresso</h2>
          <p>Acompanhe sua rotina pessoal de estudos e identifique o próximo conteúdo para revisar.</p>
        </div>
      </header>

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
