import { notFound, redirect } from "next/navigation";
import { BboEditor, type EditorData } from "@/components/editor/editor";
import { GuruHeader } from "@/components/guru/header";
import { getCurrentProfile } from "@/lib/supabase/server";

export default async function EditorPage({ params }: { params: Promise<{ sheetId: string }> }) {
  const { supabase, user, profile } = await getCurrentProfile();
  if (!user) redirect("/masuk");
  if (!profile || profile.role === "parent") redirect("/beranda");

  const { sheetId } = await params;
  const { data: sheet } = await supabase
    .from("bbo_sheets")
    .select("id, class_id, sheet_no, title, start_date, end_date, hijri_range, kbm_weeks, theme, subtheme, core_topic, opening_note, status, classes(name)")
    .eq("id", sheetId)
    .maybeSingle();
  if (!sheet) notFound();

  const [
    { data: sections },
    { data: murafaqat },
    { data: amanah },
    { data: targets },
    { data: mine },
    { count: submissions },
    { data: mutabaah },
    { data: adabItems },
  ] = await Promise.all([
      supabase
        .from("bbo_sections")
        .select("id, kind, title, position, cards:bbo_cards(id, position, tier, dimension, prompt, expected_answer, parent_note, ayah_arabic, ayah_translation, ayah_ref)")
        .eq("sheet_id", sheetId)
        .order("position")
        .order("position", { referencedTable: "bbo_cards" }),
      supabase
        .from("murafaqat_items")
        .select("id, subject, learned, home_practice, position, needs_photo, photo_prompt")
        .eq("sheet_id", sheetId)
        .order("position"),
      supabase.from("amanah_items").select("id, text, needs_photo, position").eq("sheet_id", sheetId).order("position"),
      supabase.from("quran_targets").select("id, kind, description").eq("sheet_id", sheetId).is("student_id", null),
      supabase.from("class_teachers").select("subject").eq("class_id", sheet.class_id).eq("teacher_id", user.id),
      supabase.from("submissions").select("id", { count: "exact", head: true }).eq("sheet_id", sheetId),
      supabase.from("quran_mutabaah_items").select("id, surah_no, ayah_from, ayah_to, position").eq("sheet_id", sheetId).order("position"),
      supabase.from("adab_items").select("id, text, position").eq("sheet_id", sheetId).order("position"),
    ]);

  const isAdmin = profile.role === "admin";
  const subjects = (mine ?? []).map((m) => m.subject);
  const data: EditorData = {
    sheet: { ...sheet, className: (sheet.classes as unknown as { name: string } | null)?.name ?? "" } as EditorData["sheet"],
    sections: (sections ?? []) as EditorData["sections"],
    murafaqat: (murafaqat ?? []) as EditorData["murafaqat"],
    amanah: (amanah ?? []) as EditorData["amanah"],
    targets: (targets ?? []) as EditorData["targets"],
    mutabaah: (mutabaah ?? []) as EditorData["mutabaah"],
    adabItems: (adabItems ?? []) as EditorData["adabItems"],
    canEdit: isAdmin || subjects.includes("iman"),
    // Bagian Qur'an & adab: guru Qur'an, juga guru Iman (mis. saat menyusun/mengimpor BBO utuh).
    canEditQuran: isAdmin || subjects.includes("quran") || subjects.includes("iman"),
    submissionCount: submissions ?? 0,
  };

  return (
    <div className="min-h-dvh">
      <GuruHeader title={`${data.sheet.className} · Lembar ${sheet.sheet_no}`} backHref="/guru/bbo" backLabel="Penyusun BBO" />
      <BboEditor data={data} />
    </div>
  );
}
