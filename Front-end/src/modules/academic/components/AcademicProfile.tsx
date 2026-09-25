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
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (file.size > 5 * 1024 * 1024) {
      setAvatarError("O tamanho da foto excede o limite de 5 MB.");
      return;
    }
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setAvatarError("Formato de imagem inválido. Formatos suportados: JPEG e PNG.");
      return;
    }

    setAvatarBusy(true);
    setAvatarError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiClient.post<Profile>("/v1/academic/profile/avatar", {
        body: formData,
      });
      setDraft((prev) => ({
        ...prev,
        avatarFileId: res.data.avatarFileId,
        avatarUrl: res.data.avatarUrl,
      }));
    } catch (err: unknown) {
      const msg = (err as { data?: { detail?: string } })?.data?.detail || "Falha ao enviar a foto. Tente novamente.";
      setAvatarError(typeof msg === "string" ? msg : "Falha ao enviar a foto.");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handleAvatarDelete() {
    setAvatarBusy(true);
    setAvatarError(null);
    try {
      await apiClient.del<Profile>("/v1/academic/profile/avatar");
      setDraft((prev) => ({
        ...prev,
        avatarFileId: null,
        avatarUrl: null,
      }));
    } catch (err: unknown) {
      const msg = (err as { data?: { detail?: string } })?.data?.detail || "Falha ao remover a foto.";
      setAvatarError(typeof msg === "string" ? msg : "Falha ao remover a foto.");
    } finally {
      setAvatarBusy(false);
    }
  }

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
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "50%",
              overflow: "hidden",
              backgroundColor: "var(--color-surface-hover, #23272f)",
              border: "2px solid var(--color-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
              fontWeight: "700",
              color: "var(--color-text)",
              flexShrink: 0,
            }}
            data-testid="avatar-container"
          >
            {draft.avatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={draft.avatarUrl}
                alt={`Foto de ${draft.displayName}`}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span>{(draft.displayName || "U").charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <h2 style={{ margin: 0 }}>{draft.displayName}</h2>
            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                style={{ display: "none" }}
                onChange={handleAvatarUpload}
                disabled={avatarBusy}
                data-testid="avatar-input"
              />
              <button
                type="button"
                className={s.secondary}
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarBusy}
              >
                {avatarBusy ? "Enviando..." : draft.avatarFileId ? "Trocar foto" : "Adicionar foto"}
              </button>
              {draft.avatarFileId ? (
                <button
                  type="button"
                  className={s.secondary}
                  onClick={handleAvatarDelete}
                  disabled={avatarBusy}
                  style={{ color: "var(--color-danger, #e53e3e)" }}
                >
                  Remover foto
                </button>
              ) : null}
            </div>
            <small style={{ color: "var(--color-text-muted)" }}>
              JPEG ou PNG até 5 MB.
            </small>
            {avatarError ? (
              <p role="alert" style={{ color: "var(--color-danger, #e53e3e)", fontSize: "13px", margin: 0 }}>
                {avatarError}
              </p>
            ) : null}
          </div>
        </div>
        <div>
          <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: "14px" }}>Contexto acadêmico</p>
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
