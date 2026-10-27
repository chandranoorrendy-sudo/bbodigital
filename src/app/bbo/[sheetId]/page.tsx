import { notFound, redirect } from "next/navigation";
import { BboSession } from "@/components/bbo/session";
import { loadSession } from "@/lib/bbo/load";
import { getCurrentProfile } from "@/lib/supabase/server";

export default async function BboSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ sheetId: string }>;
  searchParams: Promise<{ anak?: string }>;
}) {
  const { supabase, user } = await getCurrentProfile();
  if (!user) redirect("/masuk");

  const [{ sheetId }, { anak }] = await Promise.all([params, searchParams]);
  if (!anak) redirect("/beranda");

  const data = await loadSession(supabase, sheetId, anak);
  if (!data) notFound();

  return <BboSession data={data} />;
}
