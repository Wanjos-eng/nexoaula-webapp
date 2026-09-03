import type { Metadata } from "next";

import { communityGroups, myStudyGroups } from "@/mocks/community/groups";
import { GroupDirectory } from "@/modules/community/components/GroupDirectory";
import type { DirectoryStatus } from "@/modules/community/types";

export const metadata: Metadata = {
  title: "Grupos de estudo",
  description: "Encontre e acompanhe grupos de estudo do nexoAula.",
};

export default async function GruposPage({ searchParams }: PageProps<"/grupos">) {
  const query = await searchParams;
  const view = Array.isArray(query.view) ? query.view[0] : query.view;
  const state = Array.isArray(query.state) ? query.state[0] : query.state;
  const initialStatus: DirectoryStatus = state === "loading" || state === "error" ? state : "ready";

  return (
    <GroupDirectory
      groups={communityGroups}
      initialStatus={initialStatus}
      initialView={view === "discover" ? "discover" : "mine"}
      myGroups={myStudyGroups}
    />
  );
}
