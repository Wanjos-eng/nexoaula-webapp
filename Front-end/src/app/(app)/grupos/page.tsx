import { ArrowRight, UsersThree } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import styles from "./page.module.css";

export default function GruposPage() {
  return <div className={styles.page}><div className={styles.heading}><div><p className={styles.eyebrow}>Comunidade acadêmica</p><h2>Meus grupos</h2><p>Encontre sua turma, organize discussões e combine encontros de estudo.</p></div></div><div className={styles.grid}><article className={styles.groupCard}><div className={styles.groupIcon}><UsersThree aria-hidden size={25} /></div><div className={styles.groupTop}><div><h3>Comunidade MSD — C8</h3><p>Modelagem e Simulação Discreta · Turma C8</p></div><span>Organizador</span></div><div className={styles.stats}><span>12 de 20 membros</span><span>4 assuntos</span><span>Próximo encontro 31/08</span></div><Link className={styles.linkAction} href="/grupos/comunidade-msd-c8">Abrir grupo <ArrowRight aria-hidden size={16} /></Link></article><article className={`${styles.groupCard} ${styles.emptyCard}`}><div className={styles.groupIcon}><UsersThree aria-hidden size={25} /></div><h3>Crie um espaço para sua turma</h3><p>Grupos, canais e encontros ficam reunidos em um só lugar — sem recursos bloqueados para quem está estudando. Use “Criar grupo” no cabeçalho para começar.</p></article></div></div>;
}
