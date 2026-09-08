import { use } from "react";
import { getDisciplineDetail } from "@/mocks/academic/academicCatalog";
import { DisciplineDetailPage } from "@/modules/academic/components/DisciplineDetailPage";

type ClassSectionPageProps = {
  params: Promise<{ classSectionId: string }>;
};

export default function ClassSectionDetailPage({ params }: ClassSectionPageProps) {
  const { classSectionId } = use(params);
  const discipline = getDisciplineDetail(classSectionId);

  return <DisciplineDetailPage key={classSectionId} discipline={discipline} />;
}
