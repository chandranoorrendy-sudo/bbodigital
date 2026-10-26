import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/supabase/server";
import { STATUS_LAPORAN, hariIniJakarta, rentangTanggal } from "@/lib/format";

const URUTAN_STATUS = ["not_started", "in_progress", "submitted", "reviewed"] as const;

export default async function GuruPage() {
  const { supabase, user, profile } = await getCurrentProfile();
  if (!user) redirect("/masuk");
  if (!profile || profile.role === "parent") redirect("/beranda");

  const { data: assignments } = await supabase
    .from("class_teachers")
    .select("subject, is_homeroom, classes(id, name)")
    .eq("teacher_id", user.id);

  const byClass = new Map<string, { id: string; name: string; subjects: string[] }>();
  for (const a of assignments ?? []) {
    const c = a.classes as unknown as { id: string; name: string } | null;
    if (!c) continue;
    const entry = byClass.get(c.id) ?? { id: c.id, name: c.name, subjects: [] };
    entry.subjects.push(a.subject === "iman" ? "Iman" : "Qur'an");
    byClass.set(c.id, entry);
  }
  // Admin melihat semua kelas walau tidak ditugaskan mengajar.
  if (profile.role === "admin") {
    const { data: allClasses } = await supabase.from("classes").select("id, name");
    for (const c of allClasses ?? []) {
      if (!byClass.has(c.id)) byClass.set(c.id, { id: c.id, name: c.name, subjects: ["Admin"] });
    }
  }
  const classes = [...byClass.values()].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="mx-auto min-h-dvh max-w-3xl">
      <AppHeader name={profile.full_name} subtitle={profile.role === "admin" ? "Admin kuttab" : "Kelas saya"} />
      <main className="grid gap-4 px-4 py-5 sm:grid-cols-2">
        {classes.length === 0 && (
          <p className="text-muted-foreground">Belum ada kelas yang ditugaskan kepada Anda.</p>
        )}
        {classes.map((c) => (
          <ClassCard key={c.id} classId={c.id} name={c.name} subjects={c.subjects} />
        ))}
      </main>
    </div>
  );
}

async function ClassCard({ classId, name, subjects }: { classId: string; name: string; subjects: string[] }) {
  const { supabase } = await getCurrentProfile();

  const [{ count: studentCount }, { data: sheet }] = await Promise.all([
    supabase.from("students").select("id", { count: "exact", head: true }).eq("class_id", classId),
    supabase
      .from("bbo_sheets")
      .select("id, sheet_no, title, start_date, end_date")
      .eq("class_id", classId)
      .eq("status", "published")
      .lte("start_date", hariIniJakarta())
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const counts: Record<string, number> = { not_started: 0, in_progress: 0, submitted: 0, reviewed: 0 };
  if (sheet) {
    const { data: subs } = await supabase.from("submissions").select("status").eq("sheet_id", sheet.id);
    for (const s of subs ?? []) counts[s.status] += 1;
    counts.not_started += Math.max(0, (studentCount ?? 0) - (subs?.length ?? 0));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{name}</CardTitle>
        <CardDescription>
          {subjects.join(" · ")} · {studentCount ?? 0} santri
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {sheet ? (
          <>
            <p>
              <span className="font-medium">Lembar {sheet.sheet_no}:</span> {sheet.title}
              <br />
              <span className="text-sm text-muted-foreground">{rentangTanggal(sheet.start_date, sheet.end_date)}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {URUTAN_STATUS.map((s) => (
                <Badge key={s} variant="outline" className="text-sm">
                  {STATUS_LAPORAN[s]}: {counts[s]}
                </Badge>
              ))}
            </div>
          </>
        ) : (
          <p className="text-muted-foreground">Belum ada BBO terbit.</p>
        )}
      </CardContent>
    </Card>
  );
}
