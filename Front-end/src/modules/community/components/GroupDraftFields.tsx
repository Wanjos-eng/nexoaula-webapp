import type { ReactNode } from "react";
import { academicCatalog } from "@/mocks/community/academicCatalog";
import {
  joinPolicyOptions,
  visibilityOptions,
  type GroupDraft,
  type GroupErrors,
} from "../schemas/group.schema";
import styles from "./CreateGroupFlow.module.css";

type Props = {
  draft: GroupDraft;
  errors: GroupErrors;
  onChange: <K extends keyof GroupDraft>(
    field: K,
    value: GroupDraft[K],
  ) => void;
};

function Field({
  id,
  label,
  hint,
  error,
  full,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  full?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`${styles.field} ${full ? styles.full : ""}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint ? <small id={`${id}-hint`}>{hint}</small> : null}
      {error ? (
        <p className={styles.error} id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function fieldA11y(field: keyof GroupDraft, errors: GroupErrors, hint = false) {
  return {
    id: field,
    name: field,
    "aria-invalid": Boolean(errors[field]),
    "aria-describedby":
      [hint ? `${field}-hint` : "", errors[field] ? `${field}-error` : ""]
        .filter(Boolean)
        .join(" ") || undefined,
  };
}

export function GroupIdentityFields({ draft, errors, onChange }: Props) {
  const subject = academicCatalog.find((item) => item.id === draft.subjectId);
  return (
    <div className={styles.grid}>
      <Field id="name" label="Nome do grupo *" error={errors.name}>
        <input
          {...fieldA11y("name", errors)}
          required
          maxLength={150}
          value={draft.name}
          onChange={(e) => onChange("name", e.target.value)}
          placeholder="Ex.: Estudos de Modelagem e Simulação"
        />
      </Field>
      <Field id="subjectId" label="Disciplina *" error={errors.subjectId}>
        <select
          {...fieldA11y("subjectId", errors)}
          required
          value={draft.subjectId}
          onChange={(e) => onChange("subjectId", e.target.value)}
        >
          <option value="">Selecione uma disciplina</option>
          {academicCatalog.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>
      <Field
        id="classSectionId"
        label="Turma (opcional)"
        error={errors.classSectionId}
        hint={
          !subject
            ? "Escolha a disciplina primeiro."
            : subject.classes.length
              ? "Cada turma já indica seu período letivo. Você também pode criar um grupo sem turma específica."
              : "Nenhuma turma neste catálogo demonstrativo. O grupo pode reunir estudantes da disciplina."
        }
        full
      >
        <select
          {...fieldA11y("classSectionId", errors, true)}
          disabled={!subject || !subject.classes.length}
          value={draft.classSectionId}
          onChange={(e) => onChange("classSectionId", e.target.value)}
        >
          <option value="">Sem turma específica</option>
          {subject?.classes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} · {item.term}
            </option>
          ))}
        </select>
      </Field>
      <Field
        id="description"
        label="Descrição (opcional)"
        error={errors.description}
        hint={`${draft.description.length}/240 caracteres. Conte o objetivo do grupo.`}
        full
      >
        <textarea
          {...fieldA11y("description", errors, true)}
          maxLength={240}
          value={draft.description}
          onChange={(e) => onChange("description", e.target.value)}
        />
      </Field>
    </div>
  );
}

export function GroupAccessFields({ draft, errors, onChange }: Props) {
  return (
    <>
      <fieldset
        className={styles.choices}
        id="visibility"
        aria-describedby={errors.visibility ? "visibility-error" : undefined}
      >
        <legend>Visibilidade</legend>
        {visibilityOptions.map((item) => (
          <label key={item.value} className={styles.option}>
            <input
              type="radio"
              name="visibility"
              value={item.value}
              checked={draft.visibility === item.value}
              onChange={() => onChange("visibility", item.value)}
            />
            <span>
              <strong>{item.label}</strong>
              <small>{item.hint}</small>
            </span>
          </label>
        ))}
        {errors.visibility ? (
          <p className={styles.error} id="visibility-error">
            {errors.visibility}
          </p>
        ) : null}
      </fieldset>
      <fieldset
        className={styles.choices}
        id="joinPolicy"
        aria-describedby="joinPolicy-hint"
      >
        <legend>Política de entrada</legend>
        <p id="joinPolicy-hint">
          A visibilidade define quem encontra o grupo; a política define como
          participar. São escolhas independentes nesta demonstração.
        </p>
        {joinPolicyOptions.map((item) => (
          <label key={item.value} className={styles.option}>
            <input
              type="radio"
              name="joinPolicy"
              value={item.value}
              checked={draft.joinPolicy === item.value}
              onChange={() => onChange("joinPolicy", item.value)}
            />
            <span>
              <strong>{item.label}</strong>
              <small>{item.hint}</small>
            </span>
          </label>
        ))}
        {errors.joinPolicy ? (
          <p className={styles.error} id="joinPolicy-error">
            {errors.joinPolicy}
          </p>
        ) : null}
      </fieldset>
      <div className={styles.grid}>
        <Field
          id="capacity"
          label="Capacidade de participantes (opcional)"
          error={errors.capacity}
          hint="Inclui o organizador. Vazio significa sem capacidade definida; não há cobrança por grupo ou quantidade de membros."
          full
        >
          <input
            {...fieldA11y("capacity", errors, true)}
            inputMode="numeric"
            value={draft.capacity}
            onChange={(e) => onChange("capacity", e.target.value)}
          />
        </Field>
        <Field
          id="rules"
          label="Regras do grupo (opcional)"
          error={errors.rules}
          hint={`${draft.rules.length}/500 caracteres. Ex.: respeito entre participantes e discussões relacionadas à disciplina.`}
          full
        >
          <textarea
            {...fieldA11y("rules", errors, true)}
            maxLength={500}
            value={draft.rules}
            onChange={(e) => onChange("rules", e.target.value)}
          />
        </Field>
      </div>
    </>
  );
}
