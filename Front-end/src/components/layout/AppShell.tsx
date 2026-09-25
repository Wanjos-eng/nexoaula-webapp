"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { Sidebar } from "./Sidebar";
import styles from "./AppShell.module.css";
import { Topbar } from "./Topbar";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    const menuButton = menuButtonRef.current;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
        return;
      }

      if (event.key !== "Tab") return;

      const sidebar = document.getElementById("navegacao-principal");
      if (!sidebar) return;

      const focusable = Array.from(
        sidebar.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("aria-hidden"));

      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      menuButton?.focus();
    };
  }, [isMenuOpen]);

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#conteudo-principal">
        Pular para o conteúdo
      </a>
      <Sidebar
        closeButtonRef={closeButtonRef}
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
      />
      <div className={styles.workspace}>
        <Topbar
          menuButtonRef={menuButtonRef}
          onMenuOpen={() => setIsMenuOpen(true)}
        />
        <main className={styles.main} id="conteudo-principal" tabIndex={-1}>
          <div className={styles.routeContent} key={pathname}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
