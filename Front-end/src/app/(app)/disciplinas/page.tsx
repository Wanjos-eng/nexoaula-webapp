import type { Metadata } from "next";

import { AcademicGroups } from "@/modules/academic/components/AcademicGroups";

export const metadata: Metadata = { title: "Disciplinas" };

export default function DisciplinasPage() {
  return <AcademicGroups />;
}
