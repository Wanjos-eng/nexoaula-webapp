import type { Metadata } from "next";

import { AcademicProgressView } from "@/modules/academic/components/AcademicProgressView";

export const metadata: Metadata = {
  title: "Meu Progresso",
};

export default function Page() {
  return <AcademicProgressView />;
}
