"use client";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { apiClient } from "@/lib/api";
import {
  read,
  entryLabels,
  visibilityLabels,
  PAGE_SIZE,
  type Group,
  type Participation,
  type Participant,
} from "./api";
import { useRemote } from "./useRemote";
import { Failure, Loading } from "./AsyncState";
import { GroupForm } from "./GroupForm";
import { GroupSchedule } from "./GroupSchedule";
import { invalidateGroups } from "./schedule";
import { ChannelManager } from "./ChannelManager";
import { useChannels } from "./useChannels";
import s from "./AcademicCommunity.module.css";

export function GroupDetail({ groupId }: { groupId: string }) {
  const fetcher = useCallback(
    async (signal: AbortSignal) => {
      const [group, participation] = await Promise.all([
        read<Group>(`groups/${groupId}`, signal),
        read<Participation>(`groups/${groupId}/participation`, signal),
      ]);
      return { group, participation };
    },
    [groupId],
  );
  const remote = useRemote(groupId, fetcher);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<unknown>();
  const [feedback, setFeedback] = useState("");
  const [editing, setEditing] = useState(false);
  async function join() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(undefined);
    setFeedback("");
    try {
      const { data } = await apiClient.post<{ status: string }>(
        `/v1/groups/${groupId}/join`,
        { body: {} },
      );
      setFeedback(
        data.status === "active"
          ? "Você entrou no grupo. Bons estudos!"
          : "Solicitação enviada. Aguarde a decisão de um organizador.",
      );
    } catch (e) {
      setError(e);
    } finally {
      invalidateGroups();
      remote.reload();
      lock.current = false;
      setBusy(false);
    }
  }
  const group = remote.data?.group;
  const participation = remote.data?.participation;
  return (
    <div className={s.page}>
      <Link className={s.back} href="/grupos">
        ← Voltar aos grupos
      </Link>
      {feedback ? (
        <div role="status" className={s.success}>
          {feedback}
        </div>
      ) : null}
      {error ? <Failure error={error} /> : null}
      {remote.loading ? (
        <Loading />
      ) : remote.error ? (
        <Failure error={remote.error} retry={remote.reload} />
      ) : group && participation ? (
        <>
          <header className={s.header}>
            <div>
              <p className={s.eyebrow}>
                Grupo de estudo · {visibilityLabels[group.visibility]}
              </p>
              <h1 className={s.text}>{group.name}</h1>
              <p>
                {entryLabels[group.joinPolicy]} · {participation.memberCount}{" "}
                {participation.memberCount === 1
                  ? "participante"
                  : "participantes"}
              </p>
            </div>
            <span className={s.badge}>
              {participation.role === "owner"
                ? "Organizador"
                : participation.status === "active"
                  ? "Você participa"
                  : participation.status === "pending"
                    ? "Solicitação pendente"
                    : "Conheça o grupo"}
            </span>
          </header>
          <div className={s.columns}>
            <section className={s.panel}>
              <h2>Sobre o grupo</h2>
              <p className={s.text}>
                {group.description ||
                  "O organizador ainda não adicionou uma descrição."}
              </p>
              <h2>Combinados</h2>
              <p className={s.text}>
                {group.rules || "Nenhum combinado informado."}
              </p>
            </section>
            <aside className={s.panel}>
              <h2>Participação</h2>
              {participation.status === "active" ? (
                <p>Você faz parte deste grupo.</p>
              ) : participation.status === "pending" ? (
                <p>
                  Seu pedido está com os organizadores. Volte aqui para
                  acompanhar a resposta.
                </p>
              ) : group.status !== "active" ? (
                <p>Este grupo não aceita novos participantes.</p>
              ) : group.joinPolicy === "invite_only" ||
                group.visibility === "private" ? (
                <p>Este grupo recebe participantes somente por convite.</p>
              ) : (
                <>
                  <p>
                    {group.joinPolicy === "open"
                      ? "Entre e faça parte desta comunidade de estudos."
                      : "Envie seu pedido para os organizadores do grupo."}
                  </p>
                  <button
                    className={s.primary}
                    disabled={busy}
                    onClick={() => void join()}
                  >
                    {busy
                      ? "Enviando…"
                      : group.joinPolicy === "open"
                        ? "Entrar no grupo"
                        : "Solicitar entrada"}
                  </button>
                </>
              )}
              <button className={s.secondary} onClick={remote.reload}>
                Atualizar participação
              </button>
              {participation.role === "owner" ? (
                <button
                  className={s.secondary}
                  aria-expanded={editing}
                  onClick={() => setEditing(!editing)}
                >
                  Configurar grupo
                </button>
              ) : null}
            </aside>
          </div>
          {participation.status === "active" ? (
            <GroupSchedule key={groupId} groupId={groupId} canManage={participation.canManage} />
          ) : (
            <section className={s.panel}><h2>Plano e cronograma</h2><p>Entre no grupo para acessar as aulas publicadas.</p></section>
          )}
          {editing && participation.role === "owner" ? (
            <GroupForm
              group={group}
              onSaved={() => {
                setEditing(false);
                setFeedback("Configurações salvas.");
                invalidateGroups();
                remote.reload();
              }}
            />
          ) : null}
          {participation.status === "active" ? (
            <ChannelView groupId={groupId} />
          ) : null}
          {participation.canManage ? (
            <MemberManagement
              key={`member-management-${groupId}`}
              groupId={groupId}
              onChanged={(message, error) => {
                setFeedback(message);
                setError(error);
                remote.reload();
              }}
            />
          ) : null}
          {participation.role === "owner" ? (
            <ChannelManager
              key={`channel-management-${groupId}`}
              groupId={groupId}
              onUpdated={() => remote.reload()}
            />
          ) : null}
        </>

      ) : null}
    </div>
  );
}
function MemberManagement({
  groupId,
  onChanged,
}: {
  groupId: string;
  onChanged: (message: string, error?: unknown) => void;
}) {
  const [pending, setPending] = useState(true);
  const [offset, setOffset] = useState(0);
  const path = `groups/${groupId}/members?pending=${pending}&offset=${offset}&limit=${PAGE_SIZE + 1}`;
  const fetcher = useCallback(
    (signal: AbortSignal) => read<Participant[]>(path, signal),
    [path],
  );
  const remote = useRemote(path, fetcher);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<unknown>();
  const [confirmation, setConfirmation] = useState<Participant>();
  const [message, setMessage] = useState("");
  async function act(
    member: Participant,
    action: "approve" | "reject" | "remove",
  ) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(undefined);
    setMessage("");
    let resultMessage = "";
    let resultError: unknown;
    try {
      await apiClient.patch(`/v1/groups/${groupId}/members/${member.userId}`, {
        body: { action },
      });
      resultMessage =
        action === "approve"
          ? "Solicitação aprovada."
          : action === "reject"
            ? "Solicitação recusada."
            : "Participante removido.";
      setMessage(resultMessage);
      setConfirmation(undefined);
    } catch (e) {
      resultError = e;
      setError(e);
    } finally {
      invalidateGroups();
      lock.current = false;
      setBusy(false);
      remote.reload();
      onChanged(resultMessage, resultError);
    }
  }
  return (
    <section className={s.panel}>
      <div>
        <p className={s.eyebrow}>Organização</p>
        <h2>Gerenciar participantes</h2>
      </div>
      <div className={s.actions}>
        <button
          disabled={busy}
          className={pending ? s.primary : s.secondary}
          onClick={() => {
            setPending(true);
            setOffset(0);
            setConfirmation(undefined);
          }}
        >
          Solicitações
        </button>
        <button
          disabled={busy}
          className={!pending ? s.primary : s.secondary}
          onClick={() => {
            setPending(false);
            setOffset(0);
            setConfirmation(undefined);
          }}
        >
          Membros ativos
        </button>
      </div>
      {message ? (
        <div role="status" className={s.success}>
          {message}
        </div>
      ) : null}
      {error ? <Failure error={error} /> : null}
      {remote.loading ? (
        <Loading />
      ) : remote.error ? (
        <Failure error={remote.error} retry={remote.reload} />
      ) : !remote.data?.length ? (
        <p>
          {pending
            ? "Nenhuma solicitação pendente. Os novos pedidos aparecerão aqui."
            : "Nenhum participante nesta página."}
        </p>
      ) : (
        remote.data.slice(0, PAGE_SIZE).map((member) => (
          <div className={s.row} key={member.userId}>
            <div>
              <h3>{member.displayName}</h3>
              <p>
                {pending
                  ? "Aguardando aprovação"
                  : member.role === "owner"
                    ? "Proprietário"
                    : member.role === "moderator"
                      ? "Moderador"
                      : "Participante"}
              </p>
            </div>
            <div className={s.actions}>
              {pending ? (
                <>
                  <button
                    className={s.primary}
                    disabled={busy}
                    onClick={() => void act(member, "approve")}
                  >
                    Aprovar
                  </button>
                  <button
                    className={s.secondary}
                    disabled={busy}
                    onClick={() => void act(member, "reject")}
                  >
                    Recusar
                  </button>
                </>
              ) : member.role !== "owner" ? (
                <button
                  className={s.danger}
                  disabled={busy}
                  onClick={() => setConfirmation(member)}
                >
                  Remover
                </button>
              ) : null}
            </div>
          </div>
        ))
      )}
      {confirmation ? (
        <div className={s.error}>
          <p>
            Remover {confirmation.displayName} do grupo? A pessoa perderá o
            acesso de participante.
          </p>
          <div className={s.actions}>
            <button
              className={s.danger}
              disabled={busy}
              onClick={() => void act(confirmation, "remove")}
            >
              Confirmar remoção
            </button>
            <button
              className={s.secondary}
              disabled={busy}
              onClick={() => setConfirmation(undefined)}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
      {offset > 0 || (remote.data?.length ?? 0) > PAGE_SIZE ? (
        <div className={s.actions}>
          <button
            className={s.secondary}
            disabled={busy || remote.loading || !offset}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          >
            Anterior
          </button>
          <button
            className={s.secondary}
            disabled={
              busy || remote.loading || (remote.data?.length ?? 0) <= PAGE_SIZE
            }
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            Próxima
          </button>
        </div>
      ) : null}
    </section>
  );
}

function ChannelView({ groupId }: { groupId: string }) {
  const { channels, loading, error, reload } = useChannels(groupId);

  if (loading) return <section className={s.panel}><Loading /></section>;
  if (error) return <section className={s.panel}><Failure error={error} retry={reload} /></section>;
  if (!channels?.length) return null;

  return (
    <section className={s.panel}>
      <div>
        <p className={s.eyebrow}>Comunidade</p>
        <h2>Canais de discussão</h2>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "1rem" }}>
        {channels.map(channel => (
          <div key={channel.id} className={s.row} style={{ padding: "1rem", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
            <div>
              <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                # {channel.name}
                {channel.status === "archived" && <span className={s.badge}>Arquivado</span>}
              </h3>
              {channel.description && <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>{channel.description}</p>}
            </div>
            <div className={s.actions}>
              {channel.status === "active" ? (
                <button className={s.secondary} disabled>
                  Chat disponível em breve
                </button>
              ) : (
                <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>Este canal foi arquivado e está somente leitura.</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
