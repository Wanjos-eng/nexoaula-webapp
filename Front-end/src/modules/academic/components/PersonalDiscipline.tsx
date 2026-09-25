"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Failure, Loading } from "@/modules/groups/AsyncState";
import { academicGroups } from "@/modules/groups/schedule";
import { GroupSchedule } from "@/modules/groups/GroupSchedule";
import { useRemote } from "@/modules/groups/useRemote";
import styles from "./AcademicGroups.module.css";

export function PersonalDiscipline({ groupId }: { groupId?: string }) {
  const fetcher = useCallback((signal: AbortSignal) => academicGroups(signal), []);
  const remote = useRemote("personal-disciplines", fetcher, true);
  const [selection, setSelection] = useState("");
  const groups = remote.data ?? [];
  const group = groups.find((item) => item.id === (groupId || selection || groups[0]?.id));

  return <div className={styles.page}>
    <PageHeader eyebrow="Meu espaço" title={groupId ? group?.subject || "Minha disciplina" : "Minha Frequência"}
      description="Acompanhe o plano compartilhado e mantenha seus registros pessoais de presença, falta e estudo."
      actions={<Link className={styles.calendarLink} href="/disciplinas">Minhas Disciplinas</Link>} />
    {remote.loading ? <Loading /> : remote.error ? <Failure error={remote.error} retry={remote.reload} /> : <>
      {!groupId && groups.length > 0 && <label className={styles.termField}>Disciplina / comunidade{" "}
        <select value={group?.id || ""} onChange={(event) => setSelection(event.target.value)}>
          {groups.map((item) => <option key={item.id} value={item.id}>{item.subject} · {item.name}</option>)}
        </select>
      </label>}
      {group ? <>
        <div className={styles.filters}>
          <p>Plano de <strong>{group.name}</strong> · {group.term}</p>
          <Link className={styles.calendarLink} href={`/grupos/${group.id}#cronograma`}>Abrir comunidade e planejamento</Link>
        </div>
        <GroupSchedule key={group.id} groupId={group.id} canManage={false} personal />
      </> : <div className={styles.stateCard}>
        <h2>{groupId ? "Disciplina indisponível" : "Sua frequência começa pelas suas disciplinas"}</h2>
        <p>Entre em uma comunidade para acompanhar suas aulas e registrar suas faltas.</p>
        <Link className={styles.primaryLink} href="/grupos">Explorar comunidades</Link>
      </div>}
    </>}
  </div>;
}
