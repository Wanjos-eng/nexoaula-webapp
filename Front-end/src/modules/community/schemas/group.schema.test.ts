import { describe, expect, it } from "vitest";
import {
  emptyGroupDraft,
  validateGroup,
  type GroupDraft,
} from "./group.schema";

const valid: GroupDraft = {
  ...emptyGroupDraft,
  name: "Estudos de MSD",
  subjectId: "mock-msd",
};
describe("validação do rascunho de grupo", () => {
  it("exige nome não vazio e disciplina conhecida", () => {
    expect(
      validateGroup({ ...emptyGroupDraft, name: "   " }, 1),
    ).toHaveProperty("name");
    expect(
      validateGroup({ ...valid, subjectId: "inexistente" }, 1),
    ).toHaveProperty("subjectId");
  });
  it("aceita turma opcional, mas rejeita turma de outra disciplina", () => {
    expect(validateGroup(valid, 3)).toEqual({});
    expect(
      validateGroup({ ...valid, classSectionId: "mock-es-c1" }, 1),
    ).toHaveProperty("classSectionId");
    expect(
      validateGroup({ ...valid, classSectionId: "mock-msd-c8" }, 1),
    ).toEqual({});
  });
  it.each(["", "1", "20", "1000", "2147483647"])(
    "aceita capacidade %s sem limite premium",
    (capacity) => {
      expect(validateGroup({ ...valid, capacity }, 2)).toEqual({});
    },
  );
  it.each(["0", "-1", "2.5", "1e2", "abc", "2147483648"])(
    "rejeita capacidade %s",
    (capacity) => {
      expect(validateGroup({ ...valid, capacity }, 2)).toHaveProperty(
        "capacity",
      );
    },
  );
  it("limita textos e valida novamente o resumo completo", () => {
    const errors = validateGroup(
      {
        ...valid,
        name: "x".repeat(151),
        description: "x".repeat(241),
        rules: "x".repeat(501),
      },
      3,
    );
    expect(Object.keys(errors)).toEqual(["name", "description", "rules"]);
  });
  it("não confunde visibilidade e política de entrada", () => {
    expect(
      validateGroup(
        { ...valid, visibility: "public", joinPolicy: "approval_required" },
        3,
      ),
    ).toEqual({});
    expect(
      validateGroup(
        { ...valid, visibility: "unlisted", joinPolicy: "invite_only" },
        3,
      ),
    ).toEqual({});
  });
});
