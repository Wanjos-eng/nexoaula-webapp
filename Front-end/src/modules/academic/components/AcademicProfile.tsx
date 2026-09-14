"use client";
import { useCallback, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api";
import {
  catalog,
  read,
  type Profile,
  type CatalogItem,
} from "@/modules/groups/api";
import { useRemote } from "@/modules/groups/useRemote";
import { Failure, Loading } from "@/modules/groups/AsyncState";
import s from "@/modules/groups/AcademicCommunity.module.css";

export function AcademicProfile() {
  const fetcher = useCallback(async (signal: AbortSignal) => {
    const [profile, institutions, courses] = await Promise.all([
      read<Profile>("academic/profile", signal),
      catalog("institutions", signal),
      catalog("courses", signal),
    ]);
    return { profile, institutions, courses };
  }, []);
  const remote = useRemote("profile", fetcher);
  return (
    <div className={s.page}>
      <header className={s.header}>
        <div>
          <p className={s.eyebrow}>Seu espaço acadêmico</p>
          <h1>Meu perfil</h1>
          <p>
            Conte onde você estuda e quais assuntos despertam seu interesse.
          </p>
        </div>
        <Link className={s.secondary} href="/grupos">
          Explorar grupos
        </Link>
      </header>
      {remote.loading ? (
        <Loading />
      ) : remote.error ? (
        <Failure error={remote.error} retry={remote.reload} />
      ) : remote.data ? (
        <ProfileForm {...remote.data} />
      ) : null}
    </div>
  );
}
function ProfileForm({
  profile,
  institutions,
  courses,
}: {
  profile: Profile;
  institutions: CatalogItem[];
  courses: CatalogItem[];
}) {
  const [draft, setDraft] = useState(profile);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<unknown>();
  const [saved, setSaved] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(undefined);
    setSaved(false);
    try {
      const result = await apiClient.patch<Profile>("/v1/academic/profile", {
        body: {
          institutionId: draft.institutionId,
          courseId: draft.courseId,
          bio: draft.bio?.trim() || null,
        },
      });
      setDraft(result.data);
      setSaved(true);
    } catch (e) {
      setError(e);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className={s.columns}>
      <form
        className={s.panel}
        onSubmit={submit}
        aria-label="Contexto acadêmico"
      >
        <div>
          <h2>{draft.displayName}</h2>
          <p>Contexto acadêmico</p>
        </div>
        <fieldset
          disabled={busy}
          style={{ border: 0, display: "grid", gap: 20 }}
        >
          <label className={s.field}>
            Instituição
            <select
              value={draft.institutionId ?? ""}
              onChange={(e) => {
                setSaved(false);
                setDraft({
                  ...draft,
                  institutionId: e.target.value || null,
                  courseId: null,
                });
              }}
            >
              <option value="">Não informada</option>
              {institutions.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </label>
          <label className={s.field}>
            Curso
            <select
              disabled={!draft.institutionId}
              value={draft.courseId ?? ""}
              onChange={(e) => {
                setSaved(false);
                setDraft({ ...draft, courseId: e.target.value || null });
              }}
            >
              <option value="">Não informado</option>
              {courses
                .filter((c) => c.institutionId === draft.institutionId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          <label className={s.field}>
            Sobre mim e meus interesses
            <textarea
              maxLength={500}
              value={draft.bio ?? ""}
              placeholder="Quero estudar em grupo, trocar ideias e aprofundar…"
              onChange={(e) => {
                setSaved(false);
                setDraft({ ...draft, bio: e.target.value });
              }}
            />
            <small>{draft.bio?.length ?? 0}/500 caracteres</small>
          </label>
        </fieldset>
        {error ? <Failure error={error} /> : null}
        {saved ? (
          <div role="status" className={s.success}>
            Perfil atualizado com sucesso.
          </div>
        ) : null}
        <div className={s.actions}>
          <button className={s.primary} disabled={busy}>
            {busy ? "Salvando…" : "Salvar alterações"}
          </button>
        </div>
      </form>
      <aside className={s.panel}>
        <span className={s.badge}>Estudar em comunidade</span>
        <h2>Seu próximo passo</h2>
        <p>
          Encontre um grupo da sua disciplina ou reúna colegas em um novo espaço
          de estudo.
        </p>
        <Link className={s.secondary} href="/grupos/novo">
          Criar um grupo
        </Link>
        <p className={s.muted}>
          Seu perfil não realiza matrícula em turmas. O acesso ao conteúdo
          acadêmico acontece pelo grupo de origem, quando disponível.
        </p>
      </aside>
    </div>
  );
}
