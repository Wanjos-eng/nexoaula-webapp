import { redirect } from "next/navigation";

export default async function Page({ searchParams }: {
  searchParams: Promise<{ group?: string }>;
}) {
  const { group } = await searchParams;
  redirect(group && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(group)
    ? `/grupos/${group}#cronograma`
    : "/disciplinas");
}
