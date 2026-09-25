"use client";

import {
  ArrowBendUpLeft,
  ArrowDown,
  Hash,
  PaperPlaneRight,
  PencilSimple,
  Trash,
} from "@phosphor-icons/react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuthSession } from "@/modules/auth";
import { Failure } from "./AsyncState";
import type { Channel } from "./api";
import { useChannels } from "./useChannels";
import {
  type ChannelMessage,
  type ChannelMessageReplyPreview,
} from "./messages.api";
import { useChannelMessages } from "./useChannelMessages";
import styles from "./ChannelChat.module.css";

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?") + (parts.at(-1)?.[0] ?? "");
}

function ReplyPreview({ preview }: { preview: ChannelMessageReplyPreview }) {
  return (
    <div className={styles.replyPreview}>
      <strong>{preview.authorName}</strong>
      <span>
        {preview.deleted
          ? "Mensagem removida"
          : preview.content || "Mensagem indisponível"}
      </span>
    </div>
  );
}

export function ChannelChat({ groupId }: { groupId: string }) {
  const { user } = useAuthSession();
  const { channels, loading: channelsLoading, error: channelsError, reload: reloadChannels } =
    useChannels(groupId);
  const [activeChannelId, setActiveChannelId] = useState<string>();
  const [draft, setDraft] = useState("");
  const [replyTarget, setReplyTarget] = useState<ChannelMessage | null>(null);
  const [editingTarget, setEditingTarget] = useState<ChannelMessage | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ChannelMessage | null>(null);
  const [unseenMessages, setUnseenMessages] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const initialScrollChannelRef = useRef<string>();
  const previousLastMessageRef = useRef<string>();
  const nearBottomRef = useRef(true);

  useEffect(() => {
    if (!channels?.length) {
      setActiveChannelId(undefined);
      return;
    }
    setActiveChannelId((current) => {
      if (current && channels.some((channel) => channel.id === current)) {
        return current;
      }
      return (
        channels.find((channel) => channel.status === "active")?.id ??
        channels[0].id
      );
    });
  }, [channels]);

  const activeChannel = useMemo(
    () => channels?.find((channel) => channel.id === activeChannelId),
    [activeChannelId, channels],
  );

  const messages = useChannelMessages(groupId, activeChannel?.id);

  useEffect(() => {
    setDraft("");
    setReplyTarget(null);
    setEditingTarget(null);
    setDeleteTarget(null);
    setUnseenMessages(false);
    nearBottomRef.current = true;
    previousLastMessageRef.current = undefined;
  }, [activeChannel?.id]);

  useEffect(() => {
    if (!activeChannel?.id || messages.loading) return;
    const scroller = scrollRef.current;
    if (!scroller) return;

    const lastMessageId = messages.messages.at(-1)?.id;
    if (initialScrollChannelRef.current !== activeChannel.id) {
      initialScrollChannelRef.current = activeChannel.id;
      previousLastMessageRef.current = lastMessageId;
      requestAnimationFrame(() => {
        scroller.scrollTop = scroller.scrollHeight;
        nearBottomRef.current = true;
      });
      return;
    }

    if (
      lastMessageId &&
      previousLastMessageRef.current &&
      lastMessageId !== previousLastMessageRef.current
    ) {
      if (nearBottomRef.current) {
        requestAnimationFrame(() => {
          scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
        });
      } else {
        setUnseenMessages(true);
      }
    }
    previousLastMessageRef.current = lastMessageId;
  }, [activeChannel?.id, messages.loading, messages.messages]);

  function updateNearBottom() {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const distance =
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    nearBottomRef.current = distance < 96;
    if (nearBottomRef.current) setUnseenMessages(false);
  }

  function scrollToLatest() {
    const scroller = scrollRef.current;
    if (!scroller) return;
    scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
    nearBottomRef.current = true;
    setUnseenMessages(false);
  }

  async function loadOlder() {
    const scroller = scrollRef.current;
    const previousHeight = scroller?.scrollHeight ?? 0;
    const previousTop = scroller?.scrollTop ?? 0;
    await messages.loadOlder();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!scroller) return;
        scroller.scrollTop =
          previousTop + Math.max(0, scroller.scrollHeight - previousHeight);
      });
    });
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const content = draft.trim();
    if (!content || !activeChannel || activeChannel.status !== "active") return;

    try {
      await messages.sendMessage({
        content,
        replyToMessageId: replyTarget?.id ?? null,
      });
      setDraft("");
      setReplyTarget(null);
      requestAnimationFrame(scrollToLatest);
    } catch {
      // O hook mantém o erro e preservamos o rascunho para nova tentativa.
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    if (!messages.mutating && draft.trim()) void submit();
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingTarget || !editingContent.trim()) return;
    try {
      await messages.editMessage(editingTarget.id, editingContent);
      setEditingTarget(null);
      setEditingContent("");
    } catch {
      // O rollback é feito pelo hook e o diálogo permanece aberto.
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await messages.removeMessage(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      // O rollback é feito pelo hook e a confirmação permanece aberta.
    }
  }

  if (channelsLoading) {
    return (
      <Card className={styles.card} id="canais">
        <div className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Comunidade</p>
            <h2>Conversas da comunidade</h2>
          </div>
        </div>
        <div className={styles.loading} role="status" aria-label="Carregando conversas">
          <Skeleton variant="row" />
          <Skeleton variant="card" />
        </div>
      </Card>
    );
  }

  if (channelsError) {
    return (
      <Card className={styles.card} id="canais">
        <Failure error={channelsError} retry={reloadChannels} />
      </Card>
    );
  }

  if (!channels?.length) {
    return (
      <Card className={styles.card} id="canais">
        <div className={styles.emptyChannels}>
          <Hash aria-hidden size={28} />
          <div>
            <p className={styles.eyebrow}>Comunidade</p>
            <h2>Nenhum canal disponível</h2>
            <p>
              Assim que um organizador criar canais, as conversas aparecerão aqui.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={styles.card} id="canais">
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Comunidade</p>
          <h2>Conversas da comunidade</h2>
          <p>Converse por assunto sem perder o contexto do grupo.</p>
        </div>
        <Badge variant={activeChannel?.status === "active" ? "success" : "neutral"}>
          {activeChannel?.status === "active" ? "Canal ativo" : "Somente leitura"}
        </Badge>
      </div>

      <label className={styles.mobileChannelSelect}>
        <span>Canal</span>
        <select
          onChange={(event) => setActiveChannelId(event.target.value)}
          value={activeChannelId ?? ""}
        >
          {channels.map((channel) => (
            <option key={channel.id} value={channel.id}>
              #{channel.name}
              {channel.status === "archived" ? " · arquivado" : ""}
            </option>
          ))}
        </select>
      </label>

      <div className={styles.layout}>
        <aside className={styles.sidebar} aria-label="Canais da comunidade">
          <div className={styles.sidebarLabel}>Canais</div>
          <div className={styles.channelButtons}>
            {channels.map((channel) => {
              const active = channel.id === activeChannelId;
              return (
                <button
                  aria-current={active ? "page" : undefined}
                  className={active ? styles.channelButtonActive : styles.channelButton}
                  key={channel.id}
                  onClick={() => setActiveChannelId(channel.id)}
                  type="button"
                >
                  <Hash aria-hidden size={16} />
                  <span>
                    <strong>{channel.name}</strong>
                    <small>
                      {channel.status === "archived"
                        ? "Arquivado"
                        : channel.topicName || "Canal ativo"}
                    </small>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className={styles.conversation} aria-label={`Canal ${activeChannel?.name ?? ""}`}>
          <div className={styles.conversationHeader}>
            <div>
              <div className={styles.channelTitle}>
                <Hash aria-hidden size={18} />
                <h3>{activeChannel?.name}</h3>
              </div>
              <p>
                {activeChannel?.description ||
                  activeChannel?.topicName ||
                  "Conversa da comunidade"}
              </p>
            </div>
            <Button
              disabled={messages.loading || messages.refreshing}
              loading={messages.refreshing}
              onClick={() => void messages.refresh()}
              size="sm"
              type="button"
              variant="ghost"
            >
              Atualizar
            </Button>
          </div>

          {messages.error && !messages.loading ? (
            <div className={styles.stateBox}>
              <Failure error={messages.error} retry={() => void messages.reload()} />
            </div>
          ) : null}

          <div
            aria-busy={messages.loading || undefined}
            aria-live="polite"
            className={styles.history}
            onScroll={updateNearBottom}
            ref={scrollRef}
            role="log"
          >
            {messages.loading ? (
              <div className={styles.messageSkeletons} role="status">
                <Skeleton variant="row" />
                <Skeleton variant="row" />
                <Skeleton variant="row" />
              </div>
            ) : (
              <>
                {messages.hasOlder ? (
                  <div className={styles.olderControl}>
                    <Button
                      disabled={messages.loadingOlder}
                      loading={messages.loadingOlder}
                      onClick={() => void loadOlder()}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      Carregar mensagens anteriores
                    </Button>
                  </div>
                ) : null}

                {!messages.messages.length ? (
                  <div className={styles.emptyMessages}>
                    <Hash aria-hidden size={24} />
                    <h3>Comece a conversa</h3>
                    <p>
                      Seja a primeira pessoa a compartilhar uma dúvida ou contexto
                      neste canal.
                    </p>
                  </div>
                ) : (
                  <div className={styles.messageList}>
                    {messages.messages.map((message) => {
                      const own = message.authorId === user.id;
                      const deleted = Boolean(message.deletedAt);
                      return (
                        <article
                          className={own ? styles.messageOwn : styles.message}
                          key={message.id}
                        >
                          <div className={styles.avatar} aria-hidden>
                            {initials(message.authorName).toUpperCase()}
                          </div>
                          <div className={styles.messageBody}>
                            <div className={styles.messageMeta}>
                              <strong>{own ? "Você" : message.authorName}</strong>
                              <time dateTime={message.createdAt}>
                                {formatMessageTime(message.createdAt)}
                              </time>
                              {message.editedAt && !deleted ? <span>Editada</span> : null}
                            </div>

                            <div className={styles.bubble}>
                              {message.replyPreview ? (
                                <ReplyPreview preview={message.replyPreview} />
                              ) : null}
                              {deleted ? (
                                <p className={styles.deletedMessage}>Mensagem removida</p>
                              ) : (
                                <p>{message.content}</p>
                              )}
                            </div>

                            {!deleted && activeChannel?.status === "active" ? (
                              <div className={styles.messageActions}>
                                <button
                                  onClick={() => setReplyTarget(message)}
                                  type="button"
                                >
                                  <ArrowBendUpLeft aria-hidden size={14} />
                                  Responder
                                </button>
                                {own ? (
                                  <>
                                    <button
                                      onClick={() => {
                                        setEditingTarget(message);
                                        setEditingContent(message.content ?? "");
                                      }}
                                      type="button"
                                    >
                                      <PencilSimple aria-hidden size={14} />
                                      Editar
                                    </button>
                                    <button
                                      onClick={() => setDeleteTarget(message)}
                                      type="button"
                                    >
                                      <Trash aria-hidden size={14} />
                                      Excluir
                                    </button>
                                  </>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {unseenMessages ? (
            <button className={styles.newMessages} onClick={scrollToLatest} type="button">
              <ArrowDown aria-hidden size={15} />
              Novas mensagens
            </button>
          ) : null}

          {messages.mutationError ? (
            <div className={styles.mutationError}>
              <Failure error={messages.mutationError} />
            </div>
          ) : null}

          {activeChannel?.status === "archived" ? (
            <div className={styles.readOnlyNotice}>
              Este canal foi arquivado. O histórico continua disponível em modo
              somente leitura.
            </div>
          ) : (
            <form className={styles.composer} onSubmit={(event) => void submit(event)}>
              {replyTarget ? (
                <div className={styles.replyComposer}>
                  <div>
                    <span>Respondendo a {replyTarget.authorId === user.id ? "você" : replyTarget.authorName}</span>
                    <p>{replyTarget.content || "Mensagem removida"}</p>
                  </div>
                  <button
                    aria-label="Cancelar resposta"
                    onClick={() => setReplyTarget(null)}
                    type="button"
                  >
                    ×
                  </button>
                </div>
              ) : null}
              <div className={styles.composerRow}>
                <label className={styles.composerField}>
                  <span className="sr-only">Mensagem para #{activeChannel?.name}</span>
                  <textarea
                    aria-label={`Mensagem para #${activeChannel?.name ?? ""}`}
                    disabled={messages.mutating}
                    maxLength={4000}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleComposerKeyDown}
                    placeholder={`Mensagem em #${activeChannel?.name ?? ""}`}
                    rows={2}
                    value={draft}
                  />
                  <small>{draft.length}/4000 · Enter envia · Shift+Enter quebra linha</small>
                </label>
                <Button
                  aria-label="Enviar mensagem"
                  disabled={!draft.trim()}
                  icon={<PaperPlaneRight aria-hidden size={18} />}
                  loading={messages.mutating}
                  type="submit"
                >
                  Enviar
                </Button>
              </div>
            </form>
          )}
        </section>
      </div>

      {editingTarget ? (
        <Dialog
          descriptionId="edit-message-description"
          onClose={() => {
            if (!messages.mutating) setEditingTarget(null);
          }}
          titleId="edit-message-title"
        >
          <form className={styles.dialogContent} onSubmit={(event) => void saveEdit(event)}>
            <div>
              <p className={styles.eyebrow}>Mensagem</p>
              <h2 id="edit-message-title">Editar mensagem</h2>
              <p id="edit-message-description">
                O conteúdo atualizado ficará marcado como editado para os demais
                participantes.
              </p>
            </div>
            <label className={styles.dialogField}>
              <span>Conteúdo</span>
              <textarea
                autoFocus
                disabled={messages.mutating}
                maxLength={4000}
                onChange={(event) => setEditingContent(event.target.value)}
                rows={5}
                value={editingContent}
              />
            </label>
            <div className={styles.dialogActions}>
              <Button
                disabled={messages.mutating}
                onClick={() => setEditingTarget(null)}
                type="button"
                variant="secondary"
              >
                Cancelar
              </Button>
              <Button
                disabled={!editingContent.trim()}
                loading={messages.mutating}
                type="submit"
              >
                Salvar edição
              </Button>
            </div>
          </form>
        </Dialog>
      ) : null}

      {deleteTarget ? (
        <Dialog
          descriptionId="delete-message-description"
          onClose={() => {
            if (!messages.mutating) setDeleteTarget(null);
          }}
          titleId="delete-message-title"
        >
          <div className={styles.dialogContent}>
            <div>
              <p className={styles.eyebrow}>Mensagem</p>
              <h2 id="delete-message-title">Excluir esta mensagem?</h2>
              <p id="delete-message-description">
                O texto deixará de aparecer para a comunidade, mas o registro será
                preservado no histórico do sistema.
              </p>
            </div>
            <div className={styles.dialogActions}>
              <Button
                disabled={messages.mutating}
                onClick={() => setDeleteTarget(null)}
                type="button"
                variant="secondary"
              >
                Cancelar
              </Button>
              <Button
                loading={messages.mutating}
                onClick={() => void confirmDelete()}
                type="button"
                variant="danger"
              >
                Excluir mensagem
              </Button>
            </div>
          </div>
        </Dialog>
      ) : null}
    </Card>
  );
}
