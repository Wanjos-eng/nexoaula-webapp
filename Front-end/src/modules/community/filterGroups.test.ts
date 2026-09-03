import { describe, expect, it } from "vitest";

import { communityGroups } from "@/mocks/community/groups";

import { ALL_FILTERS, filterGroups } from "./filterGroups";

describe("filterGroups", () => {
  it("busca por nome, disciplina e assunto sem diferenciar acentos", () => {
    const byName = filterGroups(communityGroups, {
      query: "calculo",
      discipline: ALL_FILTERS,
      cohort: ALL_FILTERS,
      topic: ALL_FILTERS,
    });
    const byTopic = filterGroups(communityGroups, {
      query: "arvores",
      discipline: ALL_FILTERS,
      cohort: ALL_FILTERS,
      topic: ALL_FILTERS,
    });

    expect(byName.map((group) => group.id)).toEqual(["calculo-2-resolucao"]);
    expect(byTopic.map((group) => group.id)).toEqual(["estruturas-dados-monitoria"]);
  });

  it("combina disciplina, turma/período e assunto", () => {
    const result = filterGroups(communityGroups, {
      query: "",
      discipline: "Banco de Dados",
      cohort: "Turma A1 · 2026.2",
      topic: "PostgreSQL",
    });

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Banco de Dados com PostgreSQL");
  });
});
