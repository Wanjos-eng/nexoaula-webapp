"use client";

import { Bell, Check, GearSix, GraduationCap, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { useState } from "react";

import styles from "./ProfilePage.module.css";

const personalDetails = [
  ["E-mail institucional", "lucas.andrade@universidade.edu.br"],
  ["Telefone", "(85) 99887-6655"],
  ["Matrícula", "2024098234"],
  ["Data de ingresso", "Fevereiro de 2024"],
];

export function ProfilePage() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [theme, setTheme] = useState<"Claro" | "Escuro">("Claro");

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Conta acadêmica</p>
          <h1>Meu Perfil</h1>
          <p>Gerencie suas informações pessoais e visualize seu resumo acadêmico.</p>
        </div>
        <div className={styles.headerActions}>
          <form className={styles.search} onSubmit={(event) => event.preventDefault()} role="search">
            <MagnifyingGlass aria-hidden size={17} />
            <label className="sr-only" htmlFor="profile-search">Buscar no nexoAula</label>
            <input id="profile-search" placeholder="Buscar no nexoAula..." type="search" />
          </form>
          <button aria-label="Abrir configurações do perfil" className={styles.iconButton} type="button">
            <GearSix aria-hidden size={19} />
          </button>
        </div>
      </header>

      <section aria-labelledby="profile-name" className={styles.identityCard}>
        <div className={styles.avatar} aria-hidden>LA</div>
        <div>
          <h2 id="profile-name">Lucas Andrade</h2>
          <div className={styles.identityMeta}>
            <span>Ciência da Computação</span>
            <span>6º Semestre</span>
            <span>Universidade Federal</span>
          </div>
        </div>
      </section>

      <div className={styles.summaryGrid}>
        <section className={styles.panel} aria-labelledby="personal-title">
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelKicker}>Cadastro</p>
              <h2 id="personal-title">Informações Pessoais</h2>
            </div>
          </div>
          <dl className={styles.detailList}>
            {personalDetails.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className={styles.panel} aria-labelledby="academic-title">
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelKicker}>Resumo</p>
              <h2 id="academic-title">Desempenho Acadêmico</h2>
            </div>
            <span className={styles.ira}>8,7</span>
          </div>
          <dl className={styles.metricList}>
            <div>
              <dt>Média Geral (IRA)</dt>
              <dd>8,7</dd>
            </div>
            <div>
              <div className={styles.metricLine}><dt>Créditos Concluídos</dt><dd>120 / 240</dd></div>
              <div aria-label="50% dos créditos concluídos" className={styles.progressTrack}><span style={{ width: "50%" }} /></div>
              <small>50% concluído</small>
            </div>
            <div>
              <dt>Disciplinas em Andamento</dt>
              <dd>4</dd>
            </div>
            <div>
              <dt>Previsão de Formatura</dt>
              <dd>2027.1</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className={styles.settingsPanel} aria-labelledby="settings-title">
        <div className={styles.settingsHeader}>
          <div>
            <p className={styles.panelKicker}>Preferências</p>
            <h2 id="settings-title">Preferências e Configurações</h2>
          </div>
          <Bell aria-hidden className={styles.settingsIcon} size={21} />
        </div>
        <div className={styles.settingsGrid}>
          <div className={styles.settingBlock}>
            <div>
              <h3>Notificações</h3>
              <p>Receba avisos de aulas, fóruns e mensagens por e-mail.</p>
            </div>
            <button aria-checked={notificationsEnabled} className={`${styles.switch} ${notificationsEnabled ? styles.switchOn : ""}`} onClick={() => setNotificationsEnabled((enabled) => !enabled)} role="switch" type="button">
              <span /> {notificationsEnabled ? "Ativadas" : "Desativadas"}
            </button>
          </div>
          <div className={styles.settingBlock}>
            <div>
              <h3>Tema Visual</h3>
              <p>Escolha a aparência da plataforma conforme sua preferência.</p>
            </div>
            <div aria-label="Tema visual" className={styles.themeOptions} role="radiogroup">
              {(["Claro", "Escuro"] as const).map((option) => (
                <button aria-checked={theme === option} className={theme === option ? styles.themeActive : ""} key={option} onClick={() => setTheme(option)} role="radio" type="button">{theme === option ? <Check aria-hidden size={13} /> : null}{option}</button>
              ))}
            </div>
          </div>
          <label className={styles.settingBlock}>
            <span>
              <h3>Idioma</h3>
              <p>Idioma preferencial da interface do usuário.</p>
            </span>
            <select defaultValue="pt-BR">
              <option value="pt-BR">Português (Brasil)</option>
              <option value="en-US">English (United States)</option>
            </select>
          </label>
        </div>
      </section>

      <p className={styles.demoNote}><GraduationCap aria-hidden size={16} /> Dados simulados para a apresentação do nexoAula.</p>
    </div>
  );
}
