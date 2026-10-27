import type { SupabaseClient } from "@supabase/supabase-js";
import { hariIniJakarta } from "@/lib/format";
import type { AdabState, Answer, BboSection, MurafaqatItem, SessionData, SheetInfo, SubmissionStatus } from "./types";

/**
 * Memuat semua yang dibutuhkan sesi BBO satu santri. Semua query lewat RLS:
 * bila santri bukan anak pengguna ini, atau lembar belum terbit, hasilnya null.
 */
export async function loadSession(
  supabase: SupabaseClient,
  sheetId: string,
  studentId: string,
): Promise<SessionData | null> {
  const today = hariIniJakarta();

  const [{ data: student }, { data: sheet }] = await Promise.all([
    supabase.from("students").select("id, full_name, nickname, class_id").eq("id", studentId).maybeSingle(),
    supabase
      .from("bbo_sheets")
      .select("id, class_id, sheet_no, title, theme, subtheme, core_topic, opening_note, start_date, end_date, hijri_range, kbm_weeks")
      .eq("id", sheetId)
      .maybeSingle(),
  ]);
  if (!student || !sheet || student.class_id !== sheet.class_id) return null;

  const [{ data: sections }, { data: murafaqat }, { data: submission }] = await Promise.all([
    supabase
      .from("bbo_sections")
      .select(
        "id, kind, title, position, cards:bbo_cards(id, position, tier, dimension, prompt, expected_answer, parent_note, ayah_arabic, ayah_translation, ayah_ref)",
      )
      .eq("sheet_id", sheetId)
      .order("position")
      .order("position", { referencedTable: "bbo_cards" }),
    supabase
      .from("murafaqat_items")
      .select("id, subject, learned, home_practice, position")
      .eq("sheet_id", sheetId)
      .order("position"),
    supabase
      .from("submissions")
      .select("id, status, last_card_id, card_responses(card_id, result, note)")
      .eq("sheet_id", sheetId)
      .eq("student_id", studentId)
      .maybeSingle(),
  ]);

  let adabToday: AdabState | null = null;
  if (submission) {
    const { data } = await supabase
      .from("adab_logs")
      .select("niat, wudhu, pakaian, duduk, doa_awal, doa_akhir")
      .eq("submission_id", submission.id)
      .eq("session_date", today)
      .maybeSingle();
    adabToday = data;
  }

  const answers: Record<string, Answer> = {};
  for (const r of submission?.card_responses ?? []) {
    answers[r.card_id] = { result: r.result, note: r.note };
  }

  return {
    student: { id: student.id, full_name: student.full_name, nickname: student.nickname },
    sheet: sheet as SheetInfo,
    sections: (sections ?? []) as BboSection[],
    murafaqat: (murafaqat ?? []) as MurafaqatItem[],
    submission: submission
      ? { id: submission.id, status: submission.status as SubmissionStatus, last_card_id: submission.last_card_id }
      : null,
    answers,
    adabToday,
    today,
  };
}
