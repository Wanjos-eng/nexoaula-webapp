import type { Metadata } from "next";

import { AcademicPage } from "@/components/academic/AcademicPage";

export const metadata: Metadata = { title: "Disciplinas" };

export default function DisciplinasPage() {
  return <AcademicPage variant="disciplines" />;
}
