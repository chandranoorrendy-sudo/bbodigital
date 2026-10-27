import Link from "next/link";
import { redirect } from "next/navigation";
import { CopySheetForm } from "@/components/editor/copy-form";
import { GuruHeader } from "@/components/guru/header";
import { Button } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/supabase/server";
import { rentangTanggal } from "@/lib/format";
import { SHEET_STATUS_LABEL, editableClasses } from "@/lib/editor/data";
import { cn } from "@/lib/utils";

export default async function BboListPage() {
  const { supabase, user, profile } = await getCurrentProfile();
  if (!user) redirect("/masuk");
  if (!profile || profile.role === "parent") redirect("/beranda");

  const classes = await editableClasses(supabase, user.id, profile.role === "admin");
  // Guru boleh membaca semua lembar (untuk disalin, GU-2).
  const { data: sheets } = await supabase
    .from("bbo_sheets")
    .select("id, class_id, sheet_no, title, start_date, end_date, status, classes(name, academic_years(label))")
    .order("start_date", { ascending: false });
  const all = (sheets ?? []) as unknown as {
    id: string;
    class_id: string;
    sheet_no: number;
    title: string;
    start_date: string;
    end_date: string;
    status: string;
    classes: { name: string; academic_years: { label: string } | null } | null;
  }[];

  return (
    <div className="mx-auto min-h-dvh max-w-4xl">
      <GuruHeader title="Penyusun BBO" backHref="/guru" backLabel="Kelas saya" />
      <main className="space-y-6 px-4 py-5">
        {classes.length === 0 ? (
          <p className="text-muted-foreground">Penyusun BBO tersedia untuk guru Iman dan admin.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="xl">
                <Link href="/guru/bbo/baru">+ Buat BBO baru</Link>
              </Button>
            </div>

            <CopySheetForm
              sources={all.map((s) => ({
                id: s.id,
                label: `${s.classes?.name ?? "?"} · Lembar ${s.sheet_no}: ${s.title}${s.classes?.academic_years ? ` (${s.classes.academic_years.label})` : ""}`,
              }))}
              targets={classes.map((c) => ({
                id: c.id,
                label: `${c.name}${c.academic_years ? ` (${c.academic_years.label})` : ""}`,
                nextNo: Math.max(0, ...all.filter((s) => s.class_id === c.id).map((s) => s.sheet_no)) + 1,
              }))}
            />

            {classes.map((c) => {
              const list = all.filter((s) => s.class_id === c.id).sort((a, b) => b.sheet_no - a.sheet_no);
              return (
                <section key={c.id} className="space-y-2">
                  <h2 className="text-lg font-semibold">
                    {c.name}
                    {c.academic_years && <span className="text-sm font-normal text-muted-foreground"> · {c.academic_years.label}</span>}
                  </h2>
                  {list.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Belum ada BBO.</p>
                  ) : (
                    <ul className="divide-y overflow-hidden rounded-xl border bg-background">
                      {list.map((s) => (
                        <li key={s.id}>
                          <Link href={`/guru/bbo/${s.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50">
                            <span className="min-w-0">
                              <span className="block truncate font-medium">
                                Lembar {s.sheet_no}: {s.title}
                              </span>
                              <span className="text-sm text-muted-foreground">{rentangTanggal(s.start_date, s.end_date)}</span>
                            </span>
                            <span
                              className={cn(
                                "shrink-0 rounded-full px-2.5 py-1 text-sm font-medium",
                                s.status === "published" ? "bg-primary text-primary-foreground" : s.status === "draft" ? "bg-gold-soft text-gold-ink" : "bg-muted",
                              )}
                            >
                              {SHEET_STATUS_LABEL[s.status]}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </>
        )}
      </main>
    </div>
  );
}
