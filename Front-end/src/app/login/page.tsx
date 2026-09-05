import { CalendarDots, NotePencil, UsersThree } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";

import { LoginForm } from "@/modules/auth";
import { AuthShell } from "@/components/layout/AuthShell";

export const metadata: Metadata = {
  title: "Entrar",
};

const benefits = [
  {
    icon: CalendarDots,
    text: "Planejamento e acompanhamento das aulas.",
  },
  {
    icon: NotePencil,
    text: "Registro pessoal de presença e conteúdos.",
  },
  {
    icon: UsersThree,
    text: "Grupos e encontros de estudo.",
  },
];

export default function LoginPage() {
  return (
    <AuthShell
      benefits={benefits}
      description="Acompanhe suas disciplinas, aulas, registros e grupos de estudo em um só lugar."
      title="Organize sua vida acadêmica"
    >
      <LoginForm />
    </AuthShell>
  );
}
