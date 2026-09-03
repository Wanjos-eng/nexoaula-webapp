import { academicCatalog } from "@/mocks/community/academicCatalog";

export const visibilityOptions = [
  {
    value: "public",
    label: "Público",
    hint: "Pode ser encontrado na descoberta de grupos.",
  },
  {
    value: "unlisted",
    label: "Não listado",
    hint: "Não aparece na descoberta; pode ser encontrado pelo link.",
  },
  {
    value: "private",
    label: "Privado",
    hint: "Espaço reservado, sem exibição na descoberta pública.",
  },
] as const;
export const joinPolicyOptions = [
  {
    value: "open",
    label: "Entrada livre",
    hint: "Estudantes podem participar sem aprovação, conforme a capacidade definida.",
  },
  {
    value: "approval_required",
    label: "Mediante aprovação",
    hint: "O organizador analisa cada solicitação de entrada.",
  },
  {
    value: "invite_only",
    label: "Somente por convite",
    hint: "A participação depende de um convite do organizador.",
  },
] as const;
export type GroupDraft = {
  name: string;
  subjectId: string;
  classSectionId: string;
  description: string;
  visibility: (typeof visibilityOptions)[number]["value"];
  joinPolicy: (typeof joinPolicyOptions)[number]["value"];
  capacity: string;
  rules: string;
};
export type GroupErrors = Partial<Record<keyof GroupDraft, string>>;
export type GroupStep = 1 | 2 | 3 | 4;
export const emptyGroupDraft: GroupDraft = {
  name: "",
  subjectId: "",
  classSectionId: "",
  description: "",
  visibility: "public",
  joinPolicy: "approval_required",
  capacity: "",
  rules: "",
};
// Validação da interface, não contrato de API. Regras ainda não são persistidas.
export function validateGroup(draft: GroupDraft, step: 1 | 2 | 3): GroupErrors {
  const errors: GroupErrors = {};
  if (step !== 2) {
    if (!draft.name.trim() || draft.name.trim().length > 150)
      errors.name = "Informe um nome de 1 a 150 caracteres.";
    const subject = academicCatalog.find((item) => item.id === draft.subjectId);
    if (!subject)
      errors.subjectId = "Selecione uma disciplina do catálogo demonstrativo.";
    if (
      draft.classSectionId &&
      !subject?.classes.some((item) => item.id === draft.classSectionId)
    )
      errors.classSectionId =
        "Selecione uma turma da disciplina escolhida ou deixe sem turma.";
    if (draft.description.length > 240)
      errors.description = "Use até 240 caracteres na descrição.";
  }
  if (step !== 1) {
    if (!visibilityOptions.some((item) => item.value === draft.visibility))
      errors.visibility = "Escolha a visibilidade do grupo.";
    if (!joinPolicyOptions.some((item) => item.value === draft.joinPolicy))
      errors.joinPolicy = "Escolha a política de entrada.";
    const capacity = draft.capacity.trim();
    if (
      capacity &&
      (!/^\d+$/.test(capacity) ||
        Number(capacity) < 1 ||
        Number(capacity) > 2147483647)
    )
      errors.capacity =
        "Informe um número inteiro positivo ou deixe vazio para não definir capacidade.";
    if (draft.rules.length > 500)
      errors.rules = "Use até 500 caracteres nas regras.";
  }
  return errors;
}
export function getAcademicContext(draft: GroupDraft) {
  const subject = academicCatalog.find((item) => item.id === draft.subjectId);
  const classSection = subject?.classes.find(
    (item) => item.id === draft.classSectionId,
  );
  return {
    subject: subject?.name ?? "Não informada",
    classSection: classSection
      ? `${classSection.name} · ${classSection.term}`
      : "Sem turma específica",
  };
}
