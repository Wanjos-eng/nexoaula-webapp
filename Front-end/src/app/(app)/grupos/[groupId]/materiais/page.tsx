import type { Metadata } from "next";

import { MateriaisPage } from "@/app/(app)/materiais/page";

export const metadata: Metadata = {
  title: "Conteúdos da comunidade",
  description: "Materiais e conteúdos vinculados à comunidade privada.",
};

export default function GroupMaterialsPage() {
  return <MateriaisPage />;
}
