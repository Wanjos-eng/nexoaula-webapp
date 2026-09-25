"use client";

import { Hash, Plus } from "@phosphor-icons/react";
import { useCallback, useRef, useState, type FormEvent } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  archiveChannel,
  createChannel,
  type Channel,
  updateChannel,
} from "./api";
import { Failure } from "./AsyncState";
import { listGroupTopics } from "./schedule";
import { useChannels } from "./useChannels";
import { useRemote } from "./useRemote";
import styles from "./ChannelManager.module.css";

export function ChannelManager({
  groupId,
  onUpdated,
}: {
  groupId: string;
  onUpdated: () => void;
}) {
  const { channels, loading, error, reload } = useChannels(groupId);
  const topicsFetcher = useCallback(
    (signal: AbortSignal) => listGroupTopics(groupId, signal),
    [groupId],
  );
  const topics = useRemote(
    `${groupId}/channel-topics`,
    topicsFetcher,
    true,
  );

  const topicRef = useRef<HTMLSelectElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const lock = useRef(false);

  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [formError, setFormError] = useState<unknown>();
  const [isCreating, setIsCreating] = useState(false);
  const [editingChannel, setEditingChannel] =
    useState<Channel | null>(null);
  const [archiveTarget, setArchiveTarget] =
    useState<Channel | null>(null);

  function resetEditor() {
    setIsCreating(false);
    setEditingChannel(null);
    setFormError(undefined);
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;

    lock.current = true;
    setBusy(true);
    setFormError(undefined);
    setFeedback("");

    try {
      const name = nameRef.current?.value.trim() || "";
      const description =
        descRef.current?.value.trim() || null;
      await createChannel(groupId, {
        name,
        description,
        groupTopicId: topicRef.current?.value || null,
      });
      setFeedback("Canal criado com sucesso.");
      resetEditor();
      reload();
      onUpdated();
    } catch (cause) {
      setFormError(cause);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function handleUpdate(event: FormEvent) {
    event.preventDefault();
    if (!editingChannel || lock.current) return;

    lock.current = true;
    setBusy(true);
    setFormError(undefined);
    setFeedback("");

    try {
      const name = nameRef.current?.value.trim() || "";
      const description =
        descRef.current?.value.trim() || null;
      await updateChannel(groupId, editingChannel.id, {
        name,
        description,
      });
      setFeedback("Canal atualizado com sucesso.");
      resetEditor();
      reload();
      onUpdated();
    } catch (cause) {
      setFormError(cause);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function confirmArchive() {
    if (!archiveTarget || lock.current) return;

    lock.current = true;
    setBusy(true);
    setFormError(undefined);
    setFeedback("");

    try {
      await archiveChannel(groupId, archiveTarget.id);
      setFeedback("Canal arquivado.");
      setArchiveTarget(null);
      reload();
      onUpdated();
    } catch (cause) {
      setFormError(cause);
      setArchiveTarget(null);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Card className={styles.panel}>
        <div role="status" aria-label="Carregando gestão de canais">
          <span className="sr-only">Carregando canais...</span>
          <Skeleton variant="row" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={styles.panel}>
        <Failure error={error} retry={reload} />
      </Card>
    );
  }

  return (
    <Card className={styles.panel}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Organização</p>
          <h2>Gerenciar canais</h2>
          <p>
            Organize os assuntos da comunidade em canais claros e fáceis de encontrar.
          </p>
        </div>

        {!isCreating && !editingChannel ? (
          <Button
            icon={<Plus aria-hidden size={17} />}
            onClick={() => {
              setFeedback("");
              setIsCreating(true);
            }}
            size="sm"
            type="button"
          >
            Novo canal
          </Button>
        ) : null}
      </div>

      {feedback ? (
        <div className={styles.success} role="status">
          {feedback}
        </div>
      ) : null}
      {formError ? <Failure error={formError} /> : null}

      {isCreating || editingChannel ? (
        <form
          className={styles.editor}
          key={editingChannel?.id ?? "new"}
          onSubmit={isCreating ? handleCreate : handleUpdate}
        >
          <div className={styles.editorHeading}>
            <h3>
              {isCreating ? "Criar novo canal" : "Editar canal"}
            </h3>
            <p>
              {isCreating
                ? "Defina um nome curto e, se fizer sentido, vincule um assunto."
                : "Atualize o nome e a descrição sem perder o histórico do canal."}
            </p>
          </div>

          <label className={styles.field}>
            <span>Nome do canal</span>
            <input
              defaultValue={editingChannel?.name || ""}
              disabled={busy}
              id="channelName"
              maxLength={80}
              placeholder="Ex.: Dúvidas, Projetos"
              ref={nameRef}
              required
            />
          </label>

          <label className={styles.field}>
            <span>Descrição (opcional)</span>
            <textarea
              defaultValue={editingChannel?.description || ""}
              disabled={busy}
              id="channelDesc"
              maxLength={500}
              placeholder="Qual o objetivo deste canal?"
              ref={descRef}
              rows={3}
            />
          </label>

          {isCreating ? (
            <label className={styles.field}>
              <span>Assunto da comunidade (opcional)</span>
              {topics.error ? (
                <Failure
                  error={topics.error}
                  retry={topics.reload}
                />
              ) : null}
              <select
                disabled={
                  busy || topics.loading || Boolean(topics.error)
                }
                id="channelTopic"
                ref={topicRef}
              >
                <option value="">Sem assunto específico</option>
                {topics.data?.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.topicName ||
                      topic.customTitle ||
                      "Assunto da comunidade"}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className={styles.editorActions}>
            <Button loading={busy} size="sm" type="submit">
              Salvar
            </Button>
            <Button
              disabled={busy}
              onClick={resetEditor}
              size="sm"
              type="button"
              variant="secondary"
            >
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <div className={styles.list}>
          {!channels?.length ? (
            <div className={styles.empty}>
              <Hash aria-hidden size={28} />
              <div>
                <h3>Nenhum canal criado</h3>
                <p>
                  Crie um canal para organizar um tema ou material específico.
                </p>
              </div>
            </div>
          ) : (
            channels.map((channel) => (
              <article className={styles.row} key={channel.id}>
                <div className={styles.channelIcon}>
                  <Hash aria-hidden size={18} />
                </div>

                <div className={styles.channelCopy}>
                  <div className={styles.channelHeading}>
                    <h3>{channel.name}</h3>
                    {channel.status === "archived" ? (
                      <Badge>Arquivado</Badge>
                    ) : null}
                  </div>
                  <p>
                    {channel.topicName || "Sem assunto específico"}
                  </p>
                  {channel.description ? (
                    <small>{channel.description}</small>
                  ) : null}
                </div>

                {channel.status === "active" ? (
                  <div className={styles.actions}>
                    <Button
                      disabled={busy}
                      onClick={() => {
                        setFeedback("");
                        setEditingChannel(channel);
                      }}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      Renomear
                    </Button>
                    <Button
                      disabled={busy}
                      onClick={() => setArchiveTarget(channel)}
                      size="sm"
                      type="button"
                      variant="danger"
                    >
                      Arquivar
                    </Button>
                  </div>
                ) : null}
              </article>
            ))
          )}
        </div>
      )}

      {archiveTarget ? (
        <Dialog
          descriptionId="archive-channel-description"
          onClose={() => {
            if (!busy) setArchiveTarget(null);
          }}
          titleId="archive-channel-title"
        >
          <div className={styles.dialogContent}>
            <div>
              <p className={styles.eyebrow}>Organização</p>
              <h2 id="archive-channel-title">Arquivar canal?</h2>
              <p id="archive-channel-description">
                <strong>#{archiveTarget.name}</strong> continuará visível no histórico, mas não poderá mais ser editado.
              </p>
            </div>

            <div className={styles.dialogActions}>
              <Button
                disabled={busy}
                onClick={() => setArchiveTarget(null)}
                type="button"
                variant="secondary"
              >
                Manter canal
              </Button>
              <Button
                loading={busy}
                onClick={() => void confirmArchive()}
                type="button"
                variant="danger"
              >
                Arquivar canal
              </Button>
            </div>
          </div>
        </Dialog>
      ) : null}
    </Card>
  );
}
