"use client";

import {
  CheckCircle,
  Copy,
  EnvelopeSimple,
  Hourglass,
  LinkSimple,
  XCircle,
} from "@phosphor-icons/react";
import { useCallback, useMemo, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  cancelGroupInvitation,
  createGroupInvitation,
  errorMessage,
  listGroupInvitations,
  type GroupInvitation,
} from "./api";
import { Failure } from "./AsyncState";
import { useRemote } from "./useRemote";
import styles from "./AccessLifecycle.module.css";

function statusLabel(status: GroupInvitation["status"]) {
  if (status === "accepted") return "Aceito";
  if (status === "cancelled") return "Cancelado";
  if (status === "expired") return "Expirado";
  return "Pendente";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function InvitationManager({ groupId }: { groupId: string }) {
  const path = `groups/${groupId}/invitations`;
  const fetcher = useCallback(
    (signal: AbortSignal) => listGroupInvitations(groupId, signal),
    [groupId],
  );
  const remote = useRemote(path, fetcher, true);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [feedback, setFeedback] = useState("");
  const [createdLink, setCreatedLink] = useState("");
  const [createdInviteId, setCreatedInviteId] = useState<string>();

  const pendingCount = useMemo(
    () => remote.data?.filter((invite) => invite.status === "pending").length ?? 0,
    [remote.data],
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    setError(undefined);
    setFeedback("");
    try {
      const invitation = await createGroupInvitation(groupId, email);
      const link = `${window.location.origin}/convites/${invitation.token}`;
      setCreatedLink(link);
      setCreatedInviteId(invitation.id);
      setEmail("");
      setFeedback("Convite criado. Copie o link e envie para a pessoa convidada.");
      remote.reload();
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!createdLink) return;
    try {
      await navigator.clipboard.writeText(createdLink);
      setFeedback("Link do convite copiado.");
    } catch {
      setFeedback("Não foi possível copiar automaticamente. Selecione o link abaixo.");
    }
  }

  async function cancel(invitation: GroupInvitation) {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    setFeedback("");
    try {
      await cancelGroupInvitation(groupId, invitation.id);
      if (createdInviteId === invitation.id) {
        setCreatedInviteId(undefined);
        setCreatedLink("");
      }
      setFeedback("Convite cancelado.");
      remote.reload();
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={styles.invitationCard} id="convites">
      <div className={styles.cardHeader}>
        <div className={styles.headerIcon}>
          <EnvelopeSimple aria-hidden size={22} />
        </div>
        <div>
          <p className={styles.eyebrow}>Acesso à comunidade</p>
          <h2>Convites</h2>
          <p>
            Convide uma conta NexoAula por e-mail. O link é pessoal, expira em
            sete dias e só pode ser usado uma vez.
          </p>
        </div>
        <span className={styles.counter}>{pendingCount} pendente{pendingCount === 1 ? "" : "s"}</span>
      </div>

      <form className={styles.inviteForm} onSubmit={(event) => void submit(event)}>
        <label>
          <span>E-mail da pessoa</span>
          <input
            autoComplete="email"
            disabled={busy}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="aluno@exemplo.com"
            type="email"
            value={email}
          />
        </label>
        <Button disabled={!email.trim()} loading={busy} type="submit">
          Gerar convite
        </Button>
      </form>

      {createdLink ? (
        <div className={styles.generatedLink}>
          <div>
            <LinkSimple aria-hidden size={18} />
            <div>
              <strong>Link pronto para compartilhar</strong>
              <span>Ele só é exibido nesta sessão por segurança.</span>
            </div>
          </div>
          <div className={styles.linkRow}>
            <input
              aria-label="Link do convite"
              onFocus={(event) => event.currentTarget.select()}
              readOnly
              value={createdLink}
            />
            <Button onClick={() => void copyLink()} size="sm" type="button" variant="secondary">
              <Copy aria-hidden size={16} />
              Copiar
            </Button>
          </div>
        </div>
      ) : null}

      {feedback ? <div className={styles.success} role="status">{feedback}</div> : null}
      {error ? <Failure error={error} /> : null}

      <div className={styles.inviteList}>
        <div className={styles.listHeading}>
          <strong>Histórico de convites</strong>
          <span>Os mais recentes aparecem primeiro.</span>
        </div>
        {remote.loading ? (
          <>
            <Skeleton variant="row" />
            <Skeleton variant="row" />
          </>
        ) : remote.error ? (
          <Failure error={remote.error} retry={remote.reload} />
        ) : !remote.data?.length ? (
          <div className={styles.emptyState}>
            <EnvelopeSimple aria-hidden size={22} />
            <p>Nenhum convite criado ainda.</p>
          </div>
        ) : (
          remote.data.map((invitation) => (
            <article className={styles.inviteRow} key={invitation.id}>
              <div className={styles.inviteIdentity}>
                <span className={styles.avatar}>
                  {invitation.invitedDisplayName.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <strong>{invitation.invitedDisplayName}</strong>
                  <span>{invitation.invitedEmail}</span>
                </div>
              </div>
              <div className={styles.inviteMeta}>
                <span className={`${styles.status} ${styles[invitation.status]}`}>
                  {invitation.status === "accepted" ? (
                    <CheckCircle aria-hidden size={14} weight="fill" />
                  ) : invitation.status === "pending" ? (
                    <Hourglass aria-hidden size={14} />
                  ) : (
                    <XCircle aria-hidden size={14} />
                  )}
                  {statusLabel(invitation.status)}
                </span>
                <small>
                  {invitation.status === "pending"
                    ? `Expira em ${formatDate(invitation.expiresAt)}`
                    : `Criado em ${formatDate(invitation.createdAt)}`}
                </small>
              </div>
              {invitation.status === "pending" ? (
                <Button
                  disabled={busy}
                  onClick={() => void cancel(invitation)}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Cancelar
                </Button>
              ) : null}
            </article>
          ))
        )}
      </div>
    </Card>
  );
}
