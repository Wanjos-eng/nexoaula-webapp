"use client";

import { UserCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { useCallback, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { apiClient } from "@/lib/api";
import { useAuthSession } from "@/modules/auth";
import {
  catalog,
  read,
  type CatalogItem,
  type Profile,
} from "@/modules/groups/api";
import { useRemote } from "@/modules/groups/useRemote";
import styles from "./AcademicWorkspace.module.css";

export function AcademicProfile() {
  const { user } = useAuthSession();
  const fetcher = useCallback(async (signal: AbortSignal) => {
    const [profile, institutions, courses] = await Promise.all([
      read<Profile>("academic/profile", signal),
      catalog("institutions", signal),
      catalog("courses", signal),
    ]);
    return { profile, institutions, courses };
  }, []);

  const remote = useRemote("profile", fetcher, true);

  return (
    <div className={styles.page}>
      <PageHeader
        actions={<Link href="/grupos">Explorar comunidades</Link>}
        description="Mantenha seu contexto acadêmico atualizado para melhorar a descoberta de disciplinas e comunidades."
        eyebrow="Seu espaço acadêmico"
        title="Meu Perfil"
      />

      {remote.loading ? (
        <div className={styles.columns} role="status" aria-label="Carregando perfil">
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
      ) : remote.error ? (
        <Card className={styles.stateCard}>
          <UserCircle aria-hidden size={36} />
          <div>
            <h2>Não foi possível carregar seu perfil</h2>
            <p>Atualize os dados e tente novamente.</p>
          </div>
          <Button onClick={remote.reload} size="sm" type="button" variant="secondary">
            Tentar novamente
          </Button>
        </Card>
      ) : remote.data ? (
        <ProfileForm {...remote.data} email={user.email} />
      ) : null}
    </div>
  );
}

function ProfileForm({
  profile,
  institutions,
  courses,
  email,
}: {
  profile: Profile;
  institutions: CatalogItem[];
  courses: CatalogItem[];
  email: string;
}) {
  const [draft, setDraft] = useState(profile);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const { showToast } = useToast();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;

    lock.current = true;
    setBusy(true);

    try {
      const result = await apiClient.patch<Profile>("/v1/academic/profile", {
        body: {
          institutionId: draft.institutionId,
          courseId: draft.courseId,
          bio: draft.bio?.trim() || null,
        },
      });
      setDraft(result.data);
      showToast({ message: "Perfil atualizado com sucesso.", variant: "success" });
    } catch {
      showToast({
        message: "Não foi possível salvar o perfil. Tente novamente.",
        variant: "error",
      });
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  const availableCourses = courses.filter(
    (course) => course.institutionId === draft.institutionId,
  );

  return (
    <div className={styles.columns}>
      <Card className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>{draft.displayName}</h2>
          <p>{email}</p>
          <p>Contexto acadêmico</p>
        </div>

        <form className={styles.fields} onSubmit={submit}>
          <label className={styles.field}>
            Instituição
            <select
              disabled={busy}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  institutionId: event.target.value || null,
                  courseId: null,
                })
              }
              value={draft.institutionId ?? ""}
            >
              <option value="">Não informada</option>
              {institutions.map((institution) => (
                <option key={institution.id} value={institution.id}>
                  {institution.name}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            Curso
            <select
              disabled={busy || !draft.institutionId}
              onChange={(event) =>
                setDraft({ ...draft, courseId: event.target.value || null })
              }
              value={draft.courseId ?? ""}
            >
              <option value="">Não informado</option>
              {availableCourses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            Sobre mim e meus interesses
            <textarea
              disabled={busy}
              maxLength={500}
              onChange={(event) => setDraft({ ...draft, bio: event.target.value })}
              placeholder="Conte brevemente o que você estuda e quais assuntos gostaria de aprofundar."
              value={draft.bio ?? ""}
            />
            <small>{draft.bio?.length ?? 0}/500 caracteres</small>
          </label>

          <div className={styles.actions}>
            <Button loading={busy} type="submit">
              Salvar alterações
            </Button>
          </div>
        </form>
      </Card>

      <Card className={styles.helperCard}>
        <UserCircle aria-hidden size={30} />
        <h2>Seu contexto melhora a experiência</h2>
        <p>
          Instituição e curso ajudam o NexoAula a organizar a descoberta acadêmica sem alterar qualquer matrícula oficial.
        </p>
        <Link href="/grupos?view=discover">Descobrir comunidades</Link>
      </Card>
    </div>
  );
}
