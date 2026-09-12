"use client";

import { CheckCircle, Crown, LockKey, UsersThree } from "@phosphor-icons/react";
import Link from "next/link";
import { use, useState } from "react";

import { getGroupDetailPreview } from "@/mocks/community/group-detail";
import styles from "@/modules/community/components/CommunityPlanPage.module.css";

export default function CommunityPlanPage({ params }: PageProps<"/grupos/[groupId]/plano">) {
  const [feedback, setFeedback] = useState("");
  const { groupId } = use(params);
  const group = getGroupDetailPreview(groupId, false);
  const isOrganizer = group?.role === "Organizador";

  if (!group) return <main className={styles.page}><Link className={styles.back} href="/grupos">Voltar aos grupos</Link><section className={styles.panel}><h1>Comunidade não encontrada</h1><p>Esta prévia não possui dados para o grupo informado.</p></section></main>;

  return <main className={styles.page}>
    <nav aria-label="Caminho da página" className={styles.breadcrumbs}><Link href="/grupos">Grupos</Link><span>/</span><Link href={`/grupos/${group.id}`}>{group.name}</Link><span>/</span><strong>Plano e acesso</strong></nav>
    <header className={styles.header}><div><p className={styles.eyebrow}>Monetização simulada</p><h1>Plano premium e acesso</h1><p>Configure como a comunidade privada se mantém ativa e quais benefícios ficam disponíveis para os participantes.</p></div><aside className={styles.demo}><strong>Sem cobrança real</strong><br />Valores, ativação e solicitações são apenas estados demonstrativos.</aside></header>
    {feedback ? <p aria-live="polite" className={styles.feedback} role="status">{feedback}</p> : null}
    <div className={styles.grid}>
      <section className={styles.panel} aria-labelledby="tutor-plan"><h2 id="tutor-plan"><Crown aria-hidden size={22} /> Plano do tutor</h2><p>O tutor mantém a comunidade privada ativa para oferecer aulas, materiais e canais exclusivos.</p><div className={styles.status}><span /> Premium demonstrativo ativo</div><dl className={styles.details}><dt>Assinatura da comunidade</dt><dd>R$ 19,90/mês</dd><dt>Comunidade</dt><dd>{group.name}</dd><dt>Participantes</dt><dd>{group.memberCount} de {group.capacity}</dd></dl><ul className={styles.benefits}><li>Criar e administrar uma comunidade privada</li><li>Publicar materiais e organizar encontros exclusivos</li><li>Controlar solicitações e participantes</li></ul>{isOrganizer ? <button className={styles.button} onClick={() => setFeedback("Plano premium atualizado no protótipo. Nenhuma cobrança foi realizada.")} type="button">Simular atualização do plano</button> : null}</section>
      <section className={styles.panel} aria-labelledby="student-access"><h2 id="student-access"><UsersThree aria-hidden size={22} /> Acesso do estudante</h2><p>Participantes pagam uma taxa simulada para acessar conteúdos e canais exclusivos da comunidade.</p><div className={styles.status}><span /> Acesso controlado pela comunidade</div><dl className={styles.details}><dt>Taxa de acesso</dt><dd>R$ {group.studentAccessPrice}/mês</dd><dt>Pagamento</dt><dd>Não realizado</dd><dt>Conteúdos</dt><dd>Exclusivos</dd></dl><ul className={styles.benefits}><li>Acesso aos materiais vinculados ao grupo</li><li>Participação em aulas e encontros privados</li><li>Entrada nos canais exclusivos</li></ul>{group.isMember ? <button className={styles.secondary} onClick={() => setFeedback("Você já participa desta comunidade premium no protótipo.")} type="button">Acesso já ativo</button> : <button className={styles.button} onClick={() => setFeedback(`Solicitação simulada enviada por R$ ${group.studentAccessPrice}/mês. Nenhuma cobrança foi realizada.`)} type="button">Simular solicitação de acesso</button>}</section>
    </div>
    <section className={styles.panel}><h2><LockKey aria-hidden size={22} /> Benefícios da comunidade</h2><div className={styles.members}><div className={styles.metric}><strong>{group.channels.length}</strong><small>Canais de estudo</small></div><div className={styles.metric}><strong>4</strong><small>Conteúdos exclusivos</small></div><div className={styles.metric}><strong>{group.nextMeetingDetail ? "1" : "0"}</strong><small>Próximo encontro</small></div></div><Link className={styles.back} href={`/grupos/${group.id}/materiais`}><CheckCircle aria-hidden size={17} /> Ver conteúdos da comunidade</Link></section>
  </main>;
}