"use client";

import {
  ArrowLeft,
  CalendarBlank,
  Check,
  GearSix,
  Hash,
  ListBullets,
  PaperPlaneRight,
  UserPlus,
  X,
} from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import type { GroupDetailData, GroupMessage } from "@/modules/community/types";

import { ChannelList } from "./ChannelList";
import styles from "./GroupDetailView.module.css";
import { GroupOverview } from "./GroupOverview";
import { MeetingList } from "./MeetingList";

type GroupDetailViewProps = {
  group: GroupDetailData | null;
  initialTopicId?: string;
  state?: "ready" | "loading" | "error";
};

export function GroupDetailView({
  group,
  initialTopicId,
  state = "ready",
}: GroupDetailViewProps) {
  const [activeTopic, setActiveTopic] = useState<string>(() => {
    if (!group || group.channels.length === 0) return "geral";
    if (initialTopicId && group.channels.some((c) => c.id === initialTopicId)) {
      return initialTopicId;
    }
    return group.channels[0].id;
  });

  const [messageText, setMessageText] = useState("");
  const [composerFeedback, setComposerFeedback] = useState("");
  const [joinFeedback, setJoinFeedback] = useState("");
  const [localMessages, setLocalMessages] = useState<Record<string, GroupMessage[]>>(
    group?.messagesByChannel || {},
  );

  const [activePanel, setActivePanel] = useState<
    "participants" | "manage" | "meetings" | "plan" | null
  >(null);

  const modalRef = useRef<HTMLElement>(null);

  // Keep keyboard navigation inside the modal and restore the trigger.
  useEffect(() => {
    if (!activePanel) return;
    const trigger = document.activeElement as HTMLElement | null;
    const modal = modalRef.current;
    const focusable = () => Array.from(modal?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]',
    ) ?? []);
    focusable()[0]?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setActivePanel(null);
      if (event.key === "Tab") {
        const items = focusable();
        const first = items[0];
        const last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first?.focus();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      trigger?.focus();
    };
  }, [activePanel]);

  if (state !== "ready") return <div className={styles.page}>
    <p>Prévia demonstrativa, sem persistência.</p>
    <p role={state === "error" ? "alert" : "status"}>
      {state === "loading" ? "Carregando grupo…" : "Não foi possível carregar o grupo nesta simulação."}
    </p>
    <Link href={group ? `/grupos/${group.id}` : "/grupos"}>Voltar à prévia</Link>
  </div>;

  if (!group) {
    return (
      <div className={styles.page}>
        <Link className={styles.back} href="/grupos">
          <ArrowLeft aria-hidden size={17} /> Voltar aos grupos
        </Link>
        <div className={styles.notFoundContainer} role="alert">
          <h2>Grupo de estudo não encontrado</h2>
          <p>
            O grupo solicitado não existe, foi removido ou você não possui permissão para visualizar os detalhes.
          </p>
          <Link className={styles.primaryButton} href="/grupos">
            Explorar comunidades disponíveis
          </Link>
        </div>
      </div>
    );
  }

  const activeChannel = group.channels.find((c) => c.id === activeTopic);
  const messagesForChannel = group.isMember ? localMessages[activeTopic] || [] : [];

  function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!group?.isMember || !group.channels.length) return;
    if (!messageText.trim()) {
      setComposerFeedback("Escreva uma mensagem para iniciar a discussão.");
      return;
    }
    const newMessage: GroupMessage = {
      id: `msg-${Date.now()}`,
      authorName: "Você (Usuário)",
      authorInitials: "VC",
      timestamp: "Agora",
      content: messageText.trim(),
      isOwn: true,
      avatarColor: "muted",
    };
    setLocalMessages((prev) => ({
      ...prev,
      [activeTopic]: [...(prev[activeTopic] || []), newMessage],
    }));
    setComposerFeedback("Mensagem adicionada ao protótipo (sem persistência no servidor).");
    setMessageText("");
  }

  function handleJoinClick() {
    if (!group) return;
    setJoinFeedback(
      group.isMember
        ? "Você já participa desta comunidade."
        : group.isPremiumCommunity
        ? `Solicitação de acesso premium enviada no protótipo (R$ ${group.studentAccessPrice}/mês, sem cobrança real).`
        : group.entryMode === "approval"
        ? "Solicitação enviada no protótipo (aguarda aprovação do organizador)."
        : "Entrada simulada com sucesso no protótipo.",
    );
  }

  return (
    <div className={styles.page}>
      <p className={styles.feedback}>Prévia demonstrativa: mensagens, encontros e ações não são persistidos.</p>
      {/* Mobile Header */}
      <header className={styles.mobileHeader}>
        <Link aria-label="Voltar aos grupos" className={styles.mobileBack} href="/grupos">
          <ArrowLeft aria-hidden size={21} />
        </Link>
        <div className={styles.mobileIdentity}>
          <span className={styles.mobileGroupIcon}>
            <Image
              alt=""
              height={23}
              src="/brand/nexoaula-symbol-color.png"
              width={23}
            />
          </span>
          <div>
            <strong>{group.name}</strong>
            <span>
              <Hash aria-hidden size={13} /> #{activeTopic}
            </span>
          </div>
        </div>
        {group.isMember && group.role === "Organizador" ? <button
          aria-label="Gerenciar grupo"
          className={styles.mobileManage}
          onClick={() => setActivePanel("manage")}
          type="button"
        >
          <GearSix aria-hidden size={20} />
        </button> : null}
      </header>

      <div className={styles.mobileContext}>
        <p>{group.discipline} · {group.classGroup} · {group.period}</p>
        {!group.isMember ? <button type="button" className={styles.primaryButton} onClick={handleJoinClick}>
          {group.entryMode === "approval" ? "Solicitar entrada" : "Entrar no grupo"}
        </button> : null}
        {joinFeedback ? <p role="status">{joinFeedback}</p> : null}
      </div>
      {/* Desktop Header & Hero */}
      <Link className={styles.back} href="/grupos">
        <ArrowLeft aria-hidden size={17} /> Voltar aos grupos
      </Link>

      <GroupOverview
        group={group}
        joinFeedback={joinFeedback}
        onJoinClick={handleJoinClick}
        onOpenManage={() => setActivePanel("manage")}
      />

      {/* Grid Layout */}
      <div className={styles.layout}>
        {/* Left Column: Channels */}
        <ChannelList
          activeChannelId={activeTopic}
          channels={group.channels}
          onCreateTopicClick={() => {
            setComposerFeedback("Criação de novos tópicos simulada no protótipo.");
          }}
          onOpenPanel={(panel) => setActivePanel(panel)}
          onSelectChannel={(topicId) => {
            setActiveTopic(topicId);
            setComposerFeedback("");
          }}
          canInteract={group.isMember}
          pendingRequestsCount={group.role === "Organizador" ? group.pendingRequestsCount : 0}
        />

        {/* Center Column: Thread / Chat Panel */}
        <section
          aria-labelledby="thread-title"
          className={styles.chatPanel}
        >
          <header className={styles.chatHeader}>
            <div>
              <p className={styles.threadLabel}>
                <Hash aria-hidden size={16} /> #{activeTopic}
              </p>
              <h3 id="thread-title">
                {activeChannel?.description || `Discussões e conteúdos do assunto #${activeTopic}.`}
              </h3>
            </div>
            <span className={styles.threadDate}>Atualizado hoje</span>
          </header>

          {!group.isMember ? (
            <div className={styles.restrictedNotice} role="alert">
              Você está em modo de pré-visualização. Entre no grupo para interagir e enviar mensagens.
            </div>
          ) : null}

          <div className={styles.chatBody}>
            <p className={styles.chatIntro}>
              Este é o início do assunto <strong>#{activeTopic}</strong>.
            </p>

            {messagesForChannel.length === 0 ? (
              <div className={styles.emptyState}>
                Nenhuma mensagem enviada neste assunto ainda. Seja o primeiro a participar!
              </div>
            ) : (
              messagesForChannel.map((msg) => {
                const avatarStyle =
                  msg.avatarColor === "green"
                    ? `${styles.avatar} ${styles.avatarGreen}`
                    : msg.avatarColor === "muted"
                    ? `${styles.avatar} ${styles.avatarMuted}`
                    : styles.avatar;

                return (
                  <article
                    className={msg.isOwn ? `${styles.post} ${styles.postOwn}` : styles.post}
                    key={msg.id}
                  >
                    <div className={avatarStyle}>{msg.authorInitials}</div>
                    <div>
                      <p>
                        <strong>{msg.authorName}</strong>
                        <span>{msg.timestamp}</span>
                      </p>
                      <p>{msg.content}</p>
                    </div>
                  </article>
                );
              })
            )}
          </div>

          {/* Form Composer */}
          <form className={styles.composer} onSubmit={handleSendMessage}>
            <label className="sr-only" htmlFor="new-message">
              Escreva uma mensagem
            </label>
            <input
              disabled={!group.isMember || group.channels.length === 0}
              id="new-message"
              onChange={(e) => setMessageText(e.target.value)}
              placeholder={`Escreva em #${activeTopic}...`}
              value={messageText}
            />
            <button aria-label="Enviar mensagem" disabled={!group.isMember || group.channels.length === 0} type="submit">
              <PaperPlaneRight aria-hidden size={19} />
            </button>
          </form>
          {composerFeedback ? (
            <p aria-live="polite" className={styles.feedback}>
              {composerFeedback}
            </p>
          ) : null}
        </section>

        {/* Right Column: Info Sidebar */}
        <aside className={styles.infoSidebar} aria-label="Informações do grupo">
          <MeetingList
            canInteract={group.isMember}
            meeting={group.nextMeetingDetail}
            onViewMeetings={() => setActivePanel("meetings")}
          />

          <section className={styles.sideCard} id="plano">
            <h3>Plano e cronograma</h3>
            {!group.isMember ? <p>Entre no grupo para acessar o plano e cronograma.</p> : group.hasPublishedPlan ? (
              <div className={styles.planStatus}>
                <Check aria-hidden size={17} weight="bold" />
                <div>
                  <strong>Plano publicado</strong>
                  <span>
                    {group.planPublishedDate
                      ? `Enviado pelo organizador em ${group.planPublishedDate}`
                      : "Plano de estudo ativo"}
                  </span>
                </div>
              </div>
            ) : (
              <p className={styles.emptyText}>Plano de ensino ainda não cadastrado.</p>
            )}
            <div className={styles.sideLinks}>
              <button
                className={styles.details}
                disabled={!group.isMember}
                onClick={() => setActivePanel("plan")}
                type="button"
              >
                Ver cronograma
              </button>
            </div>
          </section>

          <section className={styles.sideCard} id="participantes">
            <div className={styles.sideHeading}>
              <h3>Participantes</h3>
              <span>
                {group.memberCount} de {group.capacity}
              </span>
            </div>
            <div className={styles.memberFaces}>
              {group.participants.slice(0, 3).map((p) => (
                <span key={p.id}>{p.initials}</span>
              ))}
              {group.participants.length > 3 ? (
                <span>+{group.participants.length - 3}</span>
              ) : null}
            </div>
            <button
              className={styles.detailsButton}
              onClick={() => setActivePanel("participants")}
              type="button"
            >
              Ver participantes{" "}
              <ArrowLeft aria-hidden className={styles.rotate} size={15} />
            </button>
          </section>
        </aside>
      </div>

      {/* Modals */}
      {activePanel ? (
        <div
          className={styles.modalBackdrop}
          onClick={() => setActivePanel(null)}
          role="presentation"
        >
          <section
            aria-labelledby="group-panel-title"
            aria-modal="true"
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            ref={modalRef}
          >
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.eyebrow}>
                  {activePanel === "manage" ? "Visão do organizador" : group.name}
                </p>
                <h3 id="group-panel-title">
                  {activePanel === "manage"
                    ? "Gerenciar grupo"
                    : activePanel === "participants"
                    ? "Participantes"
                    : activePanel === "meetings"
                    ? "Encontros agendados"
                    : "Plano e cronograma"}
                </h3>
              </div>
              <button
                aria-label="Fechar painel"
                className={styles.modalClose}
                onClick={() => setActivePanel(null)}
                type="button"
              >
                <X aria-hidden size={18} />
              </button>
            </div>

            {activePanel === "participants" ? (
              <div className={styles.participantList}>
                <p className={styles.modalIntro}>
                  Veja quem está na comunidade e identifique os papéis de apoio.
                </p>
                {group.participants.map((person) => (
                  <div className={styles.participantRow} key={person.id}>
                    <span className={styles.avatar}>{person.initials}</span>
                    <span>
                      <strong>{person.name}</strong>
                      <small>{person.role}</small>
                    </span>
                    <button
                      disabled
                      aria-label={`Conversa com ${person.name} indisponível nesta prévia`}
                      type="button"
                    >
                      Mensagem
                    </button>
                  </div>
                ))}
                <p className={styles.modalHint}>
                  Tutoria pode ser ativada pelo organizador quando a comunidade precisar de apoio em uma disciplina.
                </p>
              </div>
            ) : activePanel === "manage" ? (
              <div className={styles.manageList}>
                <p className={styles.modalIntro}>
                  Ações disponíveis somente para o organizador, sem misturar configurações com a experiência de quem participa.
                </p>
                <button type="button" disabled>
                  <GearSix aria-hidden size={18} />
                  <span>
                    <strong>Configurações do grupo</strong>
                    <small>Nome, descrição e regras de convivência</small>
                  </span>
                  <ArrowLeft aria-hidden className={styles.rotate} size={16} />
                </button>
                <button type="button" disabled>
                  <UserPlus aria-hidden size={18} />
                  <span>
                    <strong>Solicitações de entrada</strong>
                    <small>
                      {group.pendingRequestsCount || 0} pessoas aguardando aprovação
                    </small>
                  </span>
                  <ArrowLeft aria-hidden className={styles.rotate} size={16} />
                </button>
                <button type="button" disabled>
                  <ListBullets aria-hidden size={18} />
                  <span>
                    <strong>Plano e cronograma</strong>
                    <small>Publique a próxima etapa do grupo</small>
                  </span>
                  <ArrowLeft aria-hidden className={styles.rotate} size={16} />
                </button>
              </div>
            ) : activePanel === "meetings" ? (
              <div className={styles.participantList}>
                <p className={styles.modalIntro}>
                  Encontros virtuais e presenciais do grupo de estudos.
                </p>
                {group.nextMeetingDetail ? (
                  <div className={styles.sideCard}>
                    <h4>{group.nextMeetingDetail.title}</h4>
                    <p>
                      <CalendarBlank aria-hidden size={16} /> {group.nextMeetingDetail.date}, {group.nextMeetingDetail.time}
                    </p>
                    <p>{group.nextMeetingDetail.description}</p>
                  </div>
                ) : (
                  <p className={styles.emptyText}>Sem encontros agendados.</p>
                )}
              </div>
            ) : (
              <div className={styles.participantList}>
                <p className={styles.modalIntro}>
                  Plano e cronograma pedagógico do grupo de estudos.
                </p>
                <p className={styles.emptyText}>
                  {group.hasPublishedPlan
                    ? `Plano ativo publicado em ${group.planPublishedDate || "data recente"}.`
                    : "Plano de estudos pendente de publicação pelo organizador."}
                </p>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
