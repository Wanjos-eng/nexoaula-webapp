import {
  ArrowRight,
  CalendarBlank,
  MapPin,
  UsersThree,
} from "@phosphor-icons/react";
import Link from "next/link";

import type { StudyGroup } from "../types";
import styles from "./GroupDirectory.module.css";

type GroupCardProps = {
  group: StudyGroup;
  onPreview?: (group: StudyGroup) => void;
  variant?: "owned" | "discover";
};

export function GroupCard({ group, onPreview, variant = "discover" }: GroupCardProps) {
  const entryLabel = group.entryMode === "open" ? "Entrada livre" : "Aprovação necessária";

  return (
    <article className={`${styles.groupCard} ${variant === "owned" ? styles.ownedCard : ""}`}>
      <div className={styles.cardHeader}>
        <span aria-hidden className={styles.groupIcon}>
          <UsersThree size={22} />
        </span>
        <div className={styles.cardIdentity}>
          <p>{group.discipline}</p>
          <h3>{group.name}</h3>
        </div>
        <span className={group.entryMode === "open" ? styles.openBadge : styles.approvalBadge}>
          {variant === "owned" ? group.role : entryLabel}
        </span>
      </div>

      <p className={styles.description}>{group.description}</p>

      <div aria-label="Assuntos do grupo" className={styles.topicList}>
        {group.topics.slice(0, 3).map((topic) => <span key={topic}>{topic}</span>)}
      </div>

      <dl className={styles.groupFacts}>
        <div>
          <dt><UsersThree aria-hidden size={16} /> Participantes</dt>
          <dd>{group.memberCount} de {group.capacity}</dd>
        </div>
        <div>
          <dt><MapPin aria-hidden size={16} /> Formato</dt>
          <dd>{group.location}</dd>
        </div>
        {group.nextMeeting ? (
          <div>
            <dt><CalendarBlank aria-hidden size={16} /> Próximo encontro</dt>
            <dd>{group.nextMeeting}</dd>
          </div>
        ) : null}
      </dl>

      <div className={styles.cardFooter}>
        <p>{group.classGroup} <span aria-hidden>·</span> {group.period}</p>
        {group.href ? (
          <Link className={styles.cardAction} href={group.href}>
            Abrir grupo <ArrowRight aria-hidden size={16} />
          </Link>
        ) : (
          <button className={styles.cardAction} onClick={() => onPreview?.(group)} type="button">
            Ver detalhes <ArrowRight aria-hidden size={16} />
          </button>
        )}
      </div>
    </article>
  );
}
