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

import styles from "./AppShell.module.css";

type SidebarProps = {
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  isOpen: boolean;
  onClose: () => void;
};

const navigation = [
  { href: "/inicio", icon: House, label: "Início" },
  { href: "/disciplinas", icon: BookOpenText, label: "Disciplinas" },
  { href: "/calendario", icon: CalendarDots, label: "Calendário" },
  { href: "/grupos", icon: UsersThree, label: "Grupos" },
  { href: "/progresso", icon: ChartLineUp, label: "Progresso" },
];

export function Sidebar({ closeButtonRef, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

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
        className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ""}`}
        id="navegacao-principal"
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
          <div aria-hidden className={styles.avatarFallback}>
            LA
          </div>
          <span className={styles.profileName}>Lucas Andrade</span>
          <button aria-label="Abrir configurações" className={styles.iconButton} type="button">
            <GearSix aria-hidden size={21} />
          </button>
        </div>
      </aside>
    </>
  );
}
