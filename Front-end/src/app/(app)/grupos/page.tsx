import type { Metadata } from "next";
import { GroupDirectory } from "@/modules/groups/GroupDirectory";
export const metadata: Metadata = { title: "Grupos de estudo" };
export default async function GruposPage({ searchParams }: PageProps<"/grupos">) {
  const query = await searchParams;
  return <GroupDirectory initialView={query.view === "discover" ? "discover" : "mine"} />;
}
