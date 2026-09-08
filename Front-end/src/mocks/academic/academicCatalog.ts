import type {
  AcademicCalendarEvent,
  AcademicDiscipline,
  AcademicProgressSummary,
} from "@/modules/academic/types";

export const disciplinesMap: Record<string, AcademicDiscipline> = {
  "modelagem-simulacao": {
    id: "modelagem-simulacao",
    groupId: "comunidade-msd-c8", groupName: "Comunidade MSD — C8", isMember: true,
    code: "CS-401",
    name: "Modelagem e Simulação Discreta",
    professor: "Brauliro Gonçalves Leal",
    period: "2026.2",
    classGroup: "Turma C8",
    schedule: "Seg e Qua, 14h–16h",
    progressPercentage: 45,
    totalLessons: 16,
    heldLessons: 2,
    pendingTopicsCount: 1,
    absencesCount: 0,
    available: true,
    syllabus: [
      "Fundamentos de modelagem e simulação de sistemas discretos",
      "Processos de chegada e atendimento",
      "Modelos de filas M/M/1 e análise de desempenho",
      "Simulação de eventos discretos com SimPy/Arena",
      "Interpretação de resultados e validação de modelos",
    ],
    materials: [
      { title: "Plano de ensino da disciplina", type: "PDF", info: "Atualizado em 20/08/2026" },
      { title: "Roteiro — filas M/M/1", type: "Documento", info: "4 páginas" },
      { title: "Lista de exercícios 1 — Processos Estocásticos", type: "PDF", info: "6 exercícios" },
    ],
    evaluations: [
      { name: "P1 - Prova Teórica 1", weight: "30%", grade: "8.5", status: "Entregue" },
      { name: "P2 - Prova Teórica 2", weight: "30%", grade: "9.0", status: "Entregue" },
      { name: "Trabalho 1 - Prático de Simulação", weight: "15%", grade: "8.0", status: "Entregue" },
      { name: "Trabalho 2 - Projeto Final", weight: "15%", grade: "--", status: "Pendente" },
      { name: "Lista de Exercícios M/M/1", weight: "10%", grade: "10.0", status: "Entregue" },
    ],
    plannedLessons: [
      { id: "plan-cancelled", sequenceNumber: 5, title: "Laboratório de validação",
        description: "Aplicação prática do conteúdo.", topics: ["Validação"], estimatedHours: 2 },
      {
        id: "plan-1",
        sequenceNumber: 1,
        title: "Introdução à Simulação Discreta e Variáveis de Estado",
        description: "Conceitos fundamentais de sistemas discretos, variáveis de estado e tempo de simulação.",
        topics: ["Sistemas discretos", "Entidades", "Relógio de simulação"],
        estimatedHours: 2,
      },
      {
        id: "plan-2",
        sequenceNumber: 2,
        title: "Modelo Conceitual de Sistemas de Fila M/M/1",
        description: "Estrutura do modelo M/M/1, hipóteses de Poisson e taxas de chegada/serviço.",
        topics: ["Hipótese de Poisson", "Taxa lambda/mu", "Equação de Little"],
        estimatedHours: 2,
      },
      {
        id: "plan-3",
        sequenceNumber: 3,
        title: "Modelo Computacional de Fila M/M/1 em Python",
        description: "Implementação prática de geradores aleatórios e filas usando SimPy.",
        topics: ["SimPy", "Eventos discretos", "Gerador de números pseudoaleatórios"],
        estimatedHours: 2,
      },
      {
        id: "plan-4",
        sequenceNumber: 4,
        title: "Análise de Desempenho e Validação de Modelos",
        description: "Intervalos de confiança, estado estacionário e calibração de resultados.",
        topics: ["Estado estacionário", "Intervalo de confiança"],
        estimatedHours: 2,
      },
    ],
    occurrences: [
      { id: "occ-cancelled", plannedLessonId: "plan-cancelled", title: "Laboratório de validação",
        date: "2026-09-04", displayDate: "04/09/2026", time: "14h–16h", status: "cancelled",
        notes: "Encontro cancelado neste exemplo; nenhuma presença pode ser registrada." },
      {
        id: "occ-1",
        plannedLessonId: "plan-1",
        title: "Introdução à Simulação Discreta e Variáveis de Estado",
        date: "2026-08-24",
        actualStartsAt: "2026-08-24T14:00:00-03:00",
        actualEndsAt: "2026-08-24T16:00:00-03:00",
        displayDate: "24/08/2026",
        time: "14h–16h",
        status: "held",
        notes: "Aula realizada normalmente no laboratório.",
      },
      {
        id: "occ-2",
        plannedLessonId: "plan-2",
        title: "Modelo Conceitual de Sistemas de Fila M/M/1",
        date: "2026-08-31",
        actualStartsAt: "2026-08-31T14:00:00-03:00",
        actualEndsAt: "2026-08-31T16:00:00-03:00",
        displayDate: "31/08/2026",
        time: "14h–16h",
        status: "held",
        notes: "Discussão das fórmulas de Little e exemplo prático.",
      },
      {
        id: "occ-3",
        plannedLessonId: "plan-3",
        title: "Modelo Computacional de Fila M/M/1 em Python",
        date: "2026-09-07",
        displayDate: "07/09/2026",
        time: "14h–16h",
        status: "postponed",
        notes: "Adiada para o dia 09/09 devido ao feriado nacional.",
      },
    ],
    personalRecords: {
      "occ-1": { id: "rec-1", lessonOccurrenceId: "occ-1", status: "present", recordedAt: "24/08/2026 16:15", isPrivate: true },
      "occ-3": { id: "rec-3", lessonOccurrenceId: "occ-3", status: "unrecorded", isPrivate: true },
    },
  },
  "engenharia-software-ii": {
    id: "engenharia-software-ii",
    groupId: "engenharia-software-sprint-1", groupName: "Engenharia de Software · Sprint 1", isMember: true,
    code: "CS-402",
    name: "Engenharia de Software II",
    professor: "Ana Carolina Mota",
    period: "2026.2",
    classGroup: "Turma ES3",
    schedule: "Ter e Qui, 10h–12h",
    progressPercentage: 62,
    totalLessons: 20,
    heldLessons: 4,
    pendingTopicsCount: 0,
    absencesCount: 0,
    available: true,
    syllabus: [
      "Metodologias Ágeis e Scrum avançado",
      "Arquitetura de Software e Padrões de Projeto",
      "Testes automatizados e CI/CD",
    ],
    materials: [
      { title: "Guia Scrum 2026", type: "PDF", info: "Documento oficial" },
    ],
    evaluations: [
      { name: "Sprint 1", weight: "20%", grade: "9.5", status: "Entregue" },
    ],
    plannedLessons: [
      {
        id: "es-p1",
        sequenceNumber: 1,
        title: "Requisitos de Software e Histórias de Usuário",
        description: "Critérios de aceite e refinamento de backlog.",
        topics: ["User Stories", "Definition of Done"],
        estimatedHours: 2,
      },
    ],
    occurrences: [
      {
        id: "es-occ-1",
        plannedLessonId: "es-p1",
        title: "Requisitos de Software e Histórias de Usuário",
        date: "2026-08-25",
        actualStartsAt: "2026-08-25T10:00:00-03:00",
        actualEndsAt: "2026-08-25T12:00:00-03:00",
        displayDate: "25/08/2026",
        time: "10h–12h",
        status: "held",
      },
    ],
    personalRecords: {
      "es-occ-1": { id: "es-rec-1", lessonOccurrenceId: "es-occ-1", status: "present", isPrivate: true },
    },
  },
  "banco-dados-avancado": {
    id: "banco-dados-avancado",
    groupId: "banco-dados-estudos", groupName: "Banco de Dados — Estudos", isMember: true,
    code: "CS-403",
    name: "Banco de Dados Avançado",
    professor: "Ricardo Souza",
    period: "2026.2",
    classGroup: "Turma A1",
    schedule: "Sex, 8h–10h",
    progressPercentage: 30,
    totalLessons: 14,
    heldLessons: 1,
    pendingTopicsCount: 2,
    absencesCount: 0,
    available: true,
    syllabus: [
      "Modelagem Relacional avançada e Normalização 4FN/5FN",
      "Otimização de Consultas SQL e Índices B-Tree",
      "Transações, ACID e Controle de Concorrência",
    ],
    materials: [
      { title: "Manual de Tuning PostgreSQL", type: "PDF", info: "Capítulo 4" },
    ],
    evaluations: [
      { name: "Prova Prática SQL", weight: "40%", grade: "8.0", status: "Entregue" },
    ],
    plannedLessons: [
      {
        id: "bd-p1",
        sequenceNumber: 1,
        title: "Índices PostgreSQL e Planos de Execução EXPLAIN",
        description: "Estruturas B-Tree, Hash e análise de custo de query.",
        topics: ["PostgreSQL", "EXPLAIN ANALYZE"],
        estimatedHours: 2,
      },
    ],
    occurrences: [
      {
        id: "bd-occ-1",
        plannedLessonId: "bd-p1",
        title: "Índices PostgreSQL e Planos de Execução EXPLAIN",
        date: "2026-08-28",
        actualStartsAt: "2026-08-28T08:00:00-03:00",
        actualEndsAt: "2026-08-28T10:00:00-03:00",
        displayDate: "28/08/2026",
        time: "08h–10h",
        status: "held",
      },
    ],
    personalRecords: {
      "bd-occ-1": { id: "bd-rec-1", lessonOccurrenceId: "bd-occ-1", status: "present", isPrivate: true },
    },
  },
};

