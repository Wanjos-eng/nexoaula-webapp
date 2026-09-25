"use client";

import {
  Hash,
  LockKey,
  UsersThree,
} from "@phosphor-icons/react";
import { useCallback, useRef, useState } from "react";

import { BackButton } from "@/components/ui/BackButton";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
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
import { Failure } from "./AsyncState";
import { GroupForm } from "./GroupForm";
import { GroupSchedule } from "./GroupSchedule";
import { invalidateGroups } from "./schedule";
import { ChannelManager } from "./ChannelManager";
import { useChannels } from "./useChannels";
import styles from "./CommunityDetail.module.css";

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

  const remote = useRemote(groupId, fetcher, true);
  const [channelRevision, setChannelRevision] = useState(0);
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
    } catch (cause) {
      setError(cause);
    } finally {
      invalidateGroups();
      remote.reload();
      lock.current = false;
      setBusy(false);
    }
  }

  const group = remote.data?.group;
  const participation = remote.data?.participation;

  if (remote.loading) {
    return (
      <div className={styles.page} role="status" aria-label="Carregando comunidade">
        <span className="sr-only">Carregando comunidade...</span>
        <Skeleton className={styles.backSkeleton} variant="text" />
        <Skeleton variant="card" />
        <div className={styles.overviewGrid}>
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
      </div>
    );
  }

  if (remote.error || !group || !participation) {
    return (
      <div className={styles.page}>
        <BackButton fallback="/grupos">Voltar para comunidades</BackButton>
        <Card className={styles.errorCard} role="alert">
          <Failure error={remote.error ?? new Error("Comunidade indisponível.")} retry={remote.reload} />
        </Card>
      </div>
    );
  }

  const isMember = participation.status === "active";
  const roleLabel =
    participation.role === "owner"
      ? "Organizador"
      : participation.role === "moderator"
        ? "Moderador"
        : isMember
          ? "Membro"
          : participation.status === "pending"
            ? "Solicitação pendente"
            : "Visitante";

  return (
    <div className={styles.page}>
      <BackButton fallback="/grupos">Voltar para comunidades</BackButton>

      <section className={styles.hero}>
        <div className={styles.heroBadges}>
          {group.subjectName ? (
            <Badge variant="success">{group.subjectName}</Badge>
          ) : null}
          <Badge>{visibilityLabels[group.visibility]}</Badge>
          <Badge variant={isMember ? "info" : "neutral"}>{roleLabel}</Badge>
        </div>

        <div className={styles.heroCopy}>
          <h1>{group.name}</h1>
          <p>
            {group.period ? `${group.period} · ` : ""}
            {entryLabels[group.joinPolicy]} · {participation.memberCount}{" "}
            {participation.memberCount === 1 ? "participante" : "participantes"}
          </p>
        </div>

        {isMember ? (
          <nav className={styles.sectionNav} aria-label="Seções da comunidade">
            <a href="#visao-geral">Visão geral</a>
            <a href="#encontros">Encontros</a>
            <a href="#cronograma">Cronograma</a>
            <a href="#canais">Canais</a>
            {participation.canManage ? <a href="#membros">Membros</a> : null}
            {participation.canManage ? <a href="#gestao">Gestão</a> : null}
          </nav>
        ) : null}
      </section>

      {feedback ? (
        <div className={styles.success} role="status">
          {feedback}
        </div>
      ) : null}
      {error ? <Failure error={error} /> : null}

      <div className={styles.overviewGrid} id="visao-geral">
        <Card className={styles.aboutCard}>
          <div>
            <p className={styles.eyebrow}>Sobre</p>
            <h2>Visão geral</h2>
          </div>

          <div className={styles.aboutSection}>
            <h3>Sobre a comunidade</h3>
            <p>
              {group.description ||
                "O organizador ainda não adicionou uma descrição."}
            </p>
          </div>

          <div className={styles.aboutSection}>
            <h3>Combinados</h3>
            <p>{group.rules || "Nenhum combinado informado."}</p>
          </div>
        </Card>

        <Card className={styles.participationCard}>
          <div className={styles.participationIcon}>
            {group.visibility === "private" ? (
              <LockKey aria-hidden size={22} />
            ) : (
              <UsersThree aria-hidden size={22} />
            )}
          </div>
          <div>
            <p className={styles.eyebrow}>Participação</p>
            <h2>{roleLabel}</h2>
          </div>

          {isMember ? (
            <p>Você faz parte desta comunidade e pode acessar o conteúdo compartilhado.</p>
          ) : participation.status === "pending" ? (
            <p>Seu pedido está com os organizadores. Volte aqui para acompanhar a resposta.</p>
          ) : group.status !== "active" ? (
            <p>Esta comunidade não aceita novos participantes no momento.</p>
          ) : group.joinPolicy === "invite_only" ||
            group.visibility === "private" ? (
            <p>Esta comunidade recebe participantes somente por convite.</p>
          ) : (
            <>
              <p>
                {group.joinPolicy === "open"
                  ? "Entre e participe deste espaço de estudos."
                  : "Envie um pedido para os organizadores da comunidade."}
              </p>
              <Button
                disabled={busy}
                loading={busy}
                onClick={() => void join()}
                type="button"
              >
                {group.joinPolicy === "open"
                  ? "Entrar na comunidade"
                  : "Solicitar entrada"}
              </Button>
            </>
          )}

          <div className={styles.participationActions}>
            <Button
              disabled={busy}
              onClick={remote.reload}
              size="sm"
              type="button"
              variant="secondary"
            >
              Atualizar
            </Button>
            {participation.role === "owner" ? (
              <Button
                aria-expanded={editing}
                onClick={() => setEditing((current) => !current)}
                size="sm"
                type="button"
                variant="secondary"
              >
                Configurar
              </Button>
            ) : null}
          </div>
        </Card>
      </div>

      {isMember ? (
        <GroupSchedule
          key={groupId}
          groupId={groupId}
          canManage={participation.canManage}
        />
      ) : (
        <Card className={styles.lockedCard}>
          <LockKey aria-hidden size={28} />
          <div>
            <h2>Conteúdo da comunidade</h2>
            <p>Entre na comunidade para acessar encontros, cronograma e conteúdos compartilhados.</p>
          </div>
        </Card>
      )}

      {editing && participation.role === "owner" ? (
        <div id="configuracoes">
          <GroupForm
            group={group}
            onSaved={() => {
              setEditing(false);
              setFeedback("Configurações salvas.");
              invalidateGroups();
              remote.reload();
            }}
          />
        </div>
      ) : null}

      {isMember ? (
        <ChannelView
          key={`${groupId}/${channelRevision}`}
          groupId={groupId}
        />
      ) : null}

      {participation.canManage ? (
        <MemberManagement
          key={`member-management-${groupId}`}
          groupId={groupId}
          onChanged={(message, nextError) => {
            setFeedback(message);
            setError(nextError);
            remote.reload();
          }}
        />
      ) : null}

      {participation.canManage ? (
        <div id="gestao">
          <ChannelManager
            key={`channel-management-${groupId}`}
            groupId={groupId}
            onUpdated={() => setChannelRevision((revision) => revision + 1)}
          />
        </div>
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
  const remote = useRemote(path, fetcher, true);
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
      await apiClient.patch(
        `/v1/groups/${groupId}/members/${member.userId}`,
        { body: { action } },
      );
      resultMessage =
        action === "approve"
          ? "Solicitação aprovada."
          : action === "reject"
            ? "Solicitação recusada."
            : "Participante removido.";
      setMessage(resultMessage);
      setConfirmation(undefined);
    } catch (cause) {
      resultError = cause;
      setError(cause);
    } finally {
      invalidateGroups();
      lock.current = false;
      setBusy(false);
      remote.reload();
      onChanged(resultMessage, resultError);
    }
  }

  return (
    <Card className={styles.managementCard} id="membros">
      <div className={styles.managementHeading}>
        <div>
          <p className={styles.eyebrow}>Organização</p>
          <h2>Gerenciar participantes</h2>
        </div>
        <div className={styles.managementTabs}>
          <button
            aria-pressed={pending}
            className={pending ? styles.managementTabActive : ""}
            disabled={busy}
            onClick={() => {
              setPending(true);
              setOffset(0);
              setConfirmation(undefined);
            }}
            type="button"
          >
            Solicitações
          </button>
          <button
            aria-pressed={!pending}
            className={!pending ? styles.managementTabActive : ""}
            disabled={busy}
            onClick={() => {
              setPending(false);
              setOffset(0);
              setConfirmation(undefined);
            }}
            type="button"
          >
            Membros ativos
          </button>
        </div>
      </div>

      {message ? (
        <div className={styles.success} role="status">
          {message}
        </div>
      ) : null}
      {error ? <Failure error={error} /> : null}

      {remote.loading ? (
        <div className={styles.memberList} role="status" aria-label="Carregando participantes">
          <Skeleton variant="row" />
          <Skeleton variant="row" />
        </div>
      ) : remote.error ? (
        <Failure error={remote.error} retry={remote.reload} />
      ) : !remote.data?.length ? (
        <p className={styles.emptyText}>
          {pending
            ? "Nenhuma solicitação pendente. Os novos pedidos aparecerão aqui."
            : "Nenhum participante nesta página."}
        </p>
      ) : (
        <div className={styles.memberList}>
          {remote.data.slice(0, PAGE_SIZE).map((member) => (
            <div className={styles.memberRow} key={member.userId}>
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
              <div className={styles.memberActions}>
                {pending ? (
                  <>
                    <Button
                      disabled={busy}
                      onClick={() => void act(member, "approve")}
                      size="sm"
                      type="button"
                    >
                      Aprovar
                    </Button>
                    <Button
                      disabled={busy}
                      onClick={() => void act(member, "reject")}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      Recusar
                    </Button>
                  </>
                ) : member.role !== "owner" ? (
                  <Button
                    disabled={busy}
                    onClick={() => setConfirmation(member)}
                    size="sm"
                    type="button"
                    variant="danger"
                  >
                    Remover
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmation ? (
        <div className={styles.confirmation} role="alert">
          <p>
            Remover <strong>{confirmation.displayName}</strong> da comunidade?
            A pessoa perderá o acesso de participante.
          </p>
          <div>
            <Button
              disabled={busy}
              onClick={() => void act(confirmation, "remove")}
              size="sm"
              type="button"
              variant="danger"
            >
              Confirmar remoção
            </Button>
            <Button
              disabled={busy}
              onClick={() => setConfirmation(undefined)}
              size="sm"
              type="button"
              variant="secondary"
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      {offset > 0 || (remote.data?.length ?? 0) > PAGE_SIZE ? (
        <div className={styles.pagination}>
          <Button
            disabled={busy || remote.loading || !offset}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            size="sm"
            type="button"
            variant="secondary"
          >
            Anterior
          </Button>
          <Button
            disabled={
              busy ||
              remote.loading ||
              (remote.data?.length ?? 0) <= PAGE_SIZE
            }
            onClick={() => setOffset(offset + PAGE_SIZE)}
            size="sm"
            type="button"
            variant="secondary"
          >
            Próxima
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

function ChannelView({ groupId }: { groupId: string }) {
  const { channels, loading, error, reload } = useChannels(groupId);

  return (
    <Card className={styles.channelCard} id="canais">
      <div>
        <p className={styles.eyebrow}>Comunidade</p>
        <h2>Canais por assunto</h2>
        <p>Use os canais para organizar os temas e materiais da comunidade.</p>
      </div>

      {loading ? (
        <div className={styles.channelList} role="status" aria-label="Carregando canais">
          <Skeleton variant="row" />
          <Skeleton variant="row" />
        </div>
      ) : error ? (
        <Failure error={error} retry={reload} />
      ) : !channels?.length ? (
        <p className={styles.emptyText}>Nenhum canal criado nesta comunidade.</p>
      ) : (
        <div className={styles.channelList}>
          {channels.map((channel) => (
            <article className={styles.channelRow} key={channel.id}>
              <div className={styles.channelIcon}>
                <Hash aria-hidden size={18} />
              </div>
              <div>
                <div className={styles.channelHeading}>
                  <h3>{channel.name}</h3>
                  {channel.status === "archived" ? (
                    <Badge>Arquivado</Badge>
                  ) : null}
                </div>
                <p>{channel.topicName || "Sem assunto específico"}</p>
                {channel.description ? <small>{channel.description}</small> : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </Card>
  );
}
