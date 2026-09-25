import type { Metadata } from "next";

import { AcademicCalendarView } from "@/modules/academic/components/AcademicCalendarView";

export const metadata: Metadata = {
  title: "Calendário",
};

export default function Page() {
  return <AcademicCalendarView />;
}
