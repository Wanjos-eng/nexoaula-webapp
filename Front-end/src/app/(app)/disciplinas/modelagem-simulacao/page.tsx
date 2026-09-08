import { getDisciplineDetail } from "@/mocks/academic/academicCatalog";
import { DisciplineDetailPage } from "@/modules/academic/components/DisciplineDetailPage";

export default function ModelagemSimulacaoPage() {
  const discipline = getDisciplineDetail("modelagem-simulacao");
  return <DisciplineDetailPage key="modelagem-simulacao" discipline={discipline} />;
}
