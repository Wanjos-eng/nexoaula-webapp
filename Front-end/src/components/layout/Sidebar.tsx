"use client";

import {
  BookOpenText,
  CalendarDots,
  ChartLineUp,
  GearSix,
  House,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { RefObject } from "react";
import { useState } from "react";

import styles from "./AppShell.module.css";

type SidebarProps = {
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  isOpen: boolean;
  mode: "expanded" | "compact" | "hidden";
  onClose: () => void;
  onModeChange: (mode: "expanded" | "compact" | "hidden") => void;
};

const navigation = [
  { href: "/inicio", icon: House, label: "Início" },
  { href: "/disciplinas", icon: BookOpenText, label: "Disciplinas" },
  { href: "/calendario", icon: CalendarDots, label: "Calendário" },
  { href: "/grupos", icon: UsersThree, label: "Grupos" },
  { href: "/progresso", icon: ChartLineUp, label: "Meu progresso" },
];

export function Sidebar({ closeButtonRef, isOpen, mode, onClose, onModeChange }: SidebarProps) {
  const pathname = usePathname();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPeekOpen, setIsPeekOpen] = useState(false);

  return (
    <>
      <button
        aria-label="Fechar menu de navegação"
        className={`${styles.backdrop} ${isOpen ? styles.backdropVisible : ""}`}
        onClick={onClose}
        tabIndex={isOpen ? 0 : -1}
        type="button"
      />
      <aside
        aria-label="Navegação principal"
        className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ""} ${mode === "hidden" && isPeekOpen ? styles.sidebarPeekOpen : ""}`}
        id="navegacao-principal"
        onMouseEnter={() => mode === "hidden" && setIsPeekOpen(true)}
        onMouseLeave={() => mode === "hidden" && setIsPeekOpen(false)}
      >
        <div className={styles.sidebarHeader}>
          <Image
            alt="nexoAula"
            className={styles.sidebarLogo}
            height={46}
            priority
            src="/brand/nexoaula-logo-horizontal-color.png"
            width={200}
          />
          <button
            aria-label="Fechar menu"
            className={styles.closeMenuButton}
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            <X aria-hidden size={22} />
          </button>
        </div>

        <nav className={styles.navList}>
          {navigation.map(({ href, icon: NavIcon, label }, index) => {
            const isActive = index === 0 ? pathname === "/inicio" : label === "Grupos" ? pathname.startsWith("/grupos") : pathname === href;

            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
                href={href}
                key={href}
                onClick={onClose}
              >
                <NavIcon aria-hidden size={22} weight={isActive ? "fill" : "regular"} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className={styles.profile}>
          <Link className={styles.profileLink} href="/perfil" onClick={onClose}>
            <div aria-hidden className={styles.avatarFallback}>
              LA
            </div>
            <span className={styles.profileName}>Lucas Andrade</span>
          </Link>
          <button aria-expanded={isSettingsOpen} aria-label="Abrir configurações da barra lateral" className={styles.iconButton} onClick={() => setIsSettingsOpen((open) => !open)} type="button">
            <GearSix aria-hidden size={21} />
          </button>
          {isSettingsOpen ? <div className={styles.sidebarSettings} role="dialog" aria-label="Configurações da barra lateral"><strong>Barra lateral</strong><button aria-pressed={mode === "expanded"} onClick={() => { onModeChange("expanded"); setIsSettingsOpen(false); }} type="button">Ampla <span>288 px</span></button><button aria-pressed={mode === "compact"} onClick={() => { onModeChange("compact"); setIsSettingsOpen(false); }} type="button">Compacta <span>220 px</span></button><button aria-pressed={mode === "hidden"} onClick={() => { onModeChange("hidden"); setIsSettingsOpen(false); }} type="button">Oculta <span>aparece ao passar o mouse</span></button></div> : null}
        </div>
      </aside>
      {mode === "hidden" ? <button aria-label="Mostrar menu lateral" className={styles.sidebarRevealHandle} onMouseEnter={() => setIsPeekOpen(true)} onFocus={() => setIsPeekOpen(true)} type="button"><span /></button> : null}
    </>
  );
}
