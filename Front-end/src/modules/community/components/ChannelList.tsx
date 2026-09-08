import {
  CalendarBlank,
  Hash,
  ListBullets,
  Plus,
  UserPlus,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import type { GroupChannel } from "@/modules/community/types";

import styles from "./GroupDetailView.module.css";

type ChannelListProps = {
  channels: GroupChannel[];
  activeChannelId: string;
  onSelectChannel: (channelId: string) => void;
  onOpenPanel: (panel: "participants" | "manage" | "meetings" | "plan") => void;
  pendingRequestsCount?: number;
  onCreateTopicClick?: () => void;
};

export function ChannelList({
  channels,
  activeChannelId,
  onSelectChannel,
  onOpenPanel,
  pendingRequestsCount = 0,
  onCreateTopicClick,
}: ChannelListProps) {
  return (
    <aside className={styles.channelSidebar} aria-label="Canais do grupo">
      <p className={styles.channelHeading}>Assuntos em discussão</p>
      <div className={styles.channelList} role="tablist" aria-label="Lista de tópicos">
        {channels.map((channel) => {
          const isActive = channel.id === activeChannelId;
          return (
            <button
              aria-current={isActive ? "page" : undefined}
              aria-selected={isActive}
              className={isActive ? styles.channelActive : styles.channel}
              key={channel.id}
              onClick={() => onSelectChannel(channel.id)}
              role="tab"
              type="button"
            >
              <Hash aria-hidden size={17} /> #{channel.name}
            </button>
          );
        })}
      </div>
      <button className={styles.createTopic} onClick={onCreateTopicClick} type="button">
        <Plus aria-hidden size={16} /> Criar assunto
      </button>
      <div className={styles.channelDivider} />
      <button
        className={styles.utilityChannel}
        onClick={() => onOpenPanel("meetings")}
        type="button"
      >
        <CalendarBlank aria-hidden size={18} /> Encontros
      </button>
      <button
        className={styles.utilityChannel}
        onClick={() => onOpenPanel("participants")}
        type="button"
      >
        <UsersThree aria-hidden size={18} /> Participantes
      </button>
      {pendingRequestsCount > 0 ? (
        <button
          className={styles.utilityChannel}
          onClick={() => onOpenPanel("manage")}
          type="button"
        >
          <UserPlus aria-hidden size={18} /> Solicitações de entrada{" "}
          <span>{pendingRequestsCount}</span>
        </button>
      ) : null}
      <button
        className={styles.utilityChannel}
        onClick={() => onOpenPanel("plan")}
        type="button"
      >
        <ListBullets aria-hidden size={18} /> Plano e cronograma
      </button>
    </aside>
  );
}
