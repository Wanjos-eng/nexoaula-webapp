import { redirect } from "next/navigation";
import { PersonalDiscipline } from "@/modules/academic/components/PersonalDiscipline";

export default async function Page({ searchParams }: {
  searchParams: Promise<{ group?: string }>;
}) {
  const { group } = await searchParams;
  if (!group || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(group)) redirect("/disciplinas");
  return <PersonalDiscipline groupId={group} />;
}
