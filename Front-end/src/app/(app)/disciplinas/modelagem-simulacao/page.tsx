import { getDisciplinePreview } from "@/mocks/academic/academicCatalog";
import { DisciplineDetailPage } from "@/modules/academic/components/DisciplineDetailPage";
import type { AcademicViewState } from "@/modules/academic/components/AcademicPreviewState";
export default async function Page({ searchParams }: {
  searchParams: Promise<{ state?: AcademicViewState; group?: string }>;
}) {
  const { state, group } = await searchParams;
  const id = "modelagem-simulacao";
  return <DisciplineDetailPage key={`${id}-${group}-${state}`} discipline={getDisciplinePreview(id, group, state)} state={state} />;
}
