import { getGroupDetailPreview } from "@/mocks/community/group-detail";
import { GroupDetailView } from "@/modules/community/components/GroupDetailView";

export default async function GroupPage({ params, searchParams }: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ state?: string }>;
}) {
  const { state } = await searchParams;
  const groupId = (await params).groupId;
  return <GroupDetailView key={`${groupId}-${state}`} group={getGroupDetailPreview(groupId, state === "empty")}
    state={state === "loading" || state === "error" ? state : "ready"} />;
}
