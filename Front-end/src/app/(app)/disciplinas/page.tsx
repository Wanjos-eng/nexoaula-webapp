import type { Metadata } from "next";

import { DisciplineDetailPage } from "@/components/discipline/DisciplineDetailPage";

export const metadata: Metadata = { title: "Disciplinas" };

export default function DisciplinasPage() {
  return <DisciplineDetailPage />;
}
