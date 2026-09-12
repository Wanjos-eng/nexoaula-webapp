import {
  ArrowRight,
  CalendarBlank,
  MapPin,
  UsersThree,
} from "@phosphor-icons/react";
import Link from "next/link";

import type { OwnedStudyGroup, StudyGroup } from "../types";
import styles from "./GroupDirectory.module.css";

type OwnedGroupCardProps = {
  group: OwnedStudyGroup;
  onPreview?: never;
  variant: "owned";
};

type DiscoverGroupCardProps = {
  group: StudyGroup;
  onPreview: (group: StudyGroup) => void;
  variant: "discover";
};

type GroupCardProps = DiscoverGroupCardProps | OwnedGroupCardProps;

export function GroupCard(props: GroupCardProps) {
  const { group, variant } = props;
  const entryLabel = group.entryMode === "open" ? "Entrada livre" : "Aprovação necessária";
  const badgeLabel = props.variant === "owned" ? props.group.role ?? "Participante" : entryLabel;
  const badgeClassName =
    variant === "owned"
      ? styles.roleBadge
      : group.entryMode === "open"
        ? styles.openBadge
        : styles.approvalBadge;

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
        <span className={badgeClassName}>{badgeLabel}</span>
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
        ) : props.variant === "discover" ? (
          <button className={styles.cardAction} onClick={() => props.onPreview(group)} type="button">
            Ver detalhes <ArrowRight aria-hidden size={16} />
          </button>
        ) : null}
      </div>
    </article>
  );
}
