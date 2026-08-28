import type { Metadata, Viewport } from "next";

import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "nexoAula",
    template: "%s | nexoAula",
  },
  description:
    "WebApp acadêmico para organizar disciplinas, grupos de estudo, encontros e progresso.",
  icons: {
    icon: "/favicon.ico",
    apple: "/brand/nexoaula-app-icon-192.png",
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#027a42",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html data-scroll-behavior="smooth" lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
