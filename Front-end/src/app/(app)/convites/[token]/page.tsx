import { InviteAcceptance } from "@/modules/groups/InviteAcceptance";

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <InviteAcceptance token={token} />;
}
