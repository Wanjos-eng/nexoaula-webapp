"use client";

import {
  ArrowLeft,
  CalendarBlank,
  Check,
  GearSix,
  Hash,
  ListBullets,
  MapPin,
  PaperPlaneRight,
  Plus,
  Tag,
  UserPlus,
  UsersThree,
  X,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { FormEvent, useState } from "react";

import styles from "./page.module.css";

const topics = ["geral", "filas-mm1", "modelo-analitico", "dúvidas"];

export default function ComunidadePage() {
  const [activeTopic, setActiveTopic] = useState("filas-mm1");
  const [message, setMessage] = useState("");
  const [interest, setInterest] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [activePanel, setActivePanel] = useState<"participants" | "manage" | null>(null);

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim()) {
      setFeedback("Escreva uma mensagem para iniciar a discussão.");
      return;
    }
    setFeedback("Mensagem adicionada ao protótipo.");
    setMessage("");
  }

  return (
    <div className={styles.page}>
      <Link className={styles.back} href="/grupos">
        <ArrowLeft aria-hidden size={17} /> Voltar aos grupos
      </Link>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Grupo de estudo</p>
          <h2>Comunidade MSD — C8</h2>
          <div className={styles.metadata}>
            <span><Tag aria-hidden size={15} /> Modelagem e Simulação Discreta</span>
            <span><Hash aria-hidden size={15} /> Turma C8</span>
            <span><CalendarBlank aria-hidden size={15} /> 2026.2</span>
            <span><UsersThree aria-hidden size={15} /> 12 de 20 membros</span>
          </div>
        </div>
        <div className={styles.heroActions}>
          <span className={styles.organizerBadge}>Organizador</span>
          <button className={styles.outlineButton} onClick={() => setActivePanel("manage")} type="button"><GearSix aria-hidden size={17} /> Gerenciar grupo</button>
        </div>
      </header>

      <div className={styles.layout}>
        <aside className={styles.channelSidebar} aria-label="Canais do grupo">
          <p className={styles.channelHeading}>Assuntos em discussão</p>
          <div className={styles.channelList}>
            {topics.map((topic) => (
              <button
                aria-current={activeTopic === topic ? "page" : undefined}
                className={activeTopic === topic ? styles.channelActive : styles.channel}
                key={topic}
                onClick={() => setActiveTopic(topic)}
                type="button"
              >
                <Hash aria-hidden size={17} /> {topic}
              </button>
            ))}
          </div>
          <button className={styles.createTopic} type="button"><Plus aria-hidden size={16} /> Criar assunto</button>
          <div className={styles.channelDivider} />
          <button className={styles.utilityChannel} type="button"><CalendarBlank aria-hidden size={18} /> Encontros</button>
          <button className={styles.utilityChannel} onClick={() => setActivePanel("participants")} type="button"><UsersThree aria-hidden size={18} /> Participantes</button>
          <button className={styles.utilityChannel} type="button"><UserPlus aria-hidden size={18} /> Solicitações de entrada <span>2</span></button>
          <button className={styles.utilityChannel} type="button"><ListBullets aria-hidden size={18} /> Plano e cronograma</button>
        </aside>

        <section className={styles.chatPanel} aria-labelledby="thread-title">
          <header className={styles.chatHeader}>
            <div><p className={styles.threadLabel}><Hash aria-hidden size={16} /> {activeTopic}</p><h3 id="thread-title">Dúvidas, materiais e discussões sobre os modelos de fila M/M/1.</h3></div>
            <span className={styles.threadDate}>Atualizado hoje</span>
          </header>
          <div className={styles.chatBody}>
            <p className={styles.chatIntro}>Este é o início do assunto <strong>#{activeTopic}</strong>.</p>
            <article className={styles.post}><div className={styles.avatar}>LA</div><div><p><strong>Lucas Andrade</strong><span>Hoje às 14:32</span></p><p>Pessoal, estou revisando a fórmula de Little para M/M/1. Alguém tem um exemplo prático resolvido daquele exercício 4?</p></div></article>
            <article className={styles.post}><div className={`${styles.avatar} ${styles.avatarGreen}`}>AS</div><div><p><strong>Ana Souza</strong><span>Hoje às 14:45</span></p><p>O truque é lembrar que a taxa de serviço (μ) precisa estar na mesma unidade de tempo da taxa de chegada (λ). Converti tudo para segundos e funcionou.</p></div></article>
            <article className={styles.post}><div className={`${styles.avatar} ${styles.avatarMuted}`}>RL</div><div><p><strong>Rafael Lima</strong><span>Hoje às 15:10</span></p><p><b>@Ana Souza</b> salvou! Eu estava travado exatamente nessa conversão. A monitoria de amanhã ainda está de pé?</p></div></article>
          </div>
          <form className={styles.composer} onSubmit={sendMessage}>
            <label className="sr-only" htmlFor="new-message">Escreva uma mensagem</label>
            <input id="new-message" onChange={(event) => setMessage(event.target.value)} placeholder={`Escreva em #${activeTopic}...`} value={message} />
            <button aria-label="Enviar mensagem" type="submit"><PaperPlaneRight aria-hidden size={19} /></button>
          </form>
          {feedback ? <p aria-live="polite" className={styles.feedback}>{feedback}</p> : null}
        </section>

        <aside className={styles.infoSidebar} aria-label="Informações do grupo">
          <section className={styles.sideCard} id="encontro">
            <div className={styles.sideHeading}><h3>Próximo encontro</h3><span>Online</span></div>
            <h4>Revisão de Filas M/M/1</h4>
            <p><CalendarBlank aria-hidden size={16} /> 31/08/2026, 19h–20h</p>
            <p><MapPin aria-hidden size={16} /> Sala virtual da comunidade</p>
            <button className={interest ? styles.interestActive : styles.interest} onClick={() => setInterest((current) => !current)} type="button">{interest ? <><Check aria-hidden size={17} /> Interesse confirmado</> : "Tenho interesse"}</button>
            <Link className={styles.details} href="#encontro">Ver detalhes do encontro</Link>
          </section>
          <section className={styles.sideCard} id="plano">
            <h3>Plano e cronograma</h3>
            <div className={styles.planStatus}><Check aria-hidden size={17} weight="bold" /><div><strong>Plano publicado</strong><span>Enviado pelo organizador em 16/08/2026</span></div></div>
            <div className={styles.sideLinks}><Link href="#plano">Ver cronograma</Link><Link href="#gerenciar">Gerenciar plano</Link></div>
          </section>
          <section className={styles.sideCard} id="participantes">
            <div className={styles.sideHeading}><h3>Participantes</h3><span>12 de 20</span></div>
            <div className={styles.memberFaces}><span>LA</span><span>AS</span><span>RL</span><span>+9</span></div>
            <button className={styles.detailsButton} onClick={() => setActivePanel("participants")} type="button">Ver participantes <ArrowLeft aria-hidden className={styles.rotate} size={15} /></button>
          </section>
        </aside>
      </div>
      {activePanel ? (
        <div className={styles.modalBackdrop} onClick={() => setActivePanel(null)} role="presentation">
          <section aria-labelledby="group-panel-title" aria-modal="true" className={styles.modal} onClick={(event) => event.stopPropagation()} role="dialog">
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.eyebrow}>{activePanel === "manage" ? "Visão do organizador" : "Comunidade MSD — C8"}</p>
                <h3 id="group-panel-title">{activePanel === "manage" ? "Gerenciar grupo" : "Participantes"}</h3>
              </div>
              <button aria-label="Fechar painel" className={styles.modalClose} onClick={() => setActivePanel(null)} type="button"><X aria-hidden size={18} /></button>
            </div>
            {activePanel === "participants" ? (
              <div className={styles.participantList}>
                <p className={styles.modalIntro}>Veja quem está na comunidade e identifique os papéis de apoio.</p>
                {[{ initials: "LA", name: "Lucas Andrade", role: "Organizador" }, { initials: "AS", name: "Ana Souza", role: "Tutora voluntária" }, { initials: "RL", name: "Rafael Lima", role: "Participante" }, { initials: "MC", name: "Marina Costa", role: "Participante" }].map((person) => (
                  <div className={styles.participantRow} key={person.name}><span className={styles.avatar}>{person.initials}</span><span><strong>{person.name}</strong><small>{person.role}</small></span><button aria-label={`Abrir conversa com ${person.name}`} type="button">Mensagem</button></div>
                ))}
                <p className={styles.modalHint}>Tutoria pode ser ativada pelo organizador quando a comunidade precisar de apoio em uma disciplina.</p>
              </div>
            ) : (
              <div className={styles.manageList}>
                <p className={styles.modalIntro}>Ações disponíveis somente para o organizador, sem misturar configurações com a experiência de quem participa.</p>
                <button type="button"><GearSix aria-hidden size={18} /><span><strong>Configurações do grupo</strong><small>Nome, descrição e regras de convivência</small></span><ArrowLeft aria-hidden className={styles.rotate} size={16} /></button>
                <button type="button"><UserPlus aria-hidden size={18} /><span><strong>Solicitações de entrada</strong><small>2 pessoas aguardando aprovação</small></span><ArrowLeft aria-hidden className={styles.rotate} size={16} /></button>
                <button type="button"><ListBullets aria-hidden size={18} /><span><strong>Plano e cronograma</strong><small>Publique a próxima etapa do grupo</small></span><ArrowLeft aria-hidden className={styles.rotate} size={16} /></button>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
