import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { disciplinesMap } from "@/mocks/academic/academicCatalog";
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
        screen.getByText("Presença registrada no seu controle pessoal (não oficial)."),
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
      expect(screen.getByRole("button", { name: "Hoje" })).toBeDefined();
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
      expect(screen.getByText("Modelagem e Simulação Discreta")).toBeDefined();

      const reviewButtons = screen.getAllByRole("button", { name: "Marcar como revisado" });
      fireEvent.click(reviewButtons[0]);

      expect(
        screen.getByText("Conteúdo marcado como revisado no seu progresso pessoal."),
      ).toBeDefined();
    });
  });
});
