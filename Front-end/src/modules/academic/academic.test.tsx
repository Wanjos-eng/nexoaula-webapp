import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  academicReferenceTime,
  disciplinesMap,
  getDisciplineDetail,
} from "@/mocks/academic/academicCatalog";
import { AcademicProgressView } from "./components/AcademicProgressView";
import { DisciplineDetailPage } from "./components/DisciplineDetailPage";

let progressRemote: any;

vi.mock("@/modules/groups/useRemote", () => ({
  useRemote: () => progressRemote,
}));

vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock("./attendance", () => ({
  fetchMyAttendance: vi.fn(),
  fetchMyProgress: vi.fn(),
  updateMyProgress: vi.fn(async (topicId: string, status: string) => ({
    id: "progress-1",
    userId: "user-1",
    groupId: "group-1",
    groupTopicId: topicId,
    status,
    updatedAt: "2026-09-25T08:00:00-03:00",
  })),
}));

describe("Módulo Acadêmico", () => {
  const discipline = disciplinesMap["modelagem-simulacao"];

  beforeEach(() => {
    progressRemote = {
      data: {
        groups: [
          {
            id: "group-1",
            name: "Comunidade de Cálculo",
            subject: "Cálculo II",
            section: "T01",
            term: "2026.2",
          },
        ],
        attendance: [
          {
            id: "attendance-1",
            userId: "user-1",
            groupId: "group-1",
            lessonOccurrenceId: "occurrence-1",
            status: "present",
            recordedAt: "2026-09-25T08:00:00-03:00",
          },
        ],
        progress: [
          {
            id: "progress-1",
            userId: "user-1",
            groupId: "group-1",
            groupTopicId: "topic-1",
            status: "reviewing",
            updatedAt: "2026-09-25T08:00:00-03:00",
          },
        ],
        topicsByGroup: {
          "group-1": [
            {
              id: "topic-1",
              groupId: "group-1",
              subjectTopicId: "subject-topic-1",
              customTitle: null,
              topicName: "Integrais",
            },
            {
              id: "topic-2",
              groupId: "group-1",
              subjectTopicId: "subject-topic-2",
              customTitle: null,
              topicName: "Séries",
            },
          ],
        },
      },
      error: undefined,
      loading: false,
      reload: vi.fn(),
    };
  });

  describe("DisciplineDetailPage", () => {
    it("distingue visualmente as 3 camadas: PREVISTO, REALIZADO e MEU REGISTRO", () => {
      render(<DisciplineDetailPage discipline={discipline} />);

      expect(screen.getByText("PREVISTO")).toBeDefined();
      expect(screen.getByText("REALIZADO")).toBeDefined();
      expect(screen.getByText("MEU REGISTRO")).toBeDefined();
    });

    it("exibe o aviso explícito de registro pessoal, privado e não oficial", () => {
      render(<DisciplineDetailPage discipline={discipline} />);

      expect(
        screen.getByText(/As marcações de presença\/falta e progresso no/i),
      ).toBeDefined();
      expect(
        screen.getByText(/não oficiais e não alteram o plano/i),
      ).toBeDefined();
    });

    it("permite simular a marcação de presença pessoal com feedback imediato", () => {
      render(<DisciplineDetailPage discipline={discipline} />);

      const presenceButtons = screen.getAllByRole("button", {
        name: "Presença",
      });
      expect(presenceButtons.length).toBeGreaterThan(0);

      fireEvent.click(presenceButtons[0]);

      expect(
        screen.getByText(
          "Presença simulada no seu controle pessoal (não oficial, sem persistência).",
        ),
      ).toBeDefined();
    });

    it("trata o estado de disciplina não encontrada de forma graciosa", () => {
      render(<DisciplineDetailPage discipline={null} />);

      expect(screen.getByRole("alert")).toBeDefined();
      expect(
        screen.getByRole("heading", {
          name: "Disciplina não encontrada",
        }),
      ).toBeDefined();
    });
  });

  describe("AcademicProgressView", () => {
    it("exibe grupos, progresso persistido e aviso de acompanhamento pessoal", () => {
      render(<AcademicProgressView />);

      expect(
        screen.getByRole("heading", { name: "Meu Progresso" }),
      ).toBeDefined();
      expect(
        screen.getByText(/Este acompanhamento é pessoal/i),
      ).toBeDefined();
      expect(screen.getByText("Cálculo II")).toBeDefined();
      expect(screen.getByRole("progressbar")).toBeDefined();
      expect(
        screen.getByRole("combobox", { name: "Status de Integrais" }),
      ).toHaveValue("reviewing");
    });

    it("usa estados reais de loading, erro e vazio sem props artificiais", () => {
      progressRemote = {
        data: undefined,
        error: undefined,
        loading: true,
        reload: vi.fn(),
      };
      const loading = render(<AcademicProgressView />);
      expect(screen.getByRole("status")).toBeDefined();
      loading.unmount();

      progressRemote = {
        data: undefined,
        error: "offline",
        loading: false,
        reload: vi.fn(),
      };
      const error = render(<AcademicProgressView />);
      expect(screen.getByRole("alert")).toBeDefined();
      error.unmount();

      progressRemote = {
        data: {
          groups: [],
          attendance: [],
          progress: [],
          topicsByGroup: {},
        },
        error: undefined,
        loading: false,
        reload: vi.fn(),
      };
      render(<AcademicProgressView />);
      expect(
        screen.getByText("Sem registros de progresso ainda"),
      ).toBeDefined();
    });
  });
});

