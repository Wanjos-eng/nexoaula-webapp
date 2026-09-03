import type { Metadata } from "next";
import { CreateGroupFlow } from "@/modules/community/components/CreateGroupFlow";

export const metadata: Metadata = { title: "Criar grupo" };

export default function NovoGrupoPage() {
  return <CreateGroupFlow />;
}
