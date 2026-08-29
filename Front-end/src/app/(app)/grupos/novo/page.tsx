"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle,
  CalendarBlank,
  ChatCircleDots,
  Info,
  LockKey,
  PencilSimple,
  RocketLaunch,
  UserPlus,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { useState } from "react";

import styles from "./page.module.css";

type GroupForm = {
  name: string;
  discipline: string;
  className: string;
  term: string;
  description: string;
  access: "public" | "private";
  limit: string;
  suggestions: boolean;
  rules: string;
};

const initialForm: GroupForm = {
  name: "Comunidade MSD — C8",
  discipline: "Modelagem e Simulação Discreta",
  className: "C8",
  term: "2026.2",
  description:
    "Grupo de estudo da turma C8 para discussão dos conteúdos, organização de encontros e acompanhamento do cronograma.",
  access: "public",
  limit: "20",
  suggestions: true,
  rules: "Mantenha as discussões relacionadas à disciplina e respeite os demais participantes.",
};

export default function NovoGrupoPage() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm);

  function update<K extends keyof GroupForm>(key: K, value: GroupForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumbs}>
        <Link href="/inicio">Início</Link><span>/</span><Link href="/grupos">Grupos</Link><span>/</span><strong>Criar grupo</strong>
      </div>
      <div className={styles.heading}>
        <div><p className={styles.eyebrow}>Grupos de estudo</p><h2>{step === 4 ? "Grupo criado com sucesso" : step === 3 ? "Revisar e criar grupo" : step === 2 ? "Definir acesso ao grupo" : "Criar grupo de estudo"}</h2><p>{step === 4 ? `A ${form.name} está pronta para receber participantes e organizar os estudos.` : "Uma comunidade acadêmica para aprender em conjunto, com regras claras e participação segura."}</p></div>
        {step < 4 ? <span className={styles.mockBadge}>Dados simulados</span> : null}
      </div>

      {step < 4 ? <div className={styles.stepper} aria-label={`Etapa ${step} de 3`}><Step active={step >= 1} current={step === 1} number="1" label="Informações" /><Step active={step >= 2} current={step === 2} number="2" label="Acesso" /><Step active={step >= 3} current={step === 3} number="3" label="Revisão" /></div> : null}

      {step === 1 ? <section className={styles.card} aria-labelledby="info-title"><div className={styles.cardHeader}><div><h3 id="info-title">Informações básicas</h3><p>Informe os dados da disciplina e da turma para começar.</p></div><Info aria-hidden size={22} /></div><div className={styles.formGrid}><label>Nome do grupo *<input value={form.name} onChange={(e) => update("name", e.target.value)} /></label><label>Disciplina *<select value={form.discipline} onChange={(e) => update("discipline", e.target.value)}><option>Modelagem e Simulação Discreta</option><option>Engenharia de Software</option><option>Estruturas de Dados</option></select></label><label>Turma *<input value={form.className} onChange={(e) => update("className", e.target.value)} /></label><label>Período letivo *<select value={form.term} onChange={(e) => update("term", e.target.value)}><option>2026.2</option><option>2027.1</option></select></label><label className={styles.full}>Descrição (opcional)<textarea maxLength={240} value={form.description} onChange={(e) => update("description", e.target.value)} /><small>{form.description.length}/240</small></label></div><div className={styles.actions}><Link className={styles.secondary} href="/grupos">Cancelar</Link><button className={styles.primary} onClick={() => setStep(2)} type="button">Continuar <ArrowRight aria-hidden size={18} /></button></div></section> : null}

      {step === 2 ? <section className={styles.card} aria-labelledby="access-title"><div className={styles.cardHeader}><div><h3 id="access-title">Acesso e participação</h3><p>Escolha como os estudantes poderão encontrar e participar do grupo.</p></div><LockKey aria-hidden size={22} /></div><fieldset className={styles.accessOptions}><legend className="sr-only">Tipo de acesso</legend><label className={form.access === "public" ? styles.optionSelected : styles.option}><input checked={form.access === "public"} name="access" onChange={() => update("access", "public")} type="radio" /><span><strong>Público — entrada livre</strong><small>O grupo aparece em “Descobrir grupos” e estudantes podem entrar enquanto houver vagas.</small></span></label><label className={form.access === "private" ? styles.optionSelected : styles.option}><input checked={form.access === "private"} name="access" onChange={() => update("access", "private")} type="radio" /><span><strong>Privado — entrada mediante aprovação</strong><small>O grupo aparece com informações básicas, mas cada solicitação precisa ser aprovada pelo organizador.</small></span></label></fieldset><div className={styles.formGrid}><label>Limite de participantes<input inputMode="numeric" value={form.limit} onChange={(e) => update("limit", e.target.value)} /><small>O limite inclui você, que será o organizador.</small></label><label className={styles.checkField}><input checked={form.suggestions} onChange={(e) => update("suggestions", e.target.checked)} type="checkbox" /><span><strong>Permitir que membros sugiram novos assuntos</strong><small>As sugestões precisarão da aprovação do organizador antes de aparecer no grupo.</small></span></label><label className={styles.full}>Regras do grupo (opcional)<textarea maxLength={500} value={form.rules} onChange={(e) => update("rules", e.target.value)} /><small>{form.rules.length}/500</small></label></div><div className={styles.actions}><button className={styles.secondary} onClick={() => setStep(1)} type="button"><ArrowLeft aria-hidden size={18} /> Voltar</button><button className={styles.primary} onClick={() => setStep(3)} type="button">Revisar grupo <ArrowRight aria-hidden size={18} /></button></div></section> : null}

      {step === 3 ? <section className={styles.card} aria-labelledby="review-title"><div className={styles.cardHeader}><div><h3 id="review-title">Confira antes de concluir</h3><p>Uma última revisão ajuda a deixar o espaço pronto para a turma.</p></div><CheckCircle aria-hidden className={styles.greenIcon} size={24} weight="fill" /></div><ReviewBlock icon={<PencilSimple aria-hidden />} title="Informações do grupo" onEdit={() => setStep(1)} rows={[["Nome do grupo", form.name], ["Disciplina", form.discipline], ["Turma", form.className], ["Período", form.term], ["Descrição", form.description]]} /><ReviewBlock icon={<UsersThree aria-hidden />} title="Acesso e participação" onEdit={() => setStep(2)} rows={[["Tipo de acesso", form.access === "public" ? "Público — entrada livre" : "Privado — entrada mediante aprovação"], ["Limite", `${form.limit} participantes`], ["Sugestões de assuntos", form.suggestions ? "Permitidas" : "Desativadas"], ["Regras", form.rules]]} /><div className={styles.notice}><RocketLaunch aria-hidden size={20} /><span><strong>Depois da criação</strong> o canal <b>#geral</b> será criado automaticamente. O grupo poderá ser ajustado em “Gerenciar grupo”.</span></div><div className={styles.warning}><Info aria-hidden size={18} />O nexoAula é uma ferramenta de apoio acadêmico e não substitui os registros oficiais da instituição de ensino.</div><div className={styles.actions}><button className={styles.secondary} onClick={() => setStep(2)} type="button"><ArrowLeft aria-hidden size={18} /> Voltar</button><button className={styles.primary} onClick={() => setStep(4)} type="button"><Check aria-hidden size={18} /> Criar grupo</button></div></section> : null}

      {step === 4 ? <section className={styles.card} aria-labelledby="success-title"><div className={styles.successIcon}><CheckCircle aria-hidden size={34} weight="fill" /></div><div className={styles.successSummary}><h3 id="success-title">Resumo do grupo</h3><dl><div><dt>Nome</dt><dd>{form.name}</dd></div><div><dt>Disciplina</dt><dd>{form.discipline}</dd></div><div><dt>Turma · período</dt><dd>{form.className} · {form.term}</dd></div><div><dt>Sua função</dt><dd>Organizador</dd></div><div><dt>Tipo de acesso</dt><dd>{form.access === "public" ? "Público — entrada livre" : "Privado — entrada mediante aprovação"}</dd></div></dl></div><div className={styles.nextSteps}><h3>Você já pode</h3><p><ChatCircleDots aria-hidden size={19} /> Iniciar uma discussão em <b>#geral</b>.</p><p><CalendarBlank aria-hidden size={19} /> Agendar encontros de estudo.</p><p><UserPlus aria-hidden size={19} /> Acompanhar a entrada de participantes.</p></div><div className={styles.actions}><Link className={styles.secondary} href="/grupos">Voltar aos grupos</Link><Link className={styles.primary} href="/grupos/comunidade-msd-c8">Ir para o grupo <ArrowRight aria-hidden size={18} /></Link></div></section> : null}
    </div>
  );
}

function Step({ active, current, label, number }: { active: boolean; current: boolean; label: string; number: string }) { return <div className={`${styles.step} ${active ? styles.stepActive : ""} ${current ? styles.stepCurrent : ""}`}><span>{active && !current ? <Check aria-hidden size={14} weight="bold" /> : number}</span><strong>{label}</strong></div>; }

function ReviewBlock({ icon, onEdit, rows, title }: { icon: React.ReactNode; onEdit: () => void; rows: string[][]; title: string }) { return <section className={styles.reviewBlock}><div className={styles.reviewTitle}><div>{icon}<h4>{title}</h4></div><button onClick={onEdit} type="button">Editar</button></div><dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>; }
