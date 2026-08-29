import type { Metadata } from "next";

import { AcademicPage } from "@/components/academic/AcademicPage";

export const metadata: Metadata = { title: "Meu progresso" };

export default function ProgressoPage() {
  return <AcademicPage variant="progress" />;
}
