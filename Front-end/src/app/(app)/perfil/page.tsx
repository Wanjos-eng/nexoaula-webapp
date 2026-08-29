import type { Metadata } from "next";

import { ProfilePage } from "@/components/profile/ProfilePage";

export const metadata: Metadata = { title: "Meu perfil" };

export default function PerfilPage() {
  return <ProfilePage />;
}
