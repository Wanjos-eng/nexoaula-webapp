"use client";

import {
  CheckCircle,
  Clock,
  EnvelopeOpen,
  WarningCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  acceptGroupInvitation,
  errorMessage,
  getGroupInvitation,
  type GroupInvitation,
} from "./api";
import { useRemote } from "./useRemote";
import styles from "./AccessLifecycle.module.css";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));
}

export function InviteAcceptance({ token }: { token: string }) {
  const fetcher = useCallback(
    (signal: AbortSignal) => getGroupInvitation(token, signal),
    [token],
  );
  const remote = useRemote(`invite/${token}`, fetcher, true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [accepted, setAccepted] = useState(false);

  async function accept() {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await acceptGroupInvitation(token);
      setAccepted(true);
      remote.reload();
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  }

  if (remote.loading) {
    return (
      <div className={styles.invitePage}>
        <Card className={styles.acceptCard}>
          <Skeleton variant="card" />
        </Card>
      </div>
    );
  }

  if (remote.error || !remote.data) {
    return (
      <div className={styles.invitePage}>
        <Card className={styles.acceptCard}>
          <span className={styles.acceptIconDanger}>
            <WarningCircle aria-hidden size={28} />
          </span>
          <p className={styles.eyebrow}>Convite de comunidade</p>
          <h1>Este convite não está disponível</h1>
          <p className={styles.acceptDescription}>
            {errorMessage(remote.error)}
          </p>
          <Link className={styles.inlineLink} href="/grupos">
            Ir para Comunidades
          </Link>
        </Card>
      </div>
    );
  }

  const invitation: GroupInvitation = remote.data;
  const success = accepted || invitation.status === "accepted";
  const unavailable =
    invitation.status === "cancelled" || invitation.status === "expired";

  return (
    <div className={styles.invitePage}>
      <Card className={styles.acceptCard}>
        <span className={success ? styles.acceptIconSuccess : styles.acceptIcon}>
          {success ? (
            <CheckCircle aria-hidden size={30} weight="fill" />
          ) : (
            <EnvelopeOpen aria-hidden size={30} />
          )}
        </span>
        <p className={styles.eyebrow}>Convite de comunidade</p>
        <h1>
          {success
            ? "Você entrou na comunidade"
            : unavailable
              ? "Convite indisponível"
              : `Entrar em ${invitation.groupName}`}
        </h1>
        <p className={styles.acceptDescription}>
          {success
            ? "Seu acesso foi liberado. Planejamento, encontros e canais já estão disponíveis."
            : unavailable
              ? invitation.status === "expired"
                ? "Este convite expirou. Peça um novo link ao organizador."
                : "Este convite foi cancelado pelo organizador."
              : `${invitation.invitedDisplayName}, este convite foi criado para sua conta NexoAula.`}
        </p>

        {!success && !unavailable ? (
          <div className={styles.inviteDeadline}>
            <Clock aria-hidden size={16} />
            Válido até {formatDate(invitation.expiresAt)}
          </div>
        ) : null}

        {error ? <div className={styles.errorText} role="alert">{errorMessage(error)}</div> : null}

        <div className={styles.acceptActions}>
          {success ? (
            <Link className={styles.primaryLink} href={`/grupos/${invitation.groupId}`}>
              Abrir comunidade
            </Link>
          ) : unavailable ? (
            <Link className={styles.secondaryLink} href="/grupos">
              Voltar para Comunidades
            </Link>
          ) : (
            <>
              <Button loading={busy} onClick={() => void accept()} type="button">
                Aceitar convite
              </Button>
              <Link className={styles.secondaryLink} href="/grupos">
                Agora não
              </Link>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
