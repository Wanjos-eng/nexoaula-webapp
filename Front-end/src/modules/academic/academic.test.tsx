import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { disciplinesMap, getDisciplineDetail, academicReferenceTime } from "@/mocks/academic/academicCatalog";
import { AcademicCalendarView } from "./components/AcademicCalendarView";
import { AcademicProgressView } from "./components/AcademicProgressView";
import { DisciplineDetailPage } from "./components/DisciplineDetailPage";

describe("Módulo Acadêmico", () => {
  const discipline = disciplinesMap["modelagem-simulacao"];

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
      expect(screen.getByText(/não oficiais e não alteram o plano/i)).toBeDefined();
    });

    it("permite simular a marcação de presença pessoal com feedback imediato", () => {
      render(<DisciplineDetailPage discipline={discipline} />);

      const presenceButtons = screen.getAllByRole("button", { name: "Presença" });
      expect(presenceButtons.length).toBeGreaterThan(0);

      fireEvent.click(presenceButtons[0]);

      expect(
        screen.getByText("Presença simulada no seu controle pessoal (não oficial, sem persistência)."),
      ).toBeDefined();
    });

    it("trata o estado de disciplina não encontrada de forma graciosa", () => {
      render(<DisciplineDetailPage discipline={null} />);

      expect(screen.getByRole("alert")).toBeDefined();
      expect(screen.getByRole("heading", { name: "Disciplina não encontrada" })).toBeDefined();
    });
  });

  describe("AcademicCalendarView", () => {
    it("renderiza os controles do calendário e a legenda de aulas/encontros", () => {
      render(<AcademicCalendarView />);

      expect(screen.getByRole("heading", { name: "Calendário" })).toBeDefined();
      expect(screen.getByRole("button", { name: /Hoje/ })).toBeDefined();
      expect(screen.getByText("Visão mensal")).toBeDefined();
    });
  });

  describe("AcademicProgressView", () => {
    it("exibe as disciplinas, barras de progresso e o aviso de acompanhamento não oficial", () => {
      render(<AcademicProgressView />);

      expect(screen.getByRole("heading", { name: "Meu progresso" })).toBeDefined();
      expect(
        screen.getByText(/As estatísticas e marcações exibidas aqui pertencem ao seu acompanhamento privado/i),
      ).toBeDefined();
      expect(screen.getAllByText("Modelagem e Simulação Discreta").length).toBeGreaterThan(0);

      const reviewButtons = screen.getAllByRole("button", { name: "Marcar como revisado" });
      fireEvent.click(reviewButtons[0]);

      expect(
        screen.getByText("Revisão simulada no seu progresso pessoal, sem persistência."),
      ).toBeDefined();
    });
  });
});


it("mostra planejamento sem ocorrência e separa planos da mesma turma", () => {
  const first = getDisciplineDetail("modelagem-simulacao", "comunidade-msd-c8")!;
  const second = getDisciplineDetail("modelagem-simulacao", "msd-revisao-c8")!;
  expect(first.classGroup).toBe(second.classGroup);
  expect(first.plannedLessons).not.toEqual(second.plannedLessons);
  render(<DisciplineDetailPage discipline={first} />);
  expect(screen.getByRole("heading", { name: "Análise de Desempenho e Validação de Modelos" })).toBeDefined();
  expect(screen.getByText("Aula Prevista")).toBeDefined();
});

it("recusa grupo de outra disciplina e identificadores herdados", () => {
  expect(getDisciplineDetail("modelagem-simulacao", "engenharia-software-sprint-1")).toBeNull();
  expect(getDisciplineDetail("__proto__")).toBeNull();
});

it("visitante não recebe plano nem marcações", () => {
  render(<DisciplineDetailPage discipline={{ ...disciplinesMap["modelagem-simulacao"], isMember: false }} />);
  expect(screen.getByRole("alert")).toBeDefined();
  expect(screen.queryByRole("button", { name: "Presença" })).toBeNull();
  expect(screen.queryByText("Análise de Desempenho e Validação de Modelos")).toBeNull();
});

it.each(["loading", "error"] as const)("reproduz %s em todas as jornadas", (state) => {
  const detail = render(<DisciplineDetailPage discipline={null} state={state} />);
  expect(screen.getByRole(state === "loading" ? "status" : "alert")).toBeDefined();
  detail.unmount();
  const calendar = render(<AcademicCalendarView state={state} />);
  expect(screen.getByRole(state === "loading" ? "status" : "alert")).toBeDefined();
  calendar.unmount();
  render(<AcademicProgressView state={state} />);
  expect(screen.getByRole(state === "loading" ? "status" : "alert")).toBeDefined();
});

it("mostra cronograma sem aulas e progresso vazio", () => {
  const detail = render(<DisciplineDetailPage discipline={{ ...disciplinesMap["modelagem-simulacao"], plannedLessons: [], occurrences: [] }} />);
  expect(screen.getByText("Sem aulas previstas neste grupo.")).toBeDefined();
  detail.unmount();
  render(<AcademicProgressView state="empty" />);
  expect(screen.getByText("Sem registros pessoais nos seus grupos.")).toBeDefined();
});

it("só oferece frequência para ocorrência realizada já encerrada", () => {
  const plan = disciplinesMap["modelagem-simulacao"];
  render(<DisciplineDetailPage discipline={{ ...plan, occurrences: plan.occurrences.map((occ) =>
    ({ ...occ, actualEndsAt: "2026-09-09T18:00:00-03:00" })) }} />);
  expect(screen.queryByRole("button", { name: "Presença" })).toBeNull();
  expect(academicReferenceTime).toBe("2026-09-08T12:00:00-03:00");
});
