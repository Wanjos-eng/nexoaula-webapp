import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { AuthSessionProvider } from "@/modules/auth";

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return <AuthSessionProvider><AppShell>{children}</AppShell></AuthSessionProvider>;
}
