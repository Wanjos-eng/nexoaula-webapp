import { GroupDetail } from "@/modules/groups/GroupDetail";
export default async function GroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  return <GroupDetail groupId={(await params).groupId} />;
}
