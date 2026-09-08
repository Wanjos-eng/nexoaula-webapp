import { use } from "react";
import { getGroupDetail } from "@/mocks/community/group-detail";
import { GroupDetailView } from "@/modules/community/components/GroupDetailView";

type GroupDetailPageProps = {
  params: Promise<{ groupId: string }>;
};

export default function GroupDetailPage({ params }: GroupDetailPageProps) {
  const { groupId } = use(params);
  const group = getGroupDetail(groupId);

  return <GroupDetailView key={groupId} group={group} />;
}
