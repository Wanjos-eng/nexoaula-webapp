"use client";

import { CheckCircle, UsersThree } from "@phosphor-icons/react";
import Link from "next/link";
import { useCallback, useRef, useState, type FormEvent } from "react";

import { BackButton } from "@/components/ui/BackButton";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { apiClient } from "@/lib/api";
import {
  catalog,
  read,
  entryLabels,
  visibilityLabels,
  type Group,
  type GroupInput,
} from "./api";
import { Failure } from "./AsyncState";
import { useRemote } from "./useRemote";
import styles from "./CommunityForm.module.css";

const empty: GroupInput = {
  name: "",
  description: "",
  rules: "",
  disciplineId: "",
  offeringId: null,
  visibility: "public",
  joinPolicy: "open",
};

export function GroupForm({
  group,
  onSaved,
}: {
  group?: Group;
  onSaved?: (group: Group) => void;
}) {
  const [draft, setDraft] = useState<GroupInput>(group ?? empty);
  const [selectedTopics, setSelectedTopics] = useState<string[] | undefined>();
  const [created, setCreated] = useState<Group>();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<unknown>();

  const fetcher = useCallback(async (signal: AbortSignal) => {
    const [
      subjects,
      sections,
      terms,
      topics,
      subjectTopics,
      groupTopics,
    ] = await Promise.all([
      catalog("subjects", signal),
      catalog("class-sections", signal),
      catalog("academic-terms", signal),
      catalog("topics", signal),
      catalog("subject-topics", signal),
      group
        ? read<{ subjectTopicId: string | null }[]>(
            `groups/${group.id}/topics`,
            signal,
          )
        : Promise.resolve([]),
    ]);

    return {
      subjects,
      sections,
      terms,
      topics,
      subjectTopics,
      groupTopics,
    };
  }, [group]);

  const remote = useRemote(
    group ? `community-form-${group.id}` : "community-form-new",
    fetcher,
  );

  function change<K extends keyof GroupInput>(
    field: K,
    value: GroupInput[K],
  ) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;

    if (draft.name.trim().length < 3) {
      setError(new Error("name"));
      return;
    }

    lock.current = true;
    setBusy(true);
    setError(undefined);

    const {
      name,
      description,
      rules,
      visibility,
      joinPolicy,
      disciplineId,
      offeringId,
    } = draft;

    const editable = {
      name: name.trim(),
      description: description?.trim() || null,
      rules: rules?.trim() || null,
      visibility,
      joinPolicy,
      ...(!group || selectedTopics !== undefined
        ? { subjectTopicIds: selectedTopics ?? [] }
        : {}),
    };

    try {
      const response = group
        ? await apiClient.patch<Group>(`/v1/groups/${group.id}`, {
            body: editable,
          })
        : await apiClient.post<Group>("/v1/groups", {
            body: { ...editable, disciplineId, offeringId },
          });

      setCreated(response.data);
      onSaved?.(response.data);
    } catch (cause) {
      setError(cause);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  if (created && !group) {
    return (
      <Card className={styles.successCard}>
        <CheckCircle aria-hidden size={42} weight="fill" />
        <div>
          <Badge variant="success">Comunidade criada</Badge>
          <h2>{created.name}</h2>
          <p role="status">
            Tudo pronto. Você já é o organizador e pode começar a estruturar os estudos.
          </p>
        </div>
        <Link className={styles.primaryLink} href={`/grupos/${created.id}`}>
          Acessar comunidade
        </Link>
      </Card>
    );
  }

  if (remote.loading) {
    return (
      <div className={styles.loading} role="status" aria-label="Carregando formulário">
        <span className="sr-only">Carregando formulário da comunidade...</span>
        <Skeleton variant="card" />
        <Skeleton variant="row" />
      </div>
    );
  }

  if (remote.error) {
    return (
      <Card className={styles.errorCard}>
        <Failure error={remote.error} retry={remote.reload} />
      </Card>
    );
  }

  const data = remote.data!;
  const currentTopicIds =
    selectedTopics ??
    data.groupTopics.flatMap((item) =>
      item.subjectTopicId ? [item.subjectTopicId] : [],
    );
  const availableTopics = data.subjectTopics.filter(
    (topic) => topic.subjectId === draft.disciplineId,
  );

  return (
    <Card className={styles.formCard}>
      <form
        aria-label={group ? "Configurar comunidade" : "Criar comunidade"}
        className={styles.form}
        onSubmit={submit}
      >
        <section className={styles.formSection}>
          <div className={styles.sectionHeading}>
            <div className={styles.sectionIcon}>
              <UsersThree aria-hidden size={20} />
            </div>
            <div>
              <h2>
                {group ? "Configurações da comunidade" : "Um objetivo em comum"}
              </h2>
              <p>
                Defina o propósito, o contexto acadêmico e como as pessoas podem participar.
              </p>
            </div>
          </div>

          <label className={styles.field}>
            <span>Nome da comunidade *</span>
            <input
              disabled={busy}
              maxLength={100}
              minLength={3}
              onChange={(event) => change("name", event.target.value)}
              placeholder="Ex.: Cálculo — estudos e exercícios"
              required
              value={draft.name}
            />
          </label>
        </section>

        {!group ? (
          <section className={styles.formSection}>
            <div className={styles.sectionCopy}>
              <h2>Contexto acadêmico</h2>
              <p>Vincule a comunidade à disciplina e, se fizer sentido, a uma turma específica.</p>
            </div>

            <div className={styles.twoColumns}>
              <label className={styles.field}>
                <span>Disciplina *</span>
                <select
                  aria-label="Disciplina *"
                  disabled={busy}
                  onChange={(event) => {
                    setSelectedTopics([]);
                    setDraft({
                      ...draft,
                      disciplineId: event.target.value,
                      offeringId: null,
                    });
                  }}
                  required
                  value={draft.disciplineId}
                >
                  <option value="">Selecione uma disciplina</option>
                  {data.subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.field}>
                <span>Turma (opcional)</span>
                <select
                  aria-label="Turma (opcional)"
                  disabled={busy || !draft.disciplineId}
                  onChange={(event) =>
                    change("offeringId", event.target.value || null)
                  }
                  value={draft.offeringId ?? ""}
                >
                  <option value="">Sem turma específica</option>
                  {data.sections
                    .filter(
                      (section) => section.subjectId === draft.disciplineId,
                    )
                    .map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.label} ·{" "}
                        {
                          data.terms.find(
                            (term) => term.id === section.academicTermId,
                          )?.label
                        }
                      </option>
                    ))}
                </select>
              </label>
            </div>

            {!data.subjects.length ? (
              <p className={styles.inlineState} role="status">
                Nenhuma disciplina cadastrada. Solicite o cadastro à organização acadêmica antes de criar uma comunidade.
              </p>
            ) : null}
          </section>
        ) : null}

        <section className={styles.formSection}>
          <div className={styles.sectionCopy}>
            <h2>Assuntos</h2>
            <p>
              Selecione os temas que ajudam outras pessoas a entender o foco da comunidade.
            </p>
          </div>

          <fieldset
            className={styles.topicFieldset}
            disabled={busy || !draft.disciplineId}
          >
            <legend className="sr-only">Assuntos da comunidade</legend>

            {availableTopics.length ? (
              <div className={styles.topicGrid}>
                {availableTopics.map((topic) => {
                  const name =
                    data.topics.find((item) => item.id === topic.topicId)?.name ??
                    "Assunto";
                  return (
                    <label className={styles.topicOption} key={topic.id}>
                      <input
                        checked={currentTopicIds.includes(topic.id)}
                        onChange={(event) =>
                          setSelectedTopics(
                            event.target.checked
                              ? [...currentTopicIds, topic.id]
                              : currentTopicIds.filter(
                                  (id) => id !== topic.id,
                                ),
                          )
                        }
                        type="checkbox"
                      />
                      <span>{name}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className={styles.inlineState} role="status">
                {draft.disciplineId
                  ? "Nenhum assunto cadastrado para esta disciplina."
                  : "Selecione uma disciplina para ver os assuntos disponíveis."}
              </p>
            )}

            {group ? (
              <small>
                Assuntos já usados em canais, aulas, encontros ou progresso precisam ser mantidos.
              </small>
            ) : null}
          </fieldset>
        </section>

        <section className={styles.formSection}>
          <div className={styles.sectionCopy}>
            <h2>Apresentação</h2>
            <p>Explique o propósito da comunidade e os combinados para convivência.</p>
          </div>

          <label className={styles.field}>
            <span>Descrição</span>
            <textarea
              disabled={busy}
              maxLength={500}
              onChange={(event) => change("description", event.target.value)}
              placeholder="O que vocês querem aprender juntos?"
              value={draft.description ?? ""}
            />
            <small>{draft.description?.length ?? 0}/500 caracteres</small>
          </label>

          <label className={styles.field}>
            <span>Combinados da comunidade</span>
            <textarea
              disabled={busy}
              maxLength={2000}
              onChange={(event) => change("rules", event.target.value)}
              placeholder="Como organizar os estudos e manter uma boa convivência?"
              value={draft.rules ?? ""}
            />
          </label>
        </section>

        <section className={styles.formSection}>
          <div className={styles.sectionCopy}>
            <h2>Descoberta e entrada</h2>
            <p>Escolha quem pode encontrar a comunidade e como novos participantes entram.</p>
          </div>

          <div className={styles.twoColumns}>
            <label className={styles.field}>
              <span>Visibilidade</span>
              <select
                aria-label="Visibilidade"
                disabled={busy}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    visibility: event.target
                      .value as GroupInput["visibility"],
                    ...(event.target.value === "private"
                      ? { joinPolicy: "invite_only" }
                      : {}),
                  })
                }
                value={draft.visibility}
              >
                {Object.entries(visibilityLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <small>
                {draft.visibility === "public"
                  ? "Aparece na descoberta de comunidades."
                  : draft.visibility === "unlisted"
                    ? "Acessível pelo link, fora da descoberta."
                    : "Visível apenas para participantes ativos."}
              </small>
            </label>

            <label className={styles.field}>
              <span>Entrada</span>
              <select
                aria-label="Entrada"
                disabled={busy || draft.visibility === "private"}
                onChange={(event) =>
                  change(
                    "joinPolicy",
                    event.target.value as GroupInput["joinPolicy"],
                  )
                }
                value={draft.joinPolicy}
              >
                {Object.entries(entryLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <small>
                {draft.joinPolicy === "invite_only"
                  ? "Comunidades por convite exigem entrada aprovada externamente nesta versão."
                  : "Organizadores acompanham os participantes dentro da comunidade."}
              </small>
            </label>
          </div>
        </section>

        {error instanceof Error && error.message === "name" ? (
          <div className={styles.validationError} role="alert">
            O nome deve ter pelo menos 3 caracteres sem contar espaços.
          </div>
        ) : error ? (
          <Failure error={error} />
        ) : null}

        <div className={styles.actions}>
          {!group ? (
            <Link className={styles.cancelLink} href="/grupos">
              Cancelar
            </Link>
          ) : null}
          <Button
            disabled={busy || (!group && !data.subjects.length)}
            loading={busy}
            type="submit"
          >
            {group ? "Salvar configurações" : "Criar comunidade"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function CreateGroupPage() {
  return (
    <div className={styles.page}>
      <BackButton fallback="/grupos">Voltar para comunidades</BackButton>

      <PageHeader
        description="Reúna colegas em um espaço com propósito, contexto acadêmico e organização claros."
        eyebrow="Comunidades"
        title="Criar comunidade"
      />

      <div className={styles.layout}>
        <GroupForm />

        <Card className={styles.helperCard}>
          <Badge variant="success">Comece com clareza</Badge>
          <h2>Uma boa comunidade tem propósito</h2>
          <p>
            Escolha um nome fácil de encontrar, explique o foco dos estudos e defina como receber novos colegas.
          </p>
          <ul>
            <li>Use uma descrição objetiva.</li>
            <li>Selecione assuntos realmente relacionados ao grupo.</li>
            <li>Escolha uma política de entrada coerente com o objetivo.</li>
          </ul>
          <Link href="/perfil">Revisar meu perfil</Link>
        </Card>
      </div>
    </div>
  );
}
