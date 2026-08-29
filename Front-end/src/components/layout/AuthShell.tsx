import type { Icon } from "@phosphor-icons/react";
import { GraduationCap } from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import type { ReactNode } from "react";

import styles from "./AuthShell.module.css";

export type AuthBenefit = {
  icon: Icon;
  text: string;
};

type AuthShellProps = {
  benefits: AuthBenefit[];
  children: ReactNode;
  description: string;
  panelPosition?: "center" | "start";
  title: string;
  titleSize?: "large" | "medium";
};

export function AuthShell({
  benefits,
  children,
  description,
  panelPosition = "center",
  title,
  titleSize = "medium",
}: AuthShellProps) {
  return (
    <main className={styles.shell}>
      <aside className={styles.brandPanel} aria-label="Apresentação do nexoAula">
        <Image
          alt="nexoAula"
          className={styles.desktopLogo}
          height={58}
          priority
          src="/brand/nexoaula-logo-horizontal-white.png"
          width={252}
        />

        <div
          className={`${styles.pitch} ${panelPosition === "start" ? styles.pitchStart : ""}`}
        >
          <h1 className={titleSize === "large" ? styles.titleLarge : styles.titleMedium}>
            {title}
          </h1>
          <p>{description}</p>
          <ul>
            {benefits.map(({ icon: BenefitIcon, text }) => (
              <li key={text}>
                <BenefitIcon aria-hidden size={22} weight="bold" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <GraduationCap aria-hidden className={styles.decoration} weight="thin" />
        <p className={styles.copyright}>© 2026 nexoAula.</p>
      </aside>

      <section className={styles.formPanel}>
        <div className={styles.mobileLogo}>
          <Image
            alt="nexoAula"
            height={46}
            priority
            src="/brand/nexoaula-logo-horizontal-color.png"
            width={200}
          />
        </div>
        <div className={styles.formContainer}>{children}</div>
      </section>
    </main>
  );
}
