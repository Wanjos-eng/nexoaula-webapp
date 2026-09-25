"use client";

import {
  BookOpenText,
  CalendarDots,
  ChartLineUp,
  House,
  IdentificationCard,
  Storefront,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { RefObject } from "react";

import { useAuthSession } from "@/modules/auth/components/AuthSessionProvider";
import styles from "./AppShell.module.css";

type SidebarProps = {
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  isOpen: boolean;
  onClose: () => void;
};

const primaryNavigation = [
  { href: "/inicio", icon: House, label: "Início" },
  { href: "/disciplinas", icon: BookOpenText, label: "Minhas Disciplinas" },
  { href: "/grupos", icon: UsersThree, label: "Comunidades" },
  { href: "/calendario", icon: CalendarDots, label: "Calendário" },
  { href: "/sessoes", icon: Storefront, label: "Tutorias" },
  { href: "/progresso", icon: ChartLineUp, label: "Meu Progresso" },
];

const tutorNavigation = {
  href: "/tutor",
  icon: IdentificationCard,
  label: "Área do Tutor",
};

function isRouteActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ closeButtonRef, isOpen, onClose }: SidebarProps) {
  const { user } = useAuthSession();
  const pathname = usePathname();
  const name = user.fullName || "Meu perfil";
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

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
          {primaryNavigation.map(({ href, icon: NavIcon, label }) => {
            const isActive = isRouteActive(pathname, href);
            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
                href={href}
                key={href}
                onClick={onClose}
              >
                <NavIcon aria-hidden size={21} weight={isActive ? "fill" : "regular"} />
                <span>{label}</span>
              </Link>
            );
          })}

          <div aria-hidden className={styles.navDivider} />

          <Link
            aria-current={isRouteActive(pathname, tutorNavigation.href) ? "page" : undefined}
            className={`${styles.navItem} ${styles.tutorNavItem} ${
              isRouteActive(pathname, tutorNavigation.href) ? styles.navItemActive : ""
            }`}
            href={tutorNavigation.href}
            onClick={onClose}
          >
            <tutorNavigation.icon
              aria-hidden
              size={21}
              weight={isRouteActive(pathname, tutorNavigation.href) ? "fill" : "regular"}
            />
            <span>{tutorNavigation.label}</span>
          </Link>
        </nav>

        <div className={styles.profile}>
          <Link className={styles.profileLink} href="/perfil" onClick={onClose}>
            <div aria-hidden className={styles.avatarFallback}>
              {initials}
            </div>
            <div className={styles.profileCopy}>
              <span className={styles.profileName}>{name}</span>
              <small>Meu Perfil</small>
            </div>
          </Link>
        </div>
      </aside>
    </>
  );
}
