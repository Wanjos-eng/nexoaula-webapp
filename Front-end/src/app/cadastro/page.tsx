import { CalendarCheck, CheckCircle, UsersThree } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";

import { RegisterForm } from "@/modules/auth";
import { AuthShell } from "@/components/layout/AuthShell";

export const metadata: Metadata = {
  title: "Criar conta",
};

const benefits = [
  {
    icon: CalendarCheck,
    text: "Organize suas disciplinas e seus horários.",
  },
  {
    icon: CheckCircle,
    text: "Acompanhe aulas e conteúdos.",
  },
  {
    icon: UsersThree,
    text: "Participe de grupos e encontros de estudo.",
  },
];

export default function CadastroPage() {
  return (
    <AuthShell
      benefits={benefits}
      description="Crie sua conta para acompanhar disciplinas, aulas, registros e grupos de estudo."
      panelPosition="start"
      title="Comece a organizar sua vida acadêmica"
      titleSize="large"
    >
      <RegisterForm />
    </AuthShell>
  );
}
