"use client";

import {
  BookOpenText,
  CalendarDots,
  ChatCircleDots,
  UserCheck,
  ChartLineUp,
  House,
  IdentificationCard,
  SignOut,
  Storefront,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type RefObject } from "react";

import { useToast } from "@/components/ui/Toast";
import { useAuthSession } from "@/modules/auth/components/AuthSessionProvider";
import styles from "./AppShell.module.css";

type SidebarProps = {
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  isOpen: boolean;
  onClose: () => void;
};

const navigationSections = [
  { label: "Visão geral", items: [{ href: "/inicio", icon: House, label: "Início" }] },
  { label: "Meu espaço", items: [
    { href: "/disciplinas", icon: BookOpenText, label: "Minhas Disciplinas" },
    { href: "/frequencia", icon: UserCheck, label: "Minha Frequência" },
    { href: "/calendario", icon: CalendarDots, label: "Calendário" },
    { href: "/progresso", icon: ChartLineUp, label: "Meu Progresso" },
  ] },
  { label: "Em comunidade", items: [
    { href: "/grupos", icon: UsersThree, label: "Comunidades" },
    { href: "/chat", icon: ChatCircleDots, label: "Chat" },
  ] },
  { label: "Tutorias", items: [
    { href: "/sessoes", icon: Storefront, label: "Explorar tutorias" },
    { href: "/sessoes/minhas", icon: CalendarDots, label: "Minhas tutorias" },
    { href: "/tutor", icon: IdentificationCard, label: "Área do Tutor" },
  ] },
];

function isRouteActive(pathname: string, href: string) {
  if (href === "/sessoes" && pathname.startsWith("/sessoes/minhas")) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ closeButtonRef, isOpen, onClose }: SidebarProps) {
  const { logout, user } = useAuthSession();
  const { showToast } = useToast();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);
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
        tabIndex={-1}
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
          {navigationSections.map((section) => (
            <div key={section.label} role="group" aria-label={section.label}>
              <p className={styles.navSectionLabel}>{section.label}</p>
              {section.items.map(({ href, icon: NavIcon, label }) => {
                const isActive = isRouteActive(pathname, href);
                return (
                  <Link aria-current={isActive ? "page" : undefined}
                    className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
                    href={href} key={href} onClick={onClose}>
                    <NavIcon aria-hidden size={21} weight={isActive ? "fill" : "regular"} />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
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
          <button
            aria-label="Sair"
            className={styles.logoutButton}
            disabled={loggingOut}
            onClick={async () => {
              setLoggingOut(true);
              try {
                await logout();
              } catch {
                setLoggingOut(false);
                showToast({
                  message: "Não foi possível encerrar sua sessão. Tente novamente.",
                  variant: "error",
                });
              }
            }}
            title="Sair"
            type="button"
          >
            <SignOut aria-hidden size={19} />
          </button>
        </div>
      </aside>
    </>
  );
}
