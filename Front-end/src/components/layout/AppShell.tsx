"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { Sidebar } from "./Sidebar";
import styles from "./AppShell.module.css";
import { Topbar } from "./Topbar";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<"expanded" | "compact" | "hidden">("expanded");
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const menuButton = menuButtonRef.current;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
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
    <div className={`${styles.shell} ${sidebarMode === "compact" ? styles.shellCompact : sidebarMode === "hidden" ? styles.shellHidden : ""}`}>
      <a className={styles.skipLink} href="#conteudo-principal">
        Pular para o conteúdo
      </a>
      <Sidebar
        closeButtonRef={closeButtonRef}
        isOpen={isMenuOpen}
        mode={sidebarMode}
        onClose={() => setIsMenuOpen(false)}
        onModeChange={setSidebarMode}
      />
      <div className={styles.workspace}>
        <Topbar
          menuButtonRef={menuButtonRef}
          onMenuOpen={() => setIsMenuOpen(true)}
        />
        <main className={styles.main} id="conteudo-principal" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
