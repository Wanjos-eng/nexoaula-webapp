import { useState, useRef, useCallback } from "react";
import { type Channel, createChannel, updateChannel, archiveChannel } from "./api";
import { Failure, Loading } from "./AsyncState";
import { listGroupTopics } from "./schedule";
import { useRemote } from "./useRemote";
import { useChannels } from "./useChannels";
import s from "./AcademicCommunity.module.css";

export function ChannelManager({ groupId, onUpdated }: { groupId: string; onUpdated: () => void }) {
  const { channels, loading, error, reload } = useChannels(groupId);
  const topicsFetcher = useCallback((signal: AbortSignal) => listGroupTopics(groupId, signal), [groupId]);
  const topics = useRemote(`${groupId}/channel-topics`, topicsFetcher, true);
  const topicRef = useRef<HTMLSelectElement>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [formError, setFormError] = useState<unknown>();
  
  const [isCreating, setIsCreating] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  
  const nameRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const lock = useRef(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setFormError(undefined);
    setFeedback("");

    try {
      const name = nameRef.current?.value || "";
      const description = descRef.current?.value || null;
      await createChannel(groupId, { name, description, groupTopicId: topicRef.current?.value || null });
      setFeedback("Canal criado com sucesso.");
      setIsCreating(false);
      reload();
      onUpdated();
    } catch (err) {
      setFormError(err);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingChannel || lock.current) return;
    lock.current = true;
    setBusy(true);
    setFormError(undefined);
    setFeedback("");

    try {
      const name = nameRef.current?.value || "";
      const description = descRef.current?.value || null;
      await updateChannel(groupId, editingChannel.id, { name, description });
      setFeedback("Canal atualizado com sucesso.");
      setEditingChannel(null);
      reload();
      onUpdated();
    } catch (err) {
      setFormError(err);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function handleArchive(channelId: string) {
    if (lock.current) return;
    if (!confirm("Tem certeza que deseja arquivar este canal? Ele continuará visível no histórico do grupo.")) return;
    
    lock.current = true;
    setBusy(true);
    setFormError(undefined);
    setFeedback("");

    try {
      await archiveChannel(groupId, channelId);
      setFeedback("Canal arquivado.");
      reload();
      onUpdated();
    } catch (err) {
      setFormError(err);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  if (loading) return <section className={s.panel}><Loading /></section>;
  if (error) return <section className={s.panel}><Failure error={error} retry={reload} /></section>;

  return (
    <section className={s.panel}>
      <div>
        <p className={s.eyebrow}>Organização</p>
        <h2>Gerenciar canais</h2>
        <p>Organize os assuntos da comunidade em canais claros e fáceis de encontrar.</p>
      </div>

      {feedback && <div role="status" className={s.success}>{feedback}</div>}
      {formError ? <Failure error={formError} /> : null}

      <div className={s.actions} style={{ marginTop: "1rem", marginBottom: "1rem" }}>
        {!isCreating && !editingChannel && (
          <button className={s.primary} onClick={() => setIsCreating(true)} disabled={busy}>
            + Novo Canal
          </button>
        )}
      </div>

      {(isCreating || editingChannel) && (
        <form key={editingChannel?.id ?? "new"} className={s.form} onSubmit={isCreating ? handleCreate : handleUpdate}>
          <h3>{isCreating ? "Criar novo canal" : "Renomear canal"}</h3>
          <div className={s.field}>
            <label htmlFor="channelName">Nome do canal (ex: Dúvidas, Projetos)</label>
            <input
              id="channelName"
              ref={nameRef}
              required
              maxLength={80}
              disabled={busy}
              defaultValue={editingChannel?.name || ""}
              placeholder="Digite o nome do canal"
            />
          </div>
          <div className={s.field}>
            <label htmlFor="channelDesc">Descrição (opcional)</label>
            <textarea
              id="channelDesc"
              ref={descRef}
              maxLength={500}
              disabled={busy}
              defaultValue={editingChannel?.description || ""}
              placeholder="Qual o objetivo deste canal?"
              rows={2}
            />
          </div>
          {isCreating && (
            <div className={s.field}>
              <label htmlFor="channelTopic">Assunto do grupo (opcional)</label>
              {topics.error ? <Failure error={topics.error} retry={topics.reload} /> : null}
              <select id="channelTopic" ref={topicRef} disabled={busy || topics.loading || !!topics.error}>
                <option value="">Sem assunto específico</option>
                {topics.data?.map(topic => <option key={topic.id} value={topic.id}>{topic.topicName || topic.customTitle || "Assunto do grupo"}</option>)}
              </select>
            </div>
          )}
          <div className={s.actions}>
            <button className={s.primary} type="submit" disabled={busy}>
              {busy ? "Salvando..." : "Salvar"}
            </button>
            <button
              className={s.secondary}
              type="button"
              disabled={busy}
              onClick={() => {
                setIsCreating(false);
                setEditingChannel(null);
                setFormError(undefined);
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {!isCreating && !editingChannel && channels && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem" }}>
          {channels.length === 0 ? (
            <p>Nenhum canal encontrado.</p>
          ) : (
            channels.map(channel => (
              <div key={channel.id} className={s.row} style={{ padding: "1rem", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
                <div>
                  <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    # {channel.name}
                    {channel.status === "archived" && <span className={s.badge}>Arquivado</span>}
                  </h3>
                  <p>Assunto: {channel.topicName || "Sem assunto específico"}</p>
                  {channel.description && <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>{channel.description}</p>}
                </div>
                <div className={s.actions}>
                  {channel.status === "active" && (
                    <>
                      <button className={s.secondary} onClick={() => setEditingChannel(channel)} disabled={busy}>
                        Renomear
                      </button>
                      <button className={s.danger} onClick={() => void handleArchive(channel.id)} disabled={busy}>
                        Arquivar
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
