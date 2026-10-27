import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { KisiChecklist } from "@/components/kisi/checklist";
import { getCurrentProfile } from "@/lib/supabase/server";
import type { KisiItem } from "@/lib/kisi";

export default async function KisiPage({ searchParams }: { searchParams: Promise<{ anak?: string }> }) {
  const { supabase, user, profile } = await getCurrentProfile();
  if (!user) redirect("/masuk");

  const { anak } = await searchParams;
  if (!anak) redirect("/beranda");
  // RLS: hanya anak sendiri yang terbaca.
  const { data: student } = await supabase.from("students").select("id, full_name, nickname, class_id").eq("id", anak).maybeSingle();
  if (!student?.class_id) notFound();

  const [{ data: items }, { data: checks }] = await Promise.all([
    supabase.from("kisi_kisi").select("id, class_id, title, subject, text, position").eq("class_id", student.class_id).order("position"),
    supabase.from("kisi_checks").select("kisi_id").eq("student_id", student.id),
  ]);

  return (
    <div className="mx-auto min-h-dvh max-w-md">
      <AppHeader name={profile?.full_name ?? "Ayah Bunda"} subtitle={`Kisi-kisi ujian · ${student.nickname ?? student.full_name}`} />
      <main className="space-y-5 px-4 py-5">
        <KisiChecklist
          studentId={student.id}
          studentName={student.nickname ?? student.full_name}
          items={(items ?? []) as KisiItem[]}
          checked={(checks ?? []).map((c) => c.kisi_id)}
        />
      </main>
    </div>
  );
}
