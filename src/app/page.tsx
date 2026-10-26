import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/server";

export default async function Home() {
  const { user, profile } = await getCurrentProfile();
  if (!user) redirect("/masuk");
  redirect(profile?.role === "parent" || !profile ? "/beranda" : "/guru");
}
