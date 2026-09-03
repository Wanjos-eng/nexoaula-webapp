import { describe, expect, it } from "vitest";
import {
  createGroupReducer as reduce,
  initialCreateGroupState,
} from "./createGroupState";

describe("estado da criação de grupo", () => {
  it("não avança com dados inválidos e mantém o rascunho ao voltar", () => {
    let state = initialCreateGroupState();
    expect(reduce(state, { type: "next" }).step).toBe(1);
    state = reduce(state, { type: "change", patch: { name: "Grupo ES" } });
    state = reduce(state, { type: "change", patch: { subjectId: "mock-es" } });
    state = reduce(state, { type: "next" });
    expect(state.step).toBe(2);
    expect(reduce(state, { type: "back" }).draft.name).toBe("Grupo ES");
  });
  it("limpa a turma ao trocar a disciplina", () => {
    let state = initialCreateGroupState();
    state = reduce(state, { type: "change", patch: { subjectId: "mock-msd" } });
    state = reduce(state, {
      type: "change",
      patch: { classSectionId: "mock-msd-c8" },
    });
    state = reduce(state, { type: "change", patch: { subjectId: "mock-es" } });
    expect(state.draft.classSectionId).toBe("");
  });
  it("conclusão é terminal, e reinício descarta tudo", () => {
    let state = initialCreateGroupState();
    state = reduce(state, { type: "change", patch: { name: "Grupo ES" } });
    state = reduce(state, { type: "change", patch: { subjectId: "mock-es" } });
    for (let i = 0; i < 3; i++) state = reduce(state, { type: "next" });
    expect(state.step).toBe(4);
    expect(reduce(state, { type: "next" })).toBe(state);
    expect(reduce(state, { type: "restart" })).toEqual(
      initialCreateGroupState(),
    );
  });
});
