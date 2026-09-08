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
  canInteract?: boolean;
  activeChannelId: string;
  onSelectChannel: (channelId: string) => void;
  onOpenPanel: (panel: "participants" | "manage" | "meetings" | "plan") => void;
  pendingRequestsCount?: number;
  onCreateTopicClick?: () => void;
};

export function ChannelList({
  channels,
  canInteract = true,
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
        {channels.length === 0 ? <p>Nenhum assunto criado neste grupo.</p> : null}
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
              tabIndex={isActive ? 0 : -1}
              onKeyDown={(event) => {
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                event.preventDefault();
                const index = channels.findIndex((item) => item.id === channel.id);
                const next = event.key === "Home" ? 0 : event.key === "End" ? channels.length - 1
                  : (index + (event.key === "ArrowRight" ? 1 : -1) + channels.length) % channels.length;
                onSelectChannel(channels[next].id);
                (event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next])?.focus();
              }}
              type="button"
            >
              <Hash aria-hidden size={17} /> #{channel.name}
            </button>
          );
        })}
      </div>
      <button disabled={!canInteract} className={styles.createTopic} onClick={onCreateTopicClick} type="button">
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
        disabled={!canInteract}
        onClick={() => onOpenPanel("plan")}
        type="button"
      >
        <ListBullets aria-hidden size={18} /> Plano e cronograma
      </button>
    </aside>
  );
}
