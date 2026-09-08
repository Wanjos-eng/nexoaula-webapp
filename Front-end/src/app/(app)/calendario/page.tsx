import { AcademicCalendarView } from "@/modules/academic/components/AcademicCalendarView";
import type { AcademicViewState } from "@/modules/academic/components/AcademicPreviewState";
export default async function Page({ searchParams }: { searchParams: Promise<{ state?: AcademicViewState }> }) {
  return <AcademicCalendarView state={(await searchParams).state} />;
}
