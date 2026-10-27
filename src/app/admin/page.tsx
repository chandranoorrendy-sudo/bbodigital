import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountsPanel, ClassesPanel, StudentsPanel, YearsPanel, type AdminData } from "@/components/admin/panels";
import { GuruHeader } from "@/components/guru/header";
import { getCurrentProfile } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "akun", label: "Akun" },
  { id: "santri", label: "Santri" },
  { id: "kelas", label: "Kelas & guru" },
  { id: "tahun", label: "Tahun ajaran" },
] as const;

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { supabase, user, profile } = await getCurrentProfile();
  if (!user) redirect("/masuk");
  if (profile?.role !== "admin") redirect("/");

  const { tab: rawTab } = await searchParams;
  const tab = TABS.find((t) => t.id === rawTab)?.id ?? "akun";

  const [{ data: profiles }, { data: guardians }, { data: students }, { data: classes }, { data: years }, { data: classTeachers }, { data: unmatchedMetiq }] =
    await Promise.all([
      supabase.from("profiles").select("id, full_name, username, role").order("full_name"),
      supabase.from("guardians").select("id, profile_id, student_id, relation"),
      supabase.from("students").select("id, full_name, nickname, class_id, birth_year, nisn, research_consent, consent_signed_at").order("full_name"),
      supabase.from("classes").select("id, name, level, section, academic_year_id").order("name"),
      supabase.from("academic_years").select("id, label, start_date, end_date, is_active").order("start_date", { ascending: false }),
      supabase.from("class_teachers").select("id, class_id, teacher_id, subject, is_homeroom"),
      supabase.from("metiq_reports").select("id, nisn, completed_at, report").is("student_id", null).order("completed_at", { ascending: false }).limit(200),
    ]);

  const data: AdminData = {
    me: user.id,
    profiles: (profiles ?? []) as AdminData["profiles"],
    guardians: (guardians ?? []) as AdminData["guardians"],
    students: (students ?? []) as AdminData["students"],
    classes: (classes ?? []) as AdminData["classes"],
    years: (years ?? []) as AdminData["years"],
    classTeachers: (classTeachers ?? []) as AdminData["classTeachers"],
    unmatchedMetiq: (unmatchedMetiq ?? []) as AdminData["unmatchedMetiq"],
  };

  return (
    <div className="mx-auto min-h-dvh max-w-4xl">
      <GuruHeader title="Admin kuttab" backHref="/guru" backLabel="Kelas saya" />
      <nav className="flex gap-1 overflow-x-auto border-b px-4 [scrollbar-width:none]">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/admin?tab=${t.id}`}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-3 font-medium",
              tab === t.id ? "border-gold text-foreground" : "border-transparent text-muted-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <main className="space-y-6 px-4 py-5">
        {tab === "akun" && <AccountsPanel data={data} />}
        {tab === "santri" && <StudentsPanel data={data} />}
        {tab === "kelas" && <ClassesPanel data={data} />}
        {tab === "tahun" && <YearsPanel data={data} />}
      </main>
    </div>
  );
}
