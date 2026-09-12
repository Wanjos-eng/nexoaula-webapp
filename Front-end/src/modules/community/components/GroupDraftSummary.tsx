import {
  getAcademicContext,
  joinPolicyOptions,
  visibilityOptions,
  type GroupDraft,
} from "../schemas/group.schema";
import styles from "./CreateGroupFlow.module.css";

export function GroupDraftSummary({
  draft,
  onEdit,
}: {
  draft: GroupDraft;
  onEdit?: (step: 1 | 2) => void;
}) {
  const academic = getAcademicContext(draft);
  const sections = [
    {
      step: 1 as const,
      title: "Informações do grupo",
      rows: [
        ["Nome", draft.name.trim()],
        ["Disciplina", academic.subject],
        ["Turma e período", academic.classSection],
        ["Descrição", draft.description.trim() || "Não informada"],
      ],
    },
    {
      step: 2 as const,
      title: "Acesso e participação",
      rows: [
        [
          "Visibilidade",
          visibilityOptions.find((item) => item.value === draft.visibility)
            ?.label ?? "Não informada",
        ],
        [
          "Política de entrada",
          joinPolicyOptions.find((item) => item.value === draft.joinPolicy)
            ?.label ?? "Não informada",
        ],
        [
          "Capacidade",
          draft.capacity.trim()
            ? `${Number(draft.capacity)} participantes (incluindo organizador)`
            : "Sem capacidade definida",
        ],
        ["Regras", draft.rules.trim() || "Nenhuma regra adicional informada"],
      ],
    },
  ];
  return sections.map((section) => (
    <section className={styles.reviewBlock} key={section.step}>
      <div className={styles.reviewTitle}>
        <h3>{section.title}</h3>
        {onEdit ? (
          <button
            type="button"
            onClick={() => onEdit(section.step)}
            aria-label={`Editar ${section.title.toLowerCase()}`}
          >
            Editar
          </button>
        ) : null}
      </div>
      <dl>
        {section.rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  ));
}
