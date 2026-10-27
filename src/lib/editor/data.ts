import type { SupabaseClient } from "@supabase/supabase-js";

export const SHEET_STATUS_LABEL: Record<string, string> = { draft: "Draf", published: "Terbit", closed: "Ditutup" };

export type EditableClass = { id: string; name: string; academic_years: { label: string; is_active: boolean } | null };

/** Kelas yang boleh disusun BBO-nya: kelas tempat pengguna menjadi guru Iman, atau semua kelas bagi admin. */
export async function editableClasses(supabase: SupabaseClient, userId: string, isAdmin: boolean): Promise<EditableClass[]> {
  if (isAdmin) {
    const { data } = await supabase.from("classes").select("id, name, academic_years(label, is_active)").order("name");
    return (data ?? []) as unknown as EditableClass[];
  }
  const { data } = await supabase
    .from("class_teachers")
    .select("classes(id, name, academic_years(label, is_active))")
    .eq("teacher_id", userId)
    .eq("subject", "iman");
  return ((data ?? []).map((r) => r.classes) as unknown as EditableClass[])
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
}
