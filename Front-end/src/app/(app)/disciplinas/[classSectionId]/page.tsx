import { getDisciplinePreview } from "@/mocks/academic/academicCatalog";
import { DisciplineDetailPage } from "@/modules/academic/components/DisciplineDetailPage";
import type { AcademicViewState } from "@/modules/academic/components/AcademicPreviewState";
export default async function Page({ params, searchParams }: {
  params: Promise<{ classSectionId: string }>;
  searchParams: Promise<{ state?: AcademicViewState; group?: string }>;
}) {
  const { state, group } = await searchParams;
  const id = (await params).classSectionId;
  return <DisciplineDetailPage key={`${id}-${group}-${state}`} discipline={getDisciplinePreview(id, group, state)} state={state} />;
}
