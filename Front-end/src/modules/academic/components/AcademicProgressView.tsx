"use client";

import { Info, TrendUp } from "@phosphor-icons/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import {
  fetchMyAttendance,
  fetchMyProgress,
  updateMyProgress,
} from "../attendance";
import type {
  PersonalAttendanceRecord,
  StudentTopicProgressRecord,
  TopicProgressStatus,
} from "../types";
import {
  academicGroups,
  listGroupTopics,
  type AcademicGroup,
  type GroupTopic,
} from "@/modules/groups/schedule";
import { useRemote } from "@/modules/groups/useRemote";
import styles from "./AcademicWorkspace.module.css";

type ProgressData = {
  groups: AcademicGroup[];
  attendance: PersonalAttendanceRecord[];
  progress: StudentTopicProgressRecord[];
  topicsByGroup: Record<string, GroupTopic[]>;
};

const STATUS_LABEL: Record<TopicProgressStatus, string> = {
  pending: "Pendente",
  reviewing: "Em revisão",
  mastered: "Dominado",
};

export function AcademicProgressView() {
  const fetcher = useCallback(async (signal: AbortSignal): Promise<ProgressData> => {
    const [groups, attendance, progress] = await Promise.all([
      academicGroups(signal),
      fetchMyAttendance(undefined, signal),
      fetchMyProgress(undefined, signal),
    ]);

    const topicEntries = await Promise.all(
      groups.map(async (group) => [
        group.id,
        await listGroupTopics(group.id, signal),
      ] as const),
    );

    return {
      groups,
      attendance,
      progress,
      topicsByGroup: Object.fromEntries(topicEntries),
    };
  }, []);

  const remote = useRemote("academic-progress", fetcher, true);
  const [records, setRecords] = useState<StudentTopicProgressRecord[]>([]);
  const [busyTopic, setBusyTopic] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    if (remote.data) setRecords(remote.data.progress);
  }, [remote.data]);

  const summaries = useMemo(() => {
    if (!remote.data) return [];

    return remote.data.groups.map((group) => {
      const topics = remote.data?.topicsByGroup[group.id] ?? [];
      const groupRecords = records.filter((record) => record.groupId === group.id);
      const recordByTopic = new Map(
        groupRecords.map((record) => [record.groupTopicId, record]),
      );
      const mastered = topics.filter(
        (topic) => recordByTopic.get(topic.id)?.status === "mastered",
      ).length;
      const reviewing = topics.filter(
        (topic) => recordByTopic.get(topic.id)?.status === "reviewing",
      ).length;
      const attendance = remote.data?.attendance.filter(
        (record) => record.groupId === group.id,
      ) ?? [];
      const present = attendance.filter((record) => record.status === "present").length;
      const absent = attendance.filter((record) => record.status === "absent").length;

      return {
        group,
        topics,
        recordByTopic,
        mastered,
        reviewing,
        pending: Math.max(0, topics.length - mastered - reviewing),
        percentage: topics.length ? Math.round((mastered / topics.length) * 100) : 0,
        present,
        absent,
      };
    });
  }, [remote.data, records]);

  async function changeStatus(
    groupId: string,
    topicId: string,
    status: TopicProgressStatus,
  ) {
    if (busyTopic) return;
    setBusyTopic(topicId);

    try {
      const updated = await updateMyProgress(topicId, status);
      setRecords((current) => [
        ...current.filter((record) => record.groupTopicId !== topicId),
        updated,
      ]);
      showToast({
        message: `Progresso atualizado para ${STATUS_LABEL[status].toLowerCase()}.`,
        variant: "success",
      });
    } catch {
      showToast({
        message: "Não foi possível atualizar este tópico.",
        variant: "error",
      });
    } finally {
      setBusyTopic(null);
    }
  }

  return (
    <div className={styles.page}>
      <PageHeader
        description="Acompanhe seus registros privados de frequência e evolução nos tópicos dos grupos em que você participa."
        eyebrow="Acompanhamento pessoal"
        title="Meu Progresso"
      />

      <div className={styles.disclaimer} role="note">
        <Info aria-hidden size={19} />
        <span>
          Este acompanhamento é pessoal e não altera frequência oficial, notas ou plano de ensino da instituição.
        </span>
      </div>

      {remote.loading ? (
        <div className={styles.progressGrid} role="status" aria-label="Carregando progresso">
          <span className="sr-only">Carregando progresso...</span>
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} variant="card" />
          ))}
        </div>
      ) : remote.error ? (
        <Card className={styles.stateCard}>
          <TrendUp aria-hidden size={36} />
          <div>
            <h2>Não foi possível carregar seu progresso</h2>
            <p>Os dados não foram substituídos por conteúdo fictício.</p>
          </div>
          <Button onClick={remote.reload} size="sm" type="button" variant="secondary">
            Tentar novamente
          </Button>
        </Card>
      ) : summaries.length === 0 ? (
        <Card className={styles.stateCard}>
          <TrendUp aria-hidden size={36} />
          <div>
            <h2>Sem registros de progresso ainda</h2>
            <p>Entre em uma comunidade para começar a acompanhar tópicos e frequência pessoal.</p>
          </div>
          <Link href="/grupos?view=discover">Descobrir comunidades</Link>
        </Card>
      ) : (
        <div className={styles.progressGrid}>
          {summaries.map((summary) => (
            <Card className={styles.progressCard} key={summary.group.id}>
              <div className={styles.progressHeading}>
                <div>
                  <h2>{summary.group.subject}</h2>
                  <p>
                    {summary.group.name} · {summary.group.section} · {summary.group.term}
                  </p>
                </div>
                <strong className={styles.progressValue}>
                  {summary.percentage}%
                </strong>
              </div>

              <progress
                aria-label={`Progresso em ${summary.group.subject}: ${summary.percentage}%`}
                className={styles.track}
                max={100}
                value={summary.percentage}
              >
                {summary.percentage}%
              </progress>

              <div className={styles.metrics}>
                <Badge variant="success">{summary.mastered} dominados</Badge>
                <Badge variant="warning">{summary.reviewing} em revisão</Badge>
                <Badge>{summary.pending} pendentes</Badge>
                <Badge variant="info">
                  {summary.present} presentes · {summary.absent} ausentes
                </Badge>
              </div>

              <div className={styles.topicList}>
                <h3>Tópicos</h3>
                {summary.topics.length ? (
                  summary.topics.slice(0, 6).map((topic) => {
                    const status =
                      summary.recordByTopic.get(topic.id)?.status ?? "pending";
                    return (
                      <label className={styles.topicRow} key={topic.id}>
                        <strong>
                          {topic.topicName ?? topic.customTitle ?? "Tópico"}
                        </strong>
                        <select
                          aria-label={`Status de ${topic.topicName ?? topic.customTitle ?? "tópico"}`}
                          disabled={busyTopic === topic.id}
                          onChange={(event) =>
                            void changeStatus(
                              summary.group.id,
                              topic.id,
                              event.target.value as TopicProgressStatus,
                            )
                          }
                          value={status}
                        >
                          <option value="pending">Pendente</option>
                          <option value="reviewing">Em revisão</option>
                          <option value="mastered">Dominado</option>
                        </select>
                      </label>
                    );
                  })
                ) : (
                  <p>Nenhum tópico cadastrado nesta comunidade.</p>
                )}
              </div>

              <div className={styles.cardFooter}>
                <Link href={`/grupos/${summary.group.id}#cronograma`}>
                  Abrir comunidade
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
