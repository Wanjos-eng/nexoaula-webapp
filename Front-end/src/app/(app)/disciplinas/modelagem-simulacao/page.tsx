import type { Metadata } from "next";

import { DisciplineDetailPage } from "@/components/discipline/DisciplineDetailPage";

export const metadata: Metadata = {
  title: "Modelagem e Simulação Discreta | nexoAula",
};

export default function ModelagemSimulacaoPage() {
  return <DisciplineDetailPage />;
}