it("mostra planejamento sem ocorrência e separa planos da mesma turma", () => {
  const first = getDisciplineDetail(
    "modelagem-simulacao",
    "comunidade-msd-c8",
  )!;
  const second = getDisciplineDetail(
    "modelagem-simulacao",
    "msd-revisao-c8",
  )!;
  expect(first.classGroup).toBe(second.classGroup);
  expect(first.plannedLessons).not.toEqual(second.plannedLessons);
  render(<DisciplineDetailPage discipline={first} />);
  expect(
    screen.getByRole("heading", {
      name: "Análise de Desempenho e Validação de Modelos",
    }),
  ).toBeDefined();
  expect(screen.getByText("Aula Prevista")).toBeDefined();
});

it("recusa grupo de outra disciplina e identificadores herdados", () => {
  expect(
    getDisciplineDetail(
      "modelagem-simulacao",
      "engenharia-software-sprint-1",
    ),
  ).toBeNull();
  expect(getDisciplineDetail("__proto__")).toBeNull();
});

it("visitante não recebe plano nem marcações", () => {
  render(
    <DisciplineDetailPage
      discipline={{
        ...disciplinesMap["modelagem-simulacao"],
        isMember: false,
      }}
    />,
  );
  expect(screen.getByRole("alert")).toBeDefined();
  expect(
    screen.queryByRole("button", { name: "Presença" }),
  ).toBeNull();
  expect(
    screen.queryByText(
      "Análise de Desempenho e Validação de Modelos",
    ),
  ).toBeNull();
});

it.each(["loading", "error"] as const)(
  "reproduz %s na jornada de detalhe da disciplina",
  (state) => {
    render(
      <DisciplineDetailPage discipline={null} state={state} />,
    );
    expect(
      screen.getByRole(
        state === "loading" ? "status" : "alert",
      ),
    ).toBeDefined();
  },
);

it("mostra cronograma sem aulas", () => {
  render(
    <DisciplineDetailPage
      discipline={{
        ...disciplinesMap["modelagem-simulacao"],
        plannedLessons: [],
        occurrences: [],
      }}
    />,
  );
  expect(
    screen.getByText("Sem aulas previstas neste grupo."),
  ).toBeDefined();
});

it("só oferece frequência para ocorrência realizada já encerrada", () => {
  const plan = disciplinesMap["modelagem-simulacao"];
  render(
    <DisciplineDetailPage
      discipline={{
        ...plan,
        occurrences: plan.occurrences.map((occurrence) => ({
          ...occurrence,
          actualEndsAt: "2026-09-09T18:00:00-03:00",
        })),
      }}
    />,
  );
  expect(
    screen.queryByRole("button", { name: "Presença" }),
  ).toBeNull();
  expect(academicReferenceTime).toBe(
    "2026-09-08T12:00:00-03:00",
  );
});
