import { redirect } from "next/navigation";
import { NewSheetForm } from "@/components/editor/new-sheet-form";
import { GuruHeader } from "@/components/guru/header";
import { editableClasses } from "@/lib/editor/data";
import { getCurrentProfile } from "@/lib/supabase/server";

export default async function NewSheetPage() {
  const { supabase, user, profile } = await getCurrentProfile();
  if (!user) redirect("/masuk");
  if (!profile || profile.role === "parent") redirect("/beranda");

  const classes = await editableClasses(supabase, user.id, profile.role === "admin");
  const { data: sheets } = await supabase.from("bbo_sheets").select("class_id, sheet_no");

  return (
    <div className="mx-auto min-h-dvh max-w-2xl">
      <GuruHeader title="BBO baru" backHref="/guru/bbo" backLabel="Penyusun BBO" />
      <main className="px-4 py-5">
        {classes.length === 0 ? (
          <p className="text-muted-foreground">Penyusun BBO tersedia untuk guru Iman dan admin.</p>
        ) : (
          <NewSheetForm
            classes={classes.map((c) => ({
              id: c.id,
              label: `${c.name}${c.academic_years ? ` (${c.academic_years.label})` : ""}`,
              nextNo: Math.max(0, ...(sheets ?? []).filter((s) => s.class_id === c.id).map((s) => s.sheet_no)) + 1,
            }))}
          />
        )}
      </main>
    </div>
  );
}
