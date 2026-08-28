import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "nexoAula",
  description:
    "WebApp acadêmico para organizar disciplinas, grupos de estudo, encontros e progresso.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
