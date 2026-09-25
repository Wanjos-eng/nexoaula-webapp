import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { ToastProvider } from "@/components/ui/Toast";
import { AuthSessionProvider } from "@/modules/auth";

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <AuthSessionProvider>
      <ToastProvider>
        <AppShell>{children}</AppShell>
      </ToastProvider>
    </AuthSessionProvider>
  );
}
