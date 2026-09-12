"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useReducer, useRef, type FormEvent } from "react";
import {
  createGroupReducer,
  initialCreateGroupState,
} from "../createGroupState";
import { emptyGroupDraft, type GroupDraft } from "../schemas/group.schema";
import { GroupAccessFields, GroupIdentityFields } from "./GroupDraftFields";
import { GroupDraftSummary } from "./GroupDraftSummary";
import styles from "./CreateGroupFlow.module.css";

const headings = [
  "Criar grupo de estudo",
  "Definir acesso ao grupo",
  "Revisar o grupo",
  "Simulação concluída",
];

export function CreateGroupFlow() {
  const [{ draft, step, errors }, dispatch] = useReducer(
    createGroupReducer,
    undefined,
    initialCreateGroupState,
  );
  const headingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const focusErrorsAfterSubmit = useRef(false);
  const previousStep = useRef(step);
  const router = useRouter();
  const errorEntries = Object.entries(errors);
  const dirty = Object.keys(emptyGroupDraft).some(
    (key) =>
      draft[key as keyof GroupDraft] !==
      emptyGroupDraft[key as keyof GroupDraft],
  );

  useEffect(() => {
    if (previousStep.current !== step) {
      headingRef.current?.focus();
      previousStep.current = step;
    }
  }, [step]);
  useEffect(() => {
    if (focusErrorsAfterSubmit.current && Object.keys(errors).length)
      errorRef.current?.focus();
    focusErrorsAfterSubmit.current = false;
  }, [errors]);

  function change<K extends keyof GroupDraft>(field: K, value: GroupDraft[K]) {
    dispatch({ type: "change", patch: { [field]: value } });
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    focusErrorsAfterSubmit.current = true;
    dispatch({ type: "next" });
  }
  function cancel() {
    if (
      !dirty ||
      window.confirm(
        "Descartar os dados desta simulação e voltar aos grupos? Nada será salvo.",
      )
    )
      router.push("/grupos");
  }

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumbs} aria-label="Caminho da página">
        <Link href="/inicio">Início</Link>
        <span aria-hidden>/</span>
        <Link href="/grupos">Grupos</Link>
        <span aria-hidden>/</span>
        <span aria-current="page">Criar grupo</span>
      </nav>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Grupos de estudo</p>
          <h1 ref={headingRef} tabIndex={-1}>
            {headings[step - 1]}
          </h1>
          <p>
            {step === 4
              ? "Você percorreu a criação de um grupo. Nenhum grupo, canal ou convite foi criado."
              : "Reúna pessoas para estudar, com um objetivo em comum e participação clara."}
          </p>
        </div>
        <span className={styles.mockBadge}>Demonstração · sem salvar</span>
      </header>
      {step < 4 ? (
        <>
          <ol className={styles.stepper} aria-label={`Etapa ${step} de 3`}>
            {["Informações", "Acesso", "Revisão"].map((label, index) => (
              <li
                key={label}
                className={`${styles.step} ${step > index + 1 ? styles.stepComplete : ""}`}
                aria-current={step === index + 1 ? "step" : undefined}
              >
                <strong>{label}</strong>
                <span>
                  {step > index + 1 ? (
                    <Check aria-label="Concluída" size={16} />
                  ) : (
                    index + 1
                  )}
                </span>
              </li>
            ))}
          </ol>
          <p className={styles.notice}>
            Os dados ficam apenas nesta tela. Ao sair ou recarregar, serão
            descartados. Disciplinas e turmas são exemplos do protótipo.
          </p>
          <form
            className={styles.card}
            onSubmit={submit}
            noValidate
            aria-label="Criar grupo de estudo"
          >
            <div className={styles.cardHeader}>
              <h2>
                {step === 1
                  ? "Informações básicas"
                  : step === 2
                    ? "Acesso e participação"
                    : "Confira antes de simular"}
              </h2>
              <p>
                {step === 1
                  ? "Campos com * são obrigatórios. A turma é opcional e pertence à disciplina selecionada."
                  : step === 2
                    ? "Defina a descoberta, a entrada e os combinados do grupo."
                    : "Revise as escolhas. Você pode voltar e editar qualquer etapa."}
              </p>
            </div>
            {errorEntries.length ? (
              <div
                className={styles.errorSummary}
                role="alert"
                tabIndex={-1}
                ref={errorRef}
              >
                <strong>Revise os campos indicados para continuar.</strong>
                <ul>
                  {errorEntries.map(([field, error]) => (
                    <li key={field}>
                      <a
                        href={`#${field}`}
                        onClick={(event) => {
                          event.preventDefault();
                          document.getElementById(field)?.focus();
                        }}
                      >
                        {error}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {step === 1 ? (
              <GroupIdentityFields
                draft={draft}
                errors={errors}
                onChange={change}
              />
            ) : step === 2 ? (
              <GroupAccessFields
                draft={draft}
                errors={errors}
                onChange={change}
              />
            ) : (
              <GroupDraftSummary
                draft={draft}
                onEdit={(target) => dispatch({ type: "edit", step: target })}
              />
            )}
            {step === 3 ? (
              <p className={styles.notice}>
                Esta ação apenas demonstra a conclusão. Não cria grupo, membros,
                canais ou cobrança e não altera seus grupos.
              </p>
            ) : null}
            <div className={styles.actions}>
              <button
                className={styles.secondary}
                type="button"
                onClick={cancel}
              >
                Cancelar
              </button>
              {step > 1 ? (
                <button
                  className={styles.secondary}
                  type="button"
                  onClick={() => dispatch({ type: "back" })}
                >
                  <ArrowLeft aria-hidden size={18} />
                  Voltar
                </button>
              ) : null}
              <button className={styles.primary} type="submit">
                {step === 1
                  ? "Continuar"
                  : step === 2
                    ? "Revisar grupo"
                    : "Concluir simulação"}
                <ArrowRight aria-hidden size={18} />
              </button>
            </div>
          </form>
        </>
      ) : (
        <section className={styles.card} aria-labelledby="simulation-summary">
          <CheckCircle
            className={styles.successIcon}
            aria-hidden
            size={48}
            weight="fill"
          />
          <h2 id="simulation-summary">Resumo da simulação</h2>
          <p className={styles.notice}>
            Nenhum dado foi salvo. A criação real estará disponível após a
            integração com o backend.
          </p>
          <GroupDraftSummary draft={draft} />
          <div className={styles.actions}>
            <button
              className={styles.secondary}
              type="button"
              onClick={() => dispatch({ type: "restart" })}
            >
              Iniciar outra simulação
            </button>
            <Link className={styles.primary} href="/grupos">
              Voltar aos grupos
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
