import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_OPENING_NOTE } from "@/lib/editor/defaults";
import { DEFAULT_KISI_TITLE } from "@/lib/kisi";
import type { BboImport, KisiImport } from "./schema";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function nextWeek() {
  const d = new Date();
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  const fri = new Date(d);
  fri.setDate(d.getDate() + 4);
  return [d.toLocaleDateString("en-CA"), fri.toLocaleDateString("en-CA")] as const;
}

/**
 * Simpan hasil impor sebagai lembar BBO berstatus draf. Semua lewat sesi pengguna (RLS):
 * hanya guru Iman kelas itu atau admin yang bisa. Bila gagal di tengah, draf dihapus lagi.
 */
export async function saveBboDraft(
  supabase: SupabaseClient,
  userId: string,
  classId: string,
  sheetNo: number,
  data: BboImport,
): Promise<string> {
  const [monday, friday] = nextWeek();
  const start = data.start_date && ISO.test(data.start_date) ? data.start_date : monday;
  const end = data.end_date && ISO.test(data.end_date) && data.end_date >= start ? data.end_date : start === monday ? friday : start;

  const { data: sheet, error } = await supabase
    .from("bbo_sheets")
    .insert({
      class_id: classId,
      sheet_no: sheetNo,
      title: data.title.trim() || data.theme || `Lembar ${sheetNo}`,
      start_date: start,
      end_date: end,
      hijri_range: data.hijri_range,
      kbm_weeks: data.kbm_weeks,
      theme: data.theme,
      subtheme: data.subtheme,
      core_topic: data.core_topic,
      opening_note: data.opening_note ?? DEFAULT_OPENING_NOTE,
      status: "draft",
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !sheet) throw error ?? new Error("Lembar tidak tersimpan");

  try {
    const sections = [
      { kind: "adab", title: "Adab Bermajelis" },
      ...(data.iman_sections.length ? data.iman_sections : [{ title: "Dialog Iman", cards: [] }]).map((s) => ({ kind: "iman", title: s.title })),
      { kind: "murafaqat", title: "Murafaqat" },
      { kind: "quran", title: "Qur'an" },
      { kind: "amanah", title: "Amanah Orang Tua" },
      { kind: "catatan", title: "Catatan Orang Tua" },
    ];
    const { data: secRows, error: secError } = await supabase
      .from("bbo_sections")
      .insert(sections.map((s, i) => ({ sheet_id: sheet.id, kind: s.kind, title: s.title, position: i + 1 })))
      .select("id, kind, position")
      .order("position");
    if (secError || !secRows) throw secError;

    const imanRows = secRows.filter((s) => s.kind === "iman");
    const cards = data.iman_sections.flatMap((s, i) =>
      s.cards.map((c, j) => ({
        section_id: imanRows[i].id,
        position: j + 1,
        tier: c.tier,
        dimension: c.dimension,
        prompt: c.prompt,
        expected_answer: c.expected_answer,
        parent_note: c.parent_note,
        ayah_arabic: c.ayah_arabic,
        ayah_translation: c.ayah_translation,
        ayah_ref: c.ayah_ref,
      })),
    );
    const inserts = [
      cards.length && supabase.from("bbo_cards").insert(cards),
      data.murafaqat.length &&
        supabase.from("murafaqat_items").insert(data.murafaqat.map((m, i) => ({ sheet_id: sheet.id, position: i + 1, ...m }))),
      data.amanah.length && supabase.from("amanah_items").insert(data.amanah.map((a, i) => ({ sheet_id: sheet.id, position: i + 1, ...a }))),
      data.quran_targets.length && supabase.from("quran_targets").insert(data.quran_targets.map((t) => ({ sheet_id: sheet.id, ...t }))),
      data.mutabaah.length &&
        supabase.from("quran_mutabaah_items").insert(
          data.mutabaah
            .filter((m) => m.surah_no >= 1 && m.surah_no <= 114)
            .map((m, i) => ({ sheet_id: sheet.id, position: i + 1, ...m })),
        ),
      data.adab_items.length &&
        supabase.from("adab_items").insert(data.adab_items.map((text, i) => ({ sheet_id: sheet.id, text, position: i + 1 }))),
    ];
    for (const result of await Promise.all(inserts.filter(Boolean))) {
      if (result && result.error) throw result.error;
    }
    return sheet.id;
  } catch (e) {
    await supabase.from("bbo_sheets").delete().eq("id", sheet.id);
    throw e;
  }
}

export async function saveKisi(supabase: SupabaseClient, classId: string, data: KisiImport): Promise<number> {
  const { data: last } = await supabase
    .from("kisi_kisi")
    .select("position")
    .eq("class_id", classId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  let position = last?.position ?? 0;
  const rows = data.subjects.flatMap((s) =>
    s.items
      .map((t) => t.trim())
      .filter(Boolean)
      .map((text) => ({ class_id: classId, title: data.title.trim() || DEFAULT_KISI_TITLE, subject: s.subject.trim(), text, position: ++position })),
  );
  if (rows.length) {
    const { error } = await supabase.from("kisi_kisi").insert(rows);
    if (error) throw error;
  }
  return rows.length;
}
