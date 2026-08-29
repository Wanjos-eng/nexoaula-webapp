import type { Metadata } from "next";

import { AcademicPage } from "@/components/academic/AcademicPage";

export const metadata: Metadata = { title: "Calendário" };

export default function CalendarioPage() {
  return <AcademicPage variant="calendar" />;
}