export const calendarEventsList: AcademicCalendarEvent[] = [
  {
    id: "cal-1",
    groupName: "Comunidade MSD — C8",
    title: "Modelo Conceitual de Sistemas de Fila M/M/1",
    type: "Aula",
    date: "2026-08-31",
    time: "14h–16h",
    context: "Modelagem e Simulação Discreta · Turma C8",
    occurrenceStatus: "held",
    href: "/disciplinas/modelagem-simulacao",
  },
  {
    id: "cal-2",
    groupName: "Comunidade MSD — C8",
    title: "Revisão de Filas M/M/1",
    type: "Encontro",
    date: "2026-08-31",
    time: "19h–20h",
    context: "Comunidade MSD — C8 · Online",
    href: "/grupos/comunidade-msd-c8",
  },
  {
    id: "cal-3",
    groupName: "Comunidade MSD — C8",
    title: "Modelo Conceitual de Sistemas de Fila M/M/1 e seus algoritmos",
    type: "Aula",
    date: "2026-09-02",
    time: "14h–16h",
    context: "Modelagem e Simulação Discreta · Turma C8",
    occurrenceStatus: "held",
    href: "/disciplinas/modelagem-simulacao",
  },
  {
    id: "cal-4",
    groupName: "Comunidade MSD — C8",
    title: "Modelo Computacional de Fila M/M/1",
    type: "Aula",
    date: "2026-09-07",
    time: "14h–16h",
    context: "Modelagem e Simulação Discreta · Turma C8",
    occurrenceStatus: "postponed",
    href: "/disciplinas/modelagem-simulacao",
  },
  {
    id: "cal-5",
    groupName: "Engenharia de Software · Sprint 1",
    title: "Entrega do Projeto Sprint 1",
    type: "Entrega",
    date: "2026-09-08",
    time: "Até 23h59",
    context: "Engenharia de Software II · Turma ES3",
    href: "/disciplinas/engenharia-software-ii",
  },
];


