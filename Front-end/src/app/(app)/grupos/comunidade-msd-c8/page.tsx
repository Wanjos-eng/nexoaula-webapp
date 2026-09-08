import { getGroupDetail } from "@/mocks/community/group-detail";
import { GroupDetailView } from "@/modules/community/components/GroupDetailView";

export default function ComunidadePage() {
  const group = getGroupDetail("comunidade-msd-c8");
  return <GroupDetailView group={group} />;
}
