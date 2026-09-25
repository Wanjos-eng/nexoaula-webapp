"use client";
import { useCallback, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api";
import {
  catalog,
  read,
  entryLabels,
  visibilityLabels,
  type Group,
  type GroupInput,
} from "./api";
import { useRemote } from "./useRemote";
import { Failure, Loading } from "./AsyncState";
import s from "./AcademicCommunity.module.css";

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
    const [subjects, sections, terms, topics, subjectTopics, groupTopics] = await Promise.all([
      catalog("subjects", signal),
      catalog("class-sections", signal),
      catalog("academic-terms", signal),
      catalog("topics", signal),
      catalog("subject-topics", signal),
      group ? read<{ subjectTopicId: string | null }[]>(`groups/${group.id}/topics`, signal) : Promise.resolve([]),
    ]);
    return { subjects, sections, terms, topics, subjectTopics, groupTopics };
  }, [group]);
  const remote = useRemote("group-catalog", fetcher);
  function change<K extends keyof GroupInput>(field: K, value: GroupInput[K]) {
    setDraft((d) => ({ ...d, [field]: value }));
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
      ...(!group || selectedTopics !== undefined ? { subjectTopicIds: selectedTopics ?? [] } : {}),
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
    } catch (e) {
      setError(e);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (created && !group)
    return (
      <section className={s.panel}>
        <span className={s.badge}>Grupo criado</span>
        <h2>{created.name}</h2>
        <p role="status">
          Tudo pronto! Seu grupo foi salvo e você já é o organizador.
        </p>
        <Link href={`/grupos/${created.id}`} className={s.primary}>
          Acessar grupo
        </Link>
      </section>
    );
  if (remote.loading) return <Loading />;
  if (remote.error)
    return <Failure error={remote.error} retry={remote.reload} />;
  const data = remote.data!;
  return (
    <form
      className={s.panel}
      onSubmit={submit}
      aria-label={group ? "Configurar grupo" : "Criar grupo de estudo"}
    >
      <div>
        <h2>{group ? "Configurações do grupo" : "Um objetivo em comum"}</h2>
        <p>
          Defina a disciplina, o propósito e como as pessoas podem participar.
        </p>
      </div>
      <fieldset disabled={busy} style={{ border: 0, display: "grid", gap: 20 }}>
        <label className={s.field}>
          Nome do grupo *
          <input
            required
            minLength={3}
            maxLength={100}
            value={draft.name}
            onChange={(e) => change("name", e.target.value)}
            placeholder="Ex.: Cálculo — estudos e exercícios"
          />
        </label>
        {!group ? (
          <div className={s.fields}>
            <label className={s.field}>
              Disciplina *
              <select
                aria-label="Disciplina *"
                required
                value={draft.disciplineId}
                onChange={(e) => {
                  setSelectedTopics([]);
                  setDraft({ ...draft, disciplineId: e.target.value, offeringId: null });
                }}
              >
                <option value="">Selecione uma disciplina</option>
                {data.subjects.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={s.field}>
              Turma (opcional)
              <select
                aria-label="Turma (opcional)"
                value={draft.offeringId ?? ""}
                disabled={!draft.disciplineId}
                onChange={(e) => change("offeringId", e.target.value || null)}
              >
                <option value="">Sem turma específica</option>
                {data.sections
                  .filter((i) => i.subjectId === draft.disciplineId)
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.label} ·{" "}
                      {data.terms.find((t) => t.id === i.academicTermId)?.label}
                    </option>
                  ))}
              </select>
            </label>
          </div>
        ) : null}
        {!data.subjects.length && !group ? (
          <p role="status">
            Nenhuma disciplina cadastrada. Solicite o cadastro à organização
            acadêmica antes de criar um grupo.
          </p>
        ) : null}
        <fieldset className={s.field} disabled={!draft.disciplineId}>
          <legend>Assuntos do grupo (opcional)</legend>
          <p>Selecione os assuntos da disciplina. Assuntos já usados em canais, aulas, encontros ou progresso precisam ser mantidos.</p>
          {data.subjectTopics.filter((topic) => topic.subjectId === draft.disciplineId).map((topic) => {
            const ids = selectedTopics ?? data.groupTopics.flatMap((item) => item.subjectTopicId ? [item.subjectTopicId] : []);
            return <label key={topic.id}>
              <input type="checkbox" checked={ids.includes(topic.id)} onChange={(event) => setSelectedTopics(event.target.checked ? [...ids, topic.id] : ids.filter((id) => id !== topic.id))} />
              {data.topics.find((item) => item.id === topic.topicId)?.name}
            </label>;
          })}
          {!data.subjectTopics.some((topic) => topic.subjectId === draft.disciplineId) ? <p role="status">{draft.disciplineId ? "Nenhum assunto cadastrado para esta disciplina." : "Selecione uma disciplina para ver os assuntos."}</p> : null}
        </fieldset>
        <label className={s.field}>
          Descrição
          <textarea
            maxLength={500}
            value={draft.description ?? ""}
            onChange={(e) => change("description", e.target.value)}
            placeholder="O que vocês querem aprender juntos?"
          />
          <small>Até 500 caracteres.</small>
        </label>
        <div className={s.fields}>
          <label className={s.field}>
            Visibilidade
            <select
              aria-label="Visibilidade"
              value={draft.visibility}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  visibility: e.target.value as GroupInput["visibility"],
                  ...(e.target.value === "private"
                    ? { joinPolicy: "invite_only" }
                    : {}),
                })
              }
            >
              {Object.entries(visibilityLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <small>
              {draft.visibility === "public"
                ? "Aparece na descoberta de grupos."
                : draft.visibility === "unlisted"
                  ? "Acessível pelo link, fora da descoberta."
                  : "Visível apenas para participantes ativos."}
            </small>
          </label>
          <label className={s.field}>
            Entrada
            <select
              aria-label="Entrada"
              disabled={draft.visibility === "private"}
              value={draft.joinPolicy}
              onChange={(e) =>
                change("joinPolicy", e.target.value as GroupInput["joinPolicy"])
              }
            >
              {Object.entries(entryLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <small>
              {draft.joinPolicy === "invite_only"
                ? "O envio de convites ainda não está disponível."
                : "Você poderá acompanhar os participantes no grupo."}
            </small>
          </label>
        </div>
        <label className={s.field}>
          Combinados do grupo
          <textarea
            maxLength={2000}
            value={draft.rules ?? ""}
            onChange={(e) => change("rules", e.target.value)}
            placeholder="Como organizar os estudos e manter uma boa convivência?"
          />
        </label>
      </fieldset>
      {error instanceof Error && error.message === "name" ? (
        <div role="alert" className={s.error}>
          O nome deve ter pelo menos 3 caracteres sem contar espaços.
        </div>
      ) : error ? (
        <Failure error={error} />
      ) : null}
      <div className={s.actions}>
        <button
          className={s.primary}
          disabled={busy || (!group && !data.subjects.length)}
        >
          {busy ? "Salvando…" : group ? "Salvar configurações" : "Criar grupo"}
        </button>
        {!group ? (
          <Link className={s.secondary} href="/grupos">
            Cancelar
          </Link>
        ) : null}
      </div>
    </form>
  );
}
export function CreateGroupPage() {
  return (
    <div className={s.page}>
      <Link className={s.back} href="/grupos">
        ← Voltar aos grupos
      </Link>
      <header className={s.header}>
        <div>
          <p className={s.eyebrow}>Aprender juntos</p>
          <h1>Criar grupo de estudo</h1>
          <p>Transforme um interesse em um espaço de troca e colaboração.</p>
        </div>
      </header>
      <div className={s.columns}>
        <GroupForm />
        <aside className={s.panel}>
          <span className={s.badge}>Comece com clareza</span>
          <h2>Um bom grupo tem propósito</h2>
          <p>
            Escolha um nome fácil de encontrar, explique o foco dos estudos e
            combine como receber novos colegas.
          </p>
          <p>Campos com * são obrigatórios. A turma é opcional.</p>
          <Link className={s.secondary} href="/perfil">
            Revisar meu perfil
          </Link>
        </aside>
      </div>
    </div>
  );
}