export const academicReferenceTime = "2026-09-08T12:00:00-03:00";

// Each plan is owned by a group, including two independent plans for the same class.
export const groupPlans: AcademicDiscipline[] = [
  ...Object.values(disciplinesMap),
  {
    ...disciplinesMap["modelagem-simulacao"],
    groupId: "msd-revisao-c8", groupName: "MSD — Revisão C8", isMember: true,
    syllabus: ["Revisão independente de simulação da Turma C8"],
    plannedLessons: [{ id: "revisao-1", sequenceNumber: 1, title: "Revisão de simulação em dupla",
      description: "Plano próprio deste grupo, independente da Comunidade MSD.", topics: ["Revisão"], estimatedHours: 2 }],
    occurrences: [], personalRecords: {}, progressPercentage: 0, heldLessons: 0,
  },
];

export const academicProgressSummaries: AcademicProgressSummary[] = groupPlans
  .filter((plan) => plan.isMember)
  .map((plan) => ({
    groupId: plan.groupId, groupName: plan.groupName, disciplineId: plan.id,
    disciplineName: plan.name, classGroup: plan.classGroup, period: plan.period,
    progressPercentage: plan.progressPercentage,
    heldLessonsCount: plan.occurrences.filter((item) => item.status === "held").length,
    pendingTopicsCount: plan.pendingTopicsCount,
    attendanceStatusLabel: "Frequência pessoal registrada (não oficial)",
    nextFocusTopic: plan.plannedLessons.at(-1)?.title ?? "Nenhum conteúdo previsto",
  }));

export function getDisciplineDetail(id: string, groupId?: string): AcademicDiscipline | null {
  return groupPlans.find((plan) => plan.id === id && plan.isMember && (!groupId || plan.groupId === groupId)) ?? null;
}

export function getAllDisciplines(): AcademicDiscipline[] {
  return groupPlans.filter((plan) => plan.isMember);
}

export function getDisciplinePreview(id: string, groupId?: string, state?: string): AcademicDiscipline | null {
  const plan = getDisciplineDetail(id, groupId);
  if (!plan) return null;
  if (state === "empty") return { ...plan, plannedLessons: [], occurrences: [], personalRecords: {} };
  if (state === "restricted") return { ...plan, isMember: false };
  return plan;
}
