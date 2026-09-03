import {
  emptyGroupDraft,
  validateGroup,
  type GroupDraft,
  type GroupErrors,
  type GroupStep,
} from "./schemas/group.schema";

export type CreateGroupState = {
  draft: GroupDraft;
  step: GroupStep;
  errors: GroupErrors;
};
type ChangeAction = { type: "change"; patch: Partial<GroupDraft> };
type Action =
  | ChangeAction
  | { type: "next" }
  | { type: "back" }
  | { type: "edit"; step: 1 | 2 }
  | { type: "restart" };
export function initialCreateGroupState(): CreateGroupState {
  return { draft: { ...emptyGroupDraft }, step: 1, errors: {} };
}
export function createGroupReducer(
  state: CreateGroupState,
  action: Action,
): CreateGroupState {
  switch (action.type) {
    case "restart":
      return initialCreateGroupState();
    case "change": {
      if (state.step === 4) return state;
      const draft = { ...state.draft, ...action.patch };
      const errors = { ...state.errors };
      for (const field of Object.keys(action.patch) as (keyof GroupDraft)[])
        delete errors[field];
      if (action.patch.subjectId !== undefined) {
        draft.classSectionId = "";
        delete errors.classSectionId;
      }
      return { ...state, draft, errors };
    }
    case "back":
      return state.step > 1 && state.step < 4
        ? { ...state, step: (state.step - 1) as GroupStep, errors: {} }
        : state;
    case "edit":
      return state.step === 3
        ? { ...state, step: action.step, errors: {} }
        : state;
    case "next": {
      if (state.step === 4) return state;
      const errors = validateGroup(state.draft, state.step);
      if (Object.keys(errors).length) return { ...state, errors };
      return { ...state, step: (state.step + 1) as GroupStep, errors: {} };
    }
  }
}
