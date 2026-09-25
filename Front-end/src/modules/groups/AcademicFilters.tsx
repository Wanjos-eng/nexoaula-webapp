"use client";
import { useCallback } from "react";
import { catalog } from "./api";
import { useRemote } from "./useRemote";
import { Failure, Loading } from "./AsyncState";
import s from "./AcademicCommunity.module.css";

export const emptyFilters = {
  subject: "", period: "", topic: "", subjectId: "", classSectionId: "", teacherId: "", subjectTopicId: "",
};
export type DiscoveryFilters = typeof emptyFilters;

export function AcademicFilters({ filters, onChange }: {
  filters: DiscoveryFilters;
  onChange: (filters: DiscoveryFilters) => void;
}) {
  const fetcher = useCallback(async (signal: AbortSignal) => {
    const [subjects, sections, terms, teachers, assignments, topics, subjectTopics] = await Promise.all([
      catalog("subjects", signal), catalog("class-sections", signal), catalog("academic-terms", signal),
      catalog("teachers", signal), catalog("class-section-teachers", signal), catalog("topics", signal), catalog("subject-topics", signal),
    ]);
    return { subjects, sections, terms, teachers, assignments, topics, subjectTopics };
  }, []);
  const remote = useRemote("discovery-catalog", fetcher);
  if (remote.loading) return <Loading />;
  if (remote.error) return <Failure error={remote.error} retry={remote.reload} />;
  const data = remote.data!;
  const sections = data.sections.filter((section) => (!filters.subjectId || section.subjectId === filters.subjectId)
    && (!filters.period.trim() || data.terms.find((term) => term.id === section.academicTermId)?.label?.toLocaleLowerCase().includes(filters.period.trim().toLocaleLowerCase())));
  const teacherIds = new Set(data.assignments.filter((assignment) => sections.some((section) => section.id === assignment.classSectionId)
    && (!filters.classSectionId || assignment.classSectionId === filters.classSectionId)).map((assignment) => assignment.teacherId));
  const teachers = data.teachers.filter((teacher) => teacherIds.has(teacher.id));
  const topics = data.subjectTopics.filter((topic) => !filters.subjectId || topic.subjectId === filters.subjectId);
  return <div className={s.grid}>
    <label className={s.field}>Disciplina do catálogo
      <select value={filters.subjectId} onChange={(event) => onChange({ ...filters, subject: "", subjectId: event.target.value, classSectionId: "", teacherId: "", subjectTopicId: "" })}>
        <option value="">Todas as disciplinas</option>
        {data.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
      </select>
    </label>
    <label className={s.field}>Turma
      <select value={filters.classSectionId} onChange={(event) => {
        const section = data.sections.find((item) => item.id === event.target.value);
        onChange({ ...filters, subject: "", classSectionId: event.target.value, subjectId: section?.subjectId ?? filters.subjectId, teacherId: "", subjectTopicId: "" });
      }}>
        <option value="">{sections.length ? "Todas as turmas" : "Nenhuma turma cadastrada neste contexto"}</option>
        {sections.map((section) => <option key={section.id} value={section.id}>{section.label} · {data.subjects.find((subject) => subject.id === section.subjectId)?.name} · {data.terms.find((term) => term.id === section.academicTermId)?.label}</option>)}
      </select>
    </label>
    <label className={s.field}>Professor
      <select value={filters.teacherId} onChange={(event) => onChange({ ...filters, teacherId: event.target.value })}>
        <option value="">{teachers.length ? "Todos os professores" : "Nenhum professor vinculado neste contexto"}</option>
        {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.fullName}</option>)}
      </select>
    </label>
    <label className={s.field}>Assunto da disciplina
      <select value={filters.subjectTopicId} onChange={(event) => {
        const topic = data.subjectTopics.find((item) => item.id === event.target.value);
        onChange({ ...filters, topic: "", subject: "", subjectTopicId: event.target.value,
          subjectId: topic?.subjectId ?? filters.subjectId,
          ...(topic && topic.subjectId !== filters.subjectId ? { classSectionId: "", teacherId: "" } : {}),
        });
      }}>
        <option value="">{topics.length ? "Todos os assuntos" : "Nenhum assunto cadastrado nesta disciplina"}</option>
        {topics.map((topic) => <option key={topic.id} value={topic.id}>{data.topics.find((item) => item.id === topic.topicId)?.name} · {data.subjects.find((subject) => subject.id === topic.subjectId)?.name}</option>)}
      </select>
    </label>
  </div>;
}
