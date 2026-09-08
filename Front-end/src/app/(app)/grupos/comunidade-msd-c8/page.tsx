import { getGroupDetailPreview } from "@/mocks/community/group-detail";
import { GroupDetailView } from "@/modules/community/components/GroupDetailView";

export default async function GroupPage({ searchParams }: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state } = await searchParams;
  const groupId = "comunidade-msd-c8";
  return <GroupDetailView key={`${groupId}-${state}`} group={getGroupDetailPreview(groupId, state === "empty")}
    state={state === "loading" || state === "error" ? state : "ready"} />;
}
