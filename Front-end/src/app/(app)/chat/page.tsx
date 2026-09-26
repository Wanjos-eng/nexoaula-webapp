import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import styles from "@/modules/academic/components/AcademicGroups.module.css";

export default function Page() {
  return <div className={styles.page}>
    <PageHeader eyebrow="Em comunidade" title="Chat das comunidades"
      description="Um espaço para conversar com os grupos e manter cada assunto no seu canal." />
    <Card className={styles.stateCard}>
      <Badge variant="info">Em breve</Badge>
      <h2>As conversas terão seu próprio espaço</h2>
      <p>O envio de mensagens ainda não está disponível. Você já pode acessar suas comunidades e consultar os canais organizados por assunto.</p>
      <Link className={styles.primaryLink} href="/grupos">Ver minhas comunidades</Link>
    </Card>
  </div>;
}
