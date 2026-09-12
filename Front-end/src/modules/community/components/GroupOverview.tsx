import {
  CalendarBlank,
  GearSix,
  Hash,
  Tag,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import type { GroupDetailData } from "@/modules/community/types";

import styles from "./GroupDetailView.module.css";

type GroupOverviewProps = {
  group: GroupDetailData;
  onOpenManage?: () => void;
  onJoinClick?: () => void;
  joinFeedback?: string;
};

export function GroupOverview({
  group,
  onOpenManage,
  onJoinClick,
  joinFeedback,
}: GroupOverviewProps) {
  const isOrganizer = group.role === "Organizador";

  return (
    <header className={styles.hero}>
      <div>
        <p className={styles.eyebrow}>Grupo de estudo</p>
        <h2>{group.name}</h2>
        <div className={styles.metadata}>
          <span>
            <Tag aria-hidden size={15} /> {group.discipline}
          </span>
          <span>
            <Hash aria-hidden size={15} /> {group.classGroup}
          </span>
          <span>
            <CalendarBlank aria-hidden size={15} /> {group.period}
          </span>
          <span>
            <UsersThree aria-hidden size={15} /> {group.memberCount} de {group.capacity} membros
          </span>
        </div>
      </div>
      <div className={styles.heroActions}>
        {group.role ? (
          <span className={styles.organizerBadge}>{group.role}</span>
        ) : (
          <span className={styles.visitorBadge}>Não participante</span>
        )}

        {isOrganizer ? (
          <button
            className={styles.outlineButton}
            onClick={onOpenManage}
            type="button"
          >
            <GearSix aria-hidden size={17} /> Gerenciar grupo
          </button>
        ) : (
          <button
            className={group.isMember ? styles.memberButton : styles.primaryButton}
            onClick={onJoinClick}
            type="button"
          >
            {group.isMember ? "Membro da comunidade" : group.entryMode === "approval" ? "Solicitar entrada" : "Entrar no grupo"}
          </button>
        )}
        {joinFeedback ? (
          <p aria-live="polite" className={styles.joinFeedback}>
            {joinFeedback}
          </p>
        ) : null}
      </div>
    </header>
  );
}
