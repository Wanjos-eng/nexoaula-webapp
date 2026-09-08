import { AcademicProgressView } from "@/modules/academic/components/AcademicProgressView";
import type { AcademicViewState } from "@/modules/academic/components/AcademicPreviewState";
export default async function Page({ searchParams }: { searchParams: Promise<{ state?: AcademicViewState }> }) {
  return <AcademicProgressView state={(await searchParams).state} />;
}
