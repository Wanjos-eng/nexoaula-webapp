import { redirect } from "next/navigation";

export default function MaterialRedirectPage() {
  redirect("/grupos?view=discover");
}
